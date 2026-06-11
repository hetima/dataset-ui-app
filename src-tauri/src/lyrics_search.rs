use std::sync::atomic::{AtomicU64, Ordering};

use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

/// 検索の世代カウンタ。新しい検索開始やキャンセルでインクリメントされ、
/// 実行中の検索は自分の世代が最新でなくなったら中断する。
static SEARCH_GENERATION: AtomicU64 = AtomicU64::new(0);

/// 実行中の歌詞検索を中断する（世代を進めることで進行中ループを止める）
#[tauri::command]
pub fn cancel_lyrics_search() {
    SEARCH_GENERATION.fetch_add(1, Ordering::SeqCst);
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResult {
    pub title: String,
    pub lyrics: String,
    pub synced_lyrics: Option<String>,
}

/// 検索進捗を逐次フロントへ送るためのメッセージ
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "event", content = "data")]
pub enum SearchEvent {
    /// 1 件分の結果が見つかった
    Result(LyricsResult),
    /// あるソースの検索でエラーが発生した（致命的ではなく、他ソースは継続）
    SourceError { source: String, message: String },
    /// すべてのソースの検索が完了した
    Done,
}

/// 歌詞検索の統一入口。sources で使用する API を複数選択できる（"genius" / "lrclib"）。
/// 見つかった結果を channel 経由で 1 件ずつ逐次送信し、最後に Done を送る。
#[tauri::command]
pub async fn search_lyrics(
    title: String,
    artist: String,
    free: String,
    sources: Vec<String>,
    genius_api_key: String,
    channel: Channel<SearchEvent>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    // この検索を新しい世代として登録する。以降この世代が最新でなくなったら中断する。
    let generation = SEARCH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let cancelled = || SEARCH_GENERATION.load(Ordering::SeqCst) != generation;

    // free が空でなければフリーワード検索に切り替える。
    // その場合は title=free / artist="" 相当として各ソースへ渡す。
    let (title, artist) = if free.trim().is_empty() {
        (title.as_str(), artist.as_str())
    } else {
        (free.trim(), "")
    };

    for source in &sources {
        if cancelled() {
            break;
        }
        let result = match source.as_str() {
            "genius" => send_genius(&channel, &client, &genius_api_key, title, artist, &cancelled).await,
            "lrclib" => send_lrclib(&channel, &client, title, artist).await,
            "ytmusic" => send_ytmusic(&channel, &client, title, artist, &cancelled).await,
            _ => Ok(()),
        };
        if let Err(message) = result {
            let _ = channel.send(SearchEvent::SourceError { source: source.clone(), message });
        }
    }

    let _ = channel.send(SearchEvent::Done);
    Ok(())
}

