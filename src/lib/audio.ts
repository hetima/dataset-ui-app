import { readDir, stat } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { Track } from "../types";

const AUDIO_EXTENSIONS = new Set([
  "mp3", "m4a", "flac", "wav", "ogg", "aac", "opus",
]);

/** ファイル名から音声ファイルかどうか判定 */
function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext);
}

/**
 * フォルダを再帰的に走査して音声ファイルの Track[] を返す
 * plugin-fs v2 の DirEntry には path フィールドがないため、join で組み立てて再帰走査する
 */
export async function scanFolder(folderPath: string): Promise<Track[]> {
  const tracks: Track[] = [];
  await scanRecursive(folderPath, tracks);
  // ファイル名でソートして返す
  tracks.sort((a, b) => a.name.localeCompare(b.name));
  return tracks;
}

/** 再帰走査の内部実装 */
async function scanRecursive(dirPath: string, tracks: Track[]): Promise<void> {
  const entries = await readDir(dirPath);

  for (const entry of entries) {
    const entryPath = await join(dirPath, entry.name);
    if (entry.isDirectory) {
      await scanRecursive(entryPath, tracks);
    } else if (entry.isFile && isAudioFile(entry.name)) {
      const info = await stat(entryPath);
      tracks.push({
        path: entryPath,
        name: entry.name,
        duration: 0, // loadedmetadata イベントで後から更新
        size: info.size,
        good: false,
        bad: false,
      });
    }
  }
}

/** 秒数を mm:ss 形式に変換 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** ファイルサイズを人間が読める形式に変換 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
