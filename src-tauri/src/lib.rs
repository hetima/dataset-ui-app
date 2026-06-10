use serde::Serialize;

#[derive(Serialize)]
pub struct M4aTags {
    pub title: Option<String>,
    pub album: Option<String>,
    pub artist: Option<String>,
    pub lyrics: Option<String>,
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
        },
        Err(_) => M4aTags { title: None, album: None, artist: None, lyrics: None },
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![read_m4a_tags, write_m4a_lyrics])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
