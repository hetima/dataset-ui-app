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
