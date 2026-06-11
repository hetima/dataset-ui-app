mod lyrics_search;

use std::fs::File;

use base64::Engine;
use mp4ameta::{Data, FreeformIdent};
use serde::{Deserialize, Serialize};

/// 同期歌詞を格納する freeform atom の mean / name（----:com.apple.iTunes:LYRICS_SYNCED）
const LYRICS_SYNCED_MEAN: &str = "com.apple.iTunes";
const LYRICS_SYNCED_NAME: &str = "LYRICS_SYNCED";
use serde_json::json;
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::TrackType;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

#[derive(Serialize)]
pub struct M4aTags {
    pub title: Option<String>,
    pub album: Option<String>,
    pub artist: Option<String>,
    pub lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

#[derive(Deserialize)]
struct ModelsResponse {
    data: Vec<ModelInfo>,
}

#[derive(Deserialize)]
struct ModelInfo {
    id: String,
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

fn decode_audio_to_16k_mono(path: &str) -> Result<Vec<f32>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let source = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.rsplit('.').next() {
        hint.with_extension(ext);
    }

    let mut format = symphonia::default::get_probe()
        .probe(&hint, source, FormatOptions::default(), MetadataOptions::default())
        .map_err(|e| e.to_string())?;
    let track = format
        .default_track(TrackType::Audio)
        .ok_or_else(|| "音声トラックが見つかりません".to_string())?;
    let audio_params = track
        .codec_params
        .as_ref()
        .and_then(|params| params.audio())
        .ok_or_else(|| "音声コーデック情報を取得できません".to_string())?;
    let source_rate = audio_params
        .sample_rate
        .ok_or_else(|| "サンプルレートを取得できません".to_string())?;
    let channels = audio_params
        .channels
        .as_ref()
        .ok_or_else(|| "チャンネル数を取得できません".to_string())?
        .count();
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(audio_params, &AudioDecoderOptions::default())
        .map_err(|e| e.to_string())?;
    let mut mono = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(Some(packet)) => packet,
            Ok(None) => break,
            Err(SymphoniaError::IoError(_)) => break,
            Err(e) => return Err(e.to_string()),
        };
        if packet.track_id != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(e) => return Err(e.to_string()),
        };
        let mut interleaved = vec![0.0; decoded.samples_interleaved()];
        decoded.copy_to_slice_interleaved(&mut interleaved);

        for frame in interleaved.chunks(channels) {
            let sum: f32 = frame.iter().sum();
            mono.push(sum / channels as f32);
        }
    }

    Ok(resample_linear(&mono, source_rate, 16_000))
}

fn resample_linear(samples: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    if samples.is_empty() || source_rate == target_rate {
        return samples.to_vec();
    }
    let ratio = source_rate as f64 / target_rate as f64;
    let output_len = (samples.len() as f64 / ratio).ceil() as usize;
    let mut output = Vec::with_capacity(output_len);
    for i in 0..output_len {
        let position = i as f64 * ratio;
        let left = position.floor() as usize;
        let right = (left + 1).min(samples.len() - 1);
        let frac = (position - left as f64) as f32;
        output.push(samples[left] * (1.0 - frac) + samples[right] * frac);
    }
    output
}

fn split_audio_chunks(samples: &[f32]) -> Vec<Vec<f32>> {
    const SAMPLE_RATE: usize = 16_000;
    const MIN_CHUNK: usize = SAMPLE_RATE * 10;
    const MAX_CHUNK: usize = SAMPLE_RATE * 20;
    const SILENCE_LEN: usize = SAMPLE_RATE * 3 / 10;
    const SILENCE_THRESHOLD: f32 = 0.01;

    if samples.len() <= MAX_CHUNK {
        return vec![samples.to_vec()];
    }

    let mut chunks = Vec::new();
    let mut start = 0;
    while start < samples.len() {
        let remaining = samples.len() - start;
        if remaining <= MAX_CHUNK {
            chunks.push(samples[start..].to_vec());
            break;
        }

        let search_start = start + MIN_CHUNK;
        let search_end = (start + MAX_CHUNK).min(samples.len());
        let mut split_at = search_end;
        let mut silence_count = 0;
        for i in search_start..search_end {
            if samples[i].abs() < SILENCE_THRESHOLD {
                silence_count += 1;
                if silence_count >= SILENCE_LEN {
                    split_at = i + 1;
                    break;
                }
            } else {
                silence_count = 0;
            }
        }

        chunks.push(samples[start..split_at].to_vec());
        start = split_at;
    }

    chunks
}

fn encode_wav_mono_i16(samples: &[f32]) -> Result<Vec<u8>, String> {
    let data_len = samples
        .len()
        .checked_mul(2)
        .ok_or_else(|| "WAV データが大きすぎます".to_string())?;
    let riff_len = 36usize
        .checked_add(data_len)
        .ok_or_else(|| "WAV データが大きすぎます".to_string())?;
    let data_len = u32::try_from(data_len).map_err(|_| "WAV データが大きすぎます".to_string())?;
    let riff_len = u32::try_from(riff_len).map_err(|_| "WAV データが大きすぎます".to_string())?;

    let mut wav = Vec::with_capacity(44 + samples.len() * 2);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&riff_len.to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&16_000u32.to_le_bytes());
    wav.extend_from_slice(&32_000u32.to_le_bytes());
    wav.extend_from_slice(&2u16.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());

    for sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let value = (clamped * i16::MAX as f32) as i16;
        wav.extend_from_slice(&value.to_le_bytes());
    }

    Ok(wav)
}

async fn resolve_llm_model(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    model: Option<String>,
) -> Result<String, String> {
    match model.filter(|v| !v.trim().is_empty()) {
        Some(model) => Ok(model),
        None => {
            let models = client
                .get(llm_url(base_url, "models"))
                .bearer_auth(api_key)
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?
                .json::<ModelsResponse>()
                .await
                .map_err(|e| e.to_string())?;
            models
                .data
                .into_iter()
                .next()
                .map(|m| m.id)
                .ok_or_else(|| "モデル一覧が空です".to_string())
        }
    }
}

async fn summarize_audio_chunk(
    client: &reqwest::Client,
    base_url: &str,
    api_key: &str,
    model: &str,
    audio_base64: String,
) -> Result<String, String> {
    let response = client
        .post(llm_url(base_url, "chat/completions"))
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": { "data": audio_base64, "format": "wav" }
                        },
                        { "type": "text", "text": "音声の内容を書き起こしてください。余計な装飾はせず、内容のみを答えてください" }
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
    model: Option<String>,
    api_key: Option<String>,
) -> Result<String, String> {
    let base_url = base_url.trim();
    if base_url.is_empty() {
        return Err("OpenAI 互換 URL が空です".to_string());
    }

    let client = reqwest::Client::new();
    let api_key = api_key.filter(|v| !v.trim().is_empty()).unwrap_or_else(|| "LLM".to_string());
    let model = resolve_llm_model(&client, base_url, &api_key, model).await?;
    let samples = decode_audio_to_16k_mono(&file_path)?;
    if samples.is_empty() {
        return Err("音声データが空です".to_string());
    }

    let chunks = split_audio_chunks(&samples);
    let mut results = Vec::with_capacity(chunks.len());
    for chunk in chunks {
        let wav = encode_wav_mono_i16(&chunk)?;
        let audio_base64 = base64::engine::general_purpose::STANDARD.encode(wav);
        results.push(summarize_audio_chunk(&client, base_url, &api_key, &model, audio_base64).await?);
    }

    Ok(results.join("\n"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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