/// Genius API で曲を検索し、歌詞ページをスクレイピングして見つかった順に channel へ送る
async fn send_genius(
    channel: &Channel<SearchEvent>,
    client: &reqwest::Client,
    api_key: &str,
    title: &str,
    artist: &str,
    cancelled: &impl Fn() -> bool,
) -> Result<(), String> {
    let hits = search_genius(client, api_key, title, artist).await?;
    // Genius はトップヒット1件のみ取得する
    if let Some((song_title, url)) = hits.into_iter().next() {
        if cancelled() {
            return Ok(());
        }
        if let Ok(lyrics) = fetch_lyrics(client, &url).await {
            let _ = channel.send(SearchEvent::Result(LyricsResult {
                title: format!("[Genius] {}", song_title),
                lyrics,
                synced_lyrics: None,
            }));
        }
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrclibHit {
    track_name: String,
    artist_name: Option<String>,
    plain_lyrics: Option<String>,
    synced_lyrics: Option<String>,
}

/// lrclib.net の検索 API を叩いて、各ヒットを channel へ送る（API キー不要）
async fn send_lrclib(
    channel: &Channel<SearchEvent>,
    client: &reqwest::Client,
    title: &str,
    artist: &str,
) -> Result<(), String> {
    // track_name / artist_name の個別パラメータで精度を上げる。
    // artist が空の場合は q にまとめて投げる。
    let query: Vec<(&str, &str)> = if artist.trim().is_empty() {
        vec![("q", title)]
    } else {
        vec![("track_name", title), ("artist_name", artist)]
    };
    let hits = client
        .get("https://lrclib.net/api/search")
        .header("User-Agent", "dataset-ui-app (https://github.com/hetima/dataset-ui-app)")
        .query(&query)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<Vec<LrclibHit>>()
        .await
        .map_err(|e| e.to_string())?;

    for hit in hits {
        // plainLyrics が空でも syncedLyrics があれば採用する
        let lyrics = hit.plain_lyrics.clone().unwrap_or_default();
        if lyrics.is_empty() && hit.synced_lyrics.is_none() {
            continue;
        }
        let display = match &hit.artist_name {
            Some(a) => format!("[LRCLIB] {} - {}", hit.track_name, a),
            None => format!("[LRCLIB] {}", hit.track_name),
        };
        let _ = channel.send(SearchEvent::Result(LyricsResult {
            title: display,
            lyrics,
            synced_lyrics: hit.synced_lyrics,
        }));
    }

    Ok(())
}

/// YouTube Music の非公式 InnerTube API。公開された WEB_REMIX クライアント用の API キー。
const YTMUSIC_API_KEY: &str = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
/// search を曲（songs）に絞り込むための params 値
const YTMUSIC_SONGS_PARAMS: &str = "EgWKAQIIAWoMEA4QChADEAQQCRAF";

/// InnerTube API の共通 context（client 情報）を組み立てる。
/// clientVersion は "1.YYYYMMDD.01.00" 形式。日付は厳密でなくても動作するため固定値を使う。
fn ytmusic_context() -> serde_json::Value {
    serde_json::json!({
        "client": {
            "clientName": "WEB_REMIX",
            "clientVersion": "1.20240101.01.00",
            "hl": "en",
        },
        "user": {},
    })
}

/// InnerTube の指定エンドポイントへ POST し、JSON レスポンスを返す
async fn ytmusic_post(
    client: &reqwest::Client,
    endpoint: &str,
    mut body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    body["context"] = ytmusic_context();
    let url = format!("https://music.youtube.com/youtubei/v1/{}?alt=json", endpoint);
    client
        .post(&url)
        .query(&[("key", YTMUSIC_API_KEY)])
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0",
        )
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())
}

/// YouTube Music で曲を検索し、歌詞があれば取得して channel へ送る。
/// search → next（歌詞タブの browseId 取得）→ browse（歌詞本文）の 3 段階。
/// 同期歌詞には対応せず、プレーンテキストのみ取得する。
async fn send_ytmusic(
    channel: &Channel<SearchEvent>,
    client: &reqwest::Client,
    title: &str,
    artist: &str,
    cancelled: &impl Fn() -> bool,
) -> Result<(), String> {
    let query = if artist.trim().is_empty() {
        title.to_string()
    } else {
        format!("{} {}", title, artist)
    };

    // ① 曲を検索して先頭の videoId を取得
    let search = ytmusic_post(
        client,
        "search",
        serde_json::json!({ "query": query, "params": YTMUSIC_SONGS_PARAMS }),
    )
    .await?;
    let Some((song_title, video_id)) = ytmusic_first_song(&search) else {
        return Ok(());
    };
    if cancelled() {
        return Ok(());
    }

    // ② next で歌詞タブの browseId を取得
    let next = ytmusic_post(
        client,
        "next",
        serde_json::json!({ "videoId": video_id, "isAudioOnly": true }),
    )
    .await?;
    let Some(browse_id) = ytmusic_lyrics_browse_id(&next) else {
        // 歌詞タブが無い曲は歌詞なしとして扱う
        return Ok(());
    };
    if cancelled() {
        return Ok(());
    }

    // ③ browse で歌詞本文を取得
    let browse = ytmusic_post(client, "browse", serde_json::json!({ "browseId": browse_id })).await?;
    if let Some(lyrics) = ytmusic_lyrics_text(&browse) {
        let _ = channel.send(SearchEvent::Result(LyricsResult {
            title: format!("[YTMusic] {}", song_title),
            lyrics,
            synced_lyrics: None,
        }));
    }

    Ok(())
}

