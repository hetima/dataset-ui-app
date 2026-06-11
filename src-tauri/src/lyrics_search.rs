use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResult {
    pub title: String,
    pub lyrics: String,
    pub synced_lyrics: Option<String>,
}

/// 歌詞検索の統一入口。sources で使用する API を複数選択できる（"genius" / "lrclib"）。
/// すべての検索結果を 1 つの配列にまとめて返す。
#[tauri::command]
pub async fn search_lyrics(
    title: String,
    artist: String,
    sources: Vec<String>,
    genius_api_key: String,
) -> Result<Vec<LyricsResult>, String> {
    let client = reqwest::Client::new();
    let mut results = Vec::new();

    for source in &sources {
        match source.as_str() {
            "genius" => {
                if let Ok(mut r) = search_genius_source(&client, &genius_api_key, &title, &artist).await {
                    results.append(&mut r);
                }
            }
            "lrclib" => {
                if let Ok(mut r) = search_lrclib(&client, &title, &artist).await {
                    results.append(&mut r);
                }
            }
            _ => {}
        }
    }

    Ok(results)
}

/// Genius API で曲を検索し、歌詞ページをスクレイピングして LyricsResult のリストを返す
async fn search_genius_source(
    client: &reqwest::Client,
    api_key: &str,
    title: &str,
    artist: &str,
) -> Result<Vec<LyricsResult>, String> {
    let hits = search_genius(client, api_key, title, artist).await?;
    let mut results = Vec::new();
    for (song_title, url) in hits {
        match fetch_lyrics(client, &url).await {
            Ok(lyrics) => results.push(LyricsResult {
                title: format!("[G] {}", song_title),
                lyrics,
                synced_lyrics: None,
            }),
            Err(_) => continue,
        }
    }
    Ok(results)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrclibHit {
    track_name: String,
    artist_name: Option<String>,
    plain_lyrics: Option<String>,
    synced_lyrics: Option<String>,
}

/// lrclib.net の検索 API を叩いて LyricsResult のリストを返す（API キー不要）
async fn search_lrclib(
    client: &reqwest::Client,
    title: &str,
    artist: &str,
) -> Result<Vec<LyricsResult>, String> {
    let query = format!("{} {}", title, artist);
    let hits = client
        .get("https://lrclib.net/api/search")
        .header("User-Agent", "dataset-ui-app (https://github.com/hetima/dataset-ui-app)")
        .query(&[("q", &query)])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<Vec<LrclibHit>>()
        .await
        .map_err(|e| e.to_string())?;

    let results = hits
        .into_iter()
        .filter_map(|hit| {
            // plainLyrics が空でも syncedLyrics があれば採用する
            let lyrics = hit.plain_lyrics.clone().unwrap_or_default();
            if lyrics.is_empty() && hit.synced_lyrics.is_none() {
                return None;
            }
            let display = match &hit.artist_name {
                Some(a) => format!("[L] {} - {}", hit.track_name, a),
                None => format!("[L] {}", hit.track_name),
            };
            Some(LyricsResult {
                title: display,
                lyrics,
                synced_lyrics: hit.synced_lyrics,
            })
        })
        .collect();

    Ok(results)
}

/// Genius Search API を叩いて (曲名, 歌詞ページURL) のリストを返す
async fn search_genius(
    client: &reqwest::Client,
    api_key: &str,
    title: &str,
    artist: &str,
) -> Result<Vec<(String, String)>, String> {
    let query = format!("{} {}", title, artist);
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

/// 歌詞ページ HTML をフェッチしてテキストを抽出する
async fn fetch_lyrics(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let html = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0")
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
    // Genius の歌詞コンテナは data-lyrics-container="true" 属性を持つ div
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
                    collect_node(el_ref, lines);
                }
            }
            _ => {}
        }
    }
}
