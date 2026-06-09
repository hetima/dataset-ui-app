import { readDir, stat, readTextFile, writeTextFile, rename, mkdir, exists } from "@tauri-apps/plugin-fs";
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
    tracks.push({
      path: entryPath,
      name: entry.name,
      duration: 0,
      size: null,
      good: false,
      bad: false,
      transcript: "",
    });
  }

  tracks.sort((a, b) => a.name.localeCompare(b.name));

  // mtdt.json を読み込んでメタデータを反映
  const { map: mtdtMap } = await loadMtdt(folderPath);

  const transcriptFallbackTargets: Track[] = [];
  for (const track of tracks) {
    const rec = mtdtMap.get(track.name);
    if (rec) {
      track.good = rec.good ?? false;
      track.bad = rec.bad ?? false;
      track.duration = rec.duration ?? 0;
      track.transcript = rec.transcript ?? "";
    }

    if (!track.transcript) {
      transcriptFallbackTargets.push(track);
    }
  }

  // transcript が空なら .txt フォールバックを並列で読む
  await Promise.all(
    transcriptFallbackTargets.map(async (track) => {
      try {
        const baseName = track.name.replace(/\.[^.]+$/, "");
        const txtPath = await join(folderPath, baseName + ".txt");
        track.transcript = (await readTextFile(txtPath)).trim();
      } catch {
        // ファイルが存在しない場合は無視
      }
    })
  );

  return tracks;
}

/** ファイルサイズを取得する */
export async function getFileSize(path: string): Promise<number> {
  return (await stat(path)).size;
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

export type MoveRatedResult =
  | { ok: true }
  | { ok: false; conflicts: string[] };

/**
 * good または bad のトラックをサブフォルダに移動する。
 * - 移動先に同名ファイルが存在する場合はエラーを返し何もしない
 * - mtdt.json は移動先にマージ保存、元フォルダからレコードを削除
 * - 移動完了後に元フォルダを scanFolder してリロード用の Track[] を返す
 */
/** 音声ファイルに付随する可能性のあるサイドカーファイルの拡張子 */
const SIDECAR_SUFFIXES = [".txt", ".lyrics.txt", ".json"];

/** 付随ファイルのパス一覧を返す（存在するものだけ） */
async function existingSidecars(folderPath: string, audioName: string): Promise<string[]> {
  const base = audioName.replace(/\.[^.]+$/, "");
  const result: string[] = [];
  for (const suffix of SIDECAR_SUFFIXES) {
    const p = await join(folderPath, base + suffix);
    if (await exists(p)) result.push(p);
  }
  return result;
}

export async function moveRatedFiles(
  folderPath: string,
  tracks: Track[],
  rating: "good" | "bad",
  subFolderName: string,
): Promise<MoveRatedResult & { reloadedTracks?: Track[] }> {
  const targets = tracks.filter((t) => (rating === "good" ? t.good : t.bad));
  if (targets.length === 0) return { ok: true, reloadedTracks: tracks };

  const destDir = await join(folderPath, subFolderName);

  // 衝突チェック（音声ファイル本体のみ。サイドカーは上書き許容）
  const conflicts: string[] = [];
  for (const t of targets) {
    const destPath = await join(destDir, t.name);
    if (await exists(destPath)) conflicts.push(t.name);
  }
  if (conflicts.length > 0) return { ok: false, conflicts };

  // サブフォルダ作成（なければ）
  await mkdir(destDir, { recursive: true });

  // 移動（音声ファイル本体 + 付随ファイル）
  for (const t of targets) {
    await rename(t.path, await join(destDir, t.name));
    for (const sidecarPath of await existingSidecars(folderPath, t.name)) {
      const sidecarName = sidecarPath.replace(/\\/g, "/").split("/").pop()!;
      await rename(sidecarPath, await join(destDir, sidecarName));
    }
  }

  // 移動先 mtdt.json にマージ保存
  const { map: destMap, raw: destRaw } = await loadMtdt(destDir);
  const destAudiofiles: Record<string, object> = { ...(destRaw.audiofiles as object ?? {}) };
  for (const t of targets) {
    const existing = destMap.get(t.name) ?? { filename: t.name };
    destAudiofiles[t.name] = {
      ...existing,
      filename: t.name,
      good: t.good,
      bad: t.bad,
      ...(t.transcript ? { transcript: t.transcript } : {}),
      ...(t.duration > 0 ? { duration: t.duration } : {}),
    };
  }
  const destMtdtPath = await join(destDir, "mtdt.json");
  await writeTextFile(destMtdtPath, JSON.stringify({ ...destRaw, audiofiles: destAudiofiles }, null, 2));

  // 元フォルダの mtdt.json から移動済みレコードを除いて保存
  const remaining = tracks.filter((t) => !(rating === "good" ? t.good : t.bad));
  await saveMtdt(folderPath, remaining);

  // 元フォルダをリロード
  const reloadedTracks = await scanFolder(folderPath);
  return { ok: true, reloadedTracks };
}