/// search レスポンスから先頭の曲の (曲名, videoId) を取り出す
fn ytmusic_first_song(search: &serde_json::Value) -> Option<(String, String)> {
    // tabs[0] 配下の musicShelfRenderer から最初の musicResponsiveListItemRenderer を探す
    let tabs = search
        .pointer("/contents/tabbedSearchResultsRenderer/tabs")?
        .as_array()?;
    let sections = tabs
        .first()?
        .pointer("/tabRenderer/content/sectionListRenderer/contents")?
        .as_array()?;
    for section in sections {
        let Some(items) = section.pointer("/musicShelfRenderer/contents").and_then(|v| v.as_array()) else {
            continue;
        };
        for item in items {
            let renderer = item.pointer("/musicResponsiveListItemRenderer")?;
            let video_id = renderer
                .pointer("/overlay/musicItemThumbnailOverlayRenderer/content/musicPlayButtonRenderer/playNavigationEndpoint/watchEndpoint/videoId")
                .and_then(|v| v.as_str());
            let Some(video_id) = video_id else { continue };
            // 曲名は最初の flexColumn のテキスト
            let title = renderer
                .pointer("/flexColumns/0/musicResponsiveListItemFlexColumnRenderer/text/runs/0/text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            return Some((title, video_id.to_string()));
        }
    }
    None
}

/// next レスポンスのタブ一覧から歌詞タブ（browseId が MPLYt で始まる）を探す
fn ytmusic_lyrics_browse_id(next: &serde_json::Value) -> Option<String> {
    let tabs = next
        .pointer("/contents/singleColumnMusicWatchNextResultsRenderer/tabbedRenderer/watchNextTabbedResultsRenderer/tabs")?
        .as_array()?;
    for tab in tabs {
        let browse_id = tab
            .pointer("/tabRenderer/endpoint/browseEndpoint/browseId")
            .and_then(|v| v.as_str());
        if let Some(id) = browse_id {
            if id.starts_with("MPLYt") {
                return Some(id.to_string());
            }
        }
    }
    None
}

/// browse レスポンスから歌詞テキストを抽出する
fn ytmusic_lyrics_text(browse: &serde_json::Value) -> Option<String> {
    let text = browse
        .pointer("/contents/sectionListRenderer/contents/0/musicDescriptionShelfRenderer/description/runs/0/text")
        .and_then(|v| v.as_str())?;
    if text.trim().is_empty() {
        return None;
    }
    Some(text.to_string())
}

/// Genius Search API を叩いて (曲名, 歌詞ページURL) のリストを返す
async fn search_genius(
    client: &reqwest::Client,
    api_key: &str,
    title: &str,
    artist: &str,
) -> Result<Vec<(String, String)>, String> {
    // Genius は単一の q パラメータのみ。"曲名 アーティスト名" を繋げて投げる。
    let query = if artist.trim().is_empty() {
        title.to_string()
    } else {
        format!("{} {}", title, artist)
    };
    let resp = client
        .get("https://api.genius.com/search")
        .bearer_auth(api_key)
        .query(&[("q", &query)])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;

    let hits = resp
        .pointer("/response/hits")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Genius API レスポンスが予期しない形式です".to_string())?;

    let results = hits
        .iter()
        .filter_map(|hit| {
            let result = hit.pointer("/result")?;
            let song_title = result.pointer("/full_title")?.as_str()?.to_string();
            let url = result.pointer("/url")?.as_str()?.to_string();
            Some((song_title, url))
        })
        .collect();

    Ok(results)
}

/// 歌詞ページ HTML をフェッチしてテキストを抽出する。
/// Genius は Cloudflare の bot 対策があるため、ブラウザ相当のヘッダを付けて回避する。
async fn fetch_lyrics(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let html = client
        .get(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    extract_lyrics(&html)
}

/// HTML から歌詞コンテナを抽出してプレーンテキスト化する
fn extract_lyrics(html: &str) -> Result<String, String> {
    let document = Html::parse_document(html);
    // Genius の歌詞コンテナから、ヘッダーなどの選択除外要素を避けて本文を抽出する
    let selector = Selector::parse(r#"div[data-lyrics-container="true"]"#)
        .map_err(|e| e.to_string())?;

    let mut lines: Vec<String> = Vec::new();
    for container in document.select(&selector) {
        collect_node(container, &mut lines);
    }

    if lines.is_empty() {
        return Err("歌詞が見つかりませんでした".to_string());
    }

    Ok(lines.join("\n"))
}

/// 再帰的にテキストノードを収集し、<br> を改行として扱う
fn collect_node(node: scraper::ElementRef, lines: &mut Vec<String>) {
    use scraper::node::Node;

    for child in node.children() {
        match child.value() {
            Node::Text(text) => {
                let t = text.trim();
                if !t.is_empty() {
                    lines.push(t.to_string());
                }
            }
            Node::Element(el) if el.name() == "br" => {
                lines.push(String::new());
            }
            Node::Element(_) => {
                if let Some(el_ref) = scraper::ElementRef::wrap(child) {
                    if el_ref.value().attr("data-exclude-from-selection").is_some() {
                        continue;
                    }
                    collect_node(el_ref, lines);
                }
            }
            _ => {}
        }
    }
}
