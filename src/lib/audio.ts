import { readDir, stat, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { Track } from "../types";

// mtdt.json の1レコード型（既知フィールドのみ）
type MtdtRecord = {
  filename: string;
  transcript?: string;
  good?: boolean;
  bad?: boolean;
  duration?: number;
  [key: string]: unknown;
};

// 新形式: audiofiles は filename をキーとした辞書
type MtdtFile = {
  audiofiles?: Record<string, MtdtRecord> | MtdtRecord[]; // 旧形式(配列)との互換のためunion
  [key: string]: unknown;
};

/** mtdt.json の audiofiles を filename キーの Map に正規化して返す */
function parseAudiofiles(audiofiles: MtdtFile["audiofiles"]): Map<string, MtdtRecord> {
  const map = new Map<string, MtdtRecord>();
  if (!audiofiles) return map;
  if (Array.isArray(audiofiles)) {
    // 旧形式(配列)を辞書に変換
    for (const r of audiofiles) map.set(r.filename, r);
  } else {
    for (const [k, v] of Object.entries(audiofiles)) map.set(k, v as MtdtRecord);
  }
  return map;
}

/** mtdt.json を読み込んで filename をキーとしたマップを返す */
export async function loadMtdt(folderPath: string): Promise<{ map: Map<string, MtdtRecord>; raw: MtdtFile }> {
  const mtdtPath = await join(folderPath, "mtdt.json");
  try {
    const text = await readTextFile(mtdtPath);
    const raw: MtdtFile = JSON.parse(text);
    return { map: parseAudiofiles(raw.audiofiles), raw };
  } catch {
    return { map: new Map(), raw: {} };
  }
}

/** mtdt.json を読み込み→マージ→保存する。存在しないファイルのレコードは削除 */
export async function saveMtdt(folderPath: string, tracks: Track[]): Promise<void> {
  const mtdtPath = await join(folderPath, "mtdt.json");

  let raw: MtdtFile = {};
  try {
    const text = await readTextFile(mtdtPath);
    raw = JSON.parse(text);
  } catch { /* 存在しない場合は新規作成 */ }

  const existingMap = parseAudiofiles(raw.audiofiles);

  // 現在のトラック一覧で辞書を生成（存在しないファイルは除外）
  const audiofiles: Record<string, MtdtRecord> = {};
  for (const t of tracks) {
    const existing = existingMap.get(t.name) ?? { filename: t.name };
    audiofiles[t.name] = {
      ...existing,
      filename: t.name,
      good: t.good,
      bad: t.bad,
      ...(t.transcript ? { transcript: t.transcript } : {}),
      ...(t.duration > 0 ? { duration: t.duration } : {}),
    };
  }

  const output: MtdtFile = { ...raw, audiofiles };
  await writeTextFile(mtdtPath, JSON.stringify(output, null, 2));
}

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
  const entries = await readDir(folderPath);
  const tracks: Track[] = [];

  for (const entry of entries) {
    if (!entry.isFile || !isAudioFile(entry.name)) continue;
    const entryPath = await join(folderPath, entry.name);
    const info = await stat(entryPath);
    tracks.push({
      path: entryPath,
      name: entry.name,
      duration: 0,
      size: info.size,
      good: false,
      bad: false,
      transcript: "",
    });
  }

  tracks.sort((a, b) => a.name.localeCompare(b.name));

  // mtdt.json を読み込んでメタデータを反映
  const { map: mtdtMap } = await loadMtdt(folderPath);

  for (const track of tracks) {
    const rec = mtdtMap.get(track.name);
    if (rec) {
      track.good = rec.good ?? false;
      track.bad = rec.bad ?? false;
      track.duration = rec.duration ?? 0;
      track.transcript = rec.transcript ?? "";
    }

    // transcript が空なら .txt フォールバック
    if (!track.transcript) {
      try {
        const baseName = track.name.replace(/\.[^.]+$/, "");
        const txtPath = await join(folderPath, baseName + ".txt");
        track.transcript = (await readTextFile(txtPath)).trim();
      } catch {
        // ファイルが存在しない場合は無視
      }
    }
  }

  return tracks;
}


/** 秒数を mm:ss 形式に変換 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "　";
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
