import { readDir, stat, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { Track } from "../types";

// mtdt.json の audiofiles 配列の1レコード型（既知フィールドのみ）
type MtdtRecord = {
  filename: string;
  transcript?: string;
  good?: boolean;
  bad?: boolean;
  duration?: number;
  [key: string]: unknown;
};

type MtdtFile = {
  audiofiles?: MtdtRecord[];
  [key: string]: unknown;
};

/** mtdt.json を読み込んで filename をキーとしたマップを返す。失敗時は空オブジェクトと元データを返す */
export async function loadMtdt(folderPath: string): Promise<{ map: Map<string, MtdtRecord>; raw: MtdtFile }> {
  const mtdtPath = await join(folderPath, "mtdt.json");
  try {
    const text = await readTextFile(mtdtPath);
    const raw: MtdtFile = JSON.parse(text);
    const map = new Map<string, MtdtRecord>();
    for (const r of raw.audiofiles ?? []) {
      map.set(r.filename, r);
    }
    return { map, raw };
  } catch {
    return { map: new Map(), raw: {} };
  }
}

/** mtdt.json を読み込み→マージ→保存する。存在しないファイルのレコードは削除 */
export async function saveMtdt(folderPath: string, tracks: Track[]): Promise<void> {
  const mtdtPath = await join(folderPath, "mtdt.json");

  // 既存ファイルを読み込む（なければ空）
  let raw: MtdtFile = {};
  try {
    const text = await readTextFile(mtdtPath);
    raw = JSON.parse(text);
  } catch {
    // 存在しない場合は新規作成
  }

  const existingMap = new Map<string, MtdtRecord>();
  for (const r of raw.audiofiles ?? []) {
    existingMap.set(r.filename, r);
  }

  // 現在のトラック一覧でレコードを生成（存在しないファイルは除外）
  const audiofiles: MtdtRecord[] = tracks.map((t) => {
    const existing = existingMap.get(t.name) ?? { filename: t.name };
    return {
      ...existing,
      filename: t.name,
      good: t.good,
      bad: t.bad,
      ...(t.transcript ? { transcript: t.transcript } : {}),
      ...(t.duration > 0 ? { duration: t.duration } : {}),
    };
  });

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
