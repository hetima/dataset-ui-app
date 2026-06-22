mod lyrics_search;

use mp4ameta::{Data, FreeformIdent};
use serde::{Deserialize, Serialize};

/// 同期歌詞を格納する freeform atom の mean / name（----:com.apple.iTunes:LYRICS_SYNCED）
const LYRICS_SYNCED_MEAN: &str = "com.apple.iTunes";
const LYRICS_SYNCED_NAME: &str = "LYRICS_SYNCED";
use serde_json::json;

#[derive(Serialize)]
pub struct M4aTags {
    pub title: Option<String>,
    pub album: Option<String>,
    pub artist: Option<String>,
    pub lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

fn llm_url(base_url: &str, path: &str) -> String {
    format!("{}/{}", base_url.trim_end_matches('/'), path.trim_start_matches('/'))
}

async fn request_transcript(
    client: &reqwest::Client,
    base_url: &str,
    file_path: &str,
) -> Result<String, String> {
    let response = client
        .post(llm_url(base_url, "chat/completions"))
        .json(&json!({
            "model": "auto",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": file_path }
                    ]
                }
            ],
            "temperature": 0
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<ChatCompletionResponse>()
        .await
        .map_err(|e| e.to_string())?;

    response
        .choices
        .into_iter()
        .next()
        .and_then(|choice| choice.message.content)
        .ok_or_else(|| "返答テキストが空です".to_string())
}

/// m4a ファイルから iTunes メタデータを読み取る
#[tauri::command]
fn read_m4a_tags(path: String) -> M4aTags {
    match mp4ameta::Tag::read_from_path(&path) {
        Ok(tag) => M4aTags {
            title: tag.title().map(|s| s.to_string()),
            album: tag.album().map(|s| s.to_string()),
            artist: tag.artist().map(|s| s.to_string()),
            lyrics: tag.lyrics().map(|s| s.to_string()),
            synced_lyrics: tag
                .strings_of(&FreeformIdent::new_static(LYRICS_SYNCED_MEAN, LYRICS_SYNCED_NAME))
                .next()
                .map(|s| s.to_string()),
        },
        Err(_) => M4aTags { title: None, album: None, artist: None, lyrics: None, synced_lyrics: None },
    }
}

/// m4a ファイルの iTunes lyrics タグを書き込む（他のタグは温存）
#[tauri::command]
fn write_m4a_lyrics(path: String, lyrics: String) -> Result<(), String> {
    let mut tag = mp4ameta::Tag::read_from_path(&path).map_err(|e| e.to_string())?;
    if lyrics.is_empty() {
        tag.remove_lyrics();
    } else {
        tag.set_lyrics(lyrics);
    }
    tag.write_to_path(&path).map_err(|e| e.to_string())
}

/// m4a ファイルの freeform 同期歌詞タグ（LYRICS_SYNCED）を書き込む（他のタグは温存）
#[tauri::command]
fn write_m4a_synced_lyrics(path: String, synced_lyrics: String) -> Result<(), String> {
    let mut tag = mp4ameta::Tag::read_from_path(&path).map_err(|e| e.to_string())?;
    let ident = FreeformIdent::new_static(LYRICS_SYNCED_MEAN, LYRICS_SYNCED_NAME);
    if synced_lyrics.is_empty() {
        tag.remove_data_of(&ident);
    } else {
        tag.set_data(ident, Data::Utf8(synced_lyrics));
    }
    tag.write_to_path(&path).map_err(|e| e.to_string())
}

/// OpenAI 互換 API に接続し、疎通確認用の返答を取得する
#[tauri::command]
async fn generate_transcript_with_llm(
    file_path: String,
    base_url: String,
) -> Result<String, String> {
    let base_url = base_url.trim();
    if base_url.is_empty() {
        return Err("OpenAI 互換 URL が空です".to_string());
    }

    let client = reqwest::Client::new();
    request_transcript(&client, base_url, &file_path).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_m4a_tags,
            write_m4a_lyrics,
            write_m4a_synced_lyrics,
            generate_transcript_with_llm,
            lyrics_search::search_lyrics,
            lyrics_search::cancel_lyrics_search
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
