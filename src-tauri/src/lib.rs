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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![read_m4a_tags])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
