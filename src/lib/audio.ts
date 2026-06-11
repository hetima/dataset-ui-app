import { readDir, stat, readTextFile, writeTextFile, rename, mkdir, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { Track } from "../types";

// songs キーの1レコード型
type SongRecord = {
  filename?: string;
  transcript?: string;
  good?: boolean;
  bad?: boolean;
  lyrics?: string;
  draft_lyrics?: string;
  synced_lyrics?: string;
  draft_synced_lyrics?: string;
  ttml?: string;
  title?: string;
  album?: string;
  artist?: string;
  duration?: number;
  [key: string]: unknown;
};

// read_m4a_tags コマンドの返り値型
type M4aTags = {
  title: string | null;
  album: string | null;
  artist: string | null;
  lyrics: string | null;
  synced_lyrics: string | null;
};

// mtdt.json: songs は filename をキーとした辞書（audiofiles 等の他キーは管理外として温存）
type MtdtFile = {
  songs?: Record<string, SongRecord> | SongRecord[]; // 旧形式(配列)との互換のためunion
  [key: string]: unknown;
};

/** mtdt.json の songs を filename キーの Map に正規化して返す */
function parseSongs(songs: MtdtFile["songs"]): Map<string, SongRecord> {
  const map = new Map<string, SongRecord>();
  if (!songs) return map;
  if (Array.isArray(songs)) {
    for (const r of songs) if (r.filename) map.set(r.filename, r);
  } else {
    for (const [k, v] of Object.entries(songs)) map.set(k, v as SongRecord);
  }
  return map;
}

/** ファイルパスを親フォルダとファイル名に分ける */
export function splitFilePath(filePath: string): { folderPath: string; fileName: string } {
  const normalized = filePath.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  if (slash < 0) return { folderPath: filePath, fileName: filePath };
  return {
    folderPath: filePath.slice(0, filePath.length - (normalized.length - slash)),
    fileName: normalized.slice(slash + 1),
  };
}

/** mtdt.json を読み込んで filename をキーとした songs マップを返す */
export async function loadMtdt(folderPath: string): Promise<{ songsMap: Map<string, SongRecord>; raw: MtdtFile }> {
  const mtdtPath = await join(folderPath, "mtdt.json");
  try {
    const text = await readTextFile(mtdtPath);
    const raw: MtdtFile = JSON.parse(text);
    return { songsMap: parseSongs(raw.songs), raw };
  } catch {
    return { songsMap: new Map(), raw: {} };
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

  const existingMap = parseSongs(raw.songs);

  // 現在のトラック一覧で辞書を生成（存在しないファイルは除外）
  const songs: Record<string, SongRecord> = {};
  for (const t of tracks) {
    const existing = existingMap.get(t.name) ?? { filename: t.name };
    songs[t.name] = {
      ...existing,
      filename: t.name,
      good: t.good,
      bad: t.bad,
      ...(t.transcript ? { transcript: t.transcript } : {}),
      ...(t.duration > 0 ? { duration: t.duration } : {}),
    };
  }

  const output: MtdtFile = { ...raw, songs };
  await writeTextFile(mtdtPath, JSON.stringify(output, null, 2));
}

/** Track.path の親フォルダごとに mtdt.json を更新する */
export async function saveMtdtByTracks(tracks: Track[], extraFolderPaths: string[] = []): Promise<void> {
  const groups = new Map<string, Track[]>();
  for (const folderPath of extraFolderPaths) {
    groups.set(folderPath, []);
  }
  for (const track of tracks) {
    const { folderPath } = splitFilePath(track.path);
    groups.set(folderPath, [...(groups.get(folderPath) ?? []), track]);
  }

  for (const [folderPath, folderTracks] of groups) {
    const entries = await readDir(folderPath);
    const existingAudioNames = new Set(
      entries
        .filter((entry) => entry.isFile && isAudioFile(entry.name))
        .map((entry) => entry.name)
    );

    const mtdtPath = await join(folderPath, "mtdt.json");
    let raw: MtdtFile = {};
    try {
      raw = JSON.parse(await readTextFile(mtdtPath));
    } catch { /* 存在しない場合は新規作成 */ }

    const existingMap = parseSongs(raw.songs);
    const songs: Record<string, SongRecord> = {};
    for (const [name, record] of existingMap) {
      if (existingAudioNames.has(name)) songs[name] = record;
    }

    for (const track of folderTracks) {
      const { fileName } = splitFilePath(track.path);
      const existing = songs[fileName] ?? existingMap.get(fileName) ?? { filename: fileName };
      songs[fileName] = {
        ...existing,
        filename: fileName,
        good: track.good,
        bad: track.bad,
        ...(track.transcript ? { transcript: track.transcript } : {}),
        ...(track.duration > 0 ? { duration: track.duration } : {}),
      };
    }

    await writeTextFile(mtdtPath, JSON.stringify({ ...raw, songs }, null, 2));
  }
}

/** saveLyricsData に渡す歌詞データ。指定したキーのみ書き換える */
export type LyricsData = {
  lyrics?: string;
  syncedLyrics?: string;
  draftLyrics?: string;
  draftSyncedLyrics?: string;
};

/**
 * 単一ファイルの各種歌詞を保存する。
 * - mtdt.json: 該当 filename レコードの指定キーのみ差し替え（他キー・他レコードは全て温存）
 * - m4a: lyrics は iTunes lyrics タグ、syncedLyrics は freeform LYRICS_SYNCED にも書き込む
 *        （draft 系は mtdt.json のみ）
 */
export async function saveLyricsData(filePath: string, data: LyricsData): Promise<void> {
  const { folderPath, fileName } = splitFilePath(filePath);

  // mtdt.json をそのまま読み込み、該当レコードの指定キーのみ書き換える
  const mtdtPath = await join(folderPath, "mtdt.json");
  let raw: MtdtFile = {};
  try {
    raw = JSON.parse(await readTextFile(mtdtPath));
  } catch { /* 存在しない場合は新規作成 */ }

  // songs が配列形式の場合も辞書に正規化して保存する
  const songsMap = parseSongs(raw.songs);
  const existing = songsMap.get(fileName) ?? { filename: fileName };
  const songs: Record<string, SongRecord> = {};
  for (const [k, v] of songsMap) songs[k] = v;
  songs[fileName] = {
    ...existing,
    filename: fileName,
    ...(data.lyrics !== undefined ? { lyrics: data.lyrics } : {}),
    ...(data.syncedLyrics !== undefined ? { synced_lyrics: data.syncedLyrics } : {}),
    ...(data.draftLyrics !== undefined ? { draft_lyrics: data.draftLyrics } : {}),
    ...(data.draftSyncedLyrics !== undefined ? { draft_synced_lyrics: data.draftSyncedLyrics } : {}),
  };

  await writeTextFile(mtdtPath, JSON.stringify({ ...raw, songs }, null, 2));

  // m4a の場合はタグにも書き込む（lyrics / syncedLyrics のみ）
  if (fileName.toLowerCase().endsWith(".m4a")) {
    if (data.lyrics !== undefined) {
      await invoke("write_m4a_lyrics", { path: filePath, lyrics: data.lyrics });
    }
    if (data.syncedLyrics !== undefined) {
      await invoke("write_m4a_synced_lyrics", { path: filePath, syncedLyrics: data.syncedLyrics });
    }
  }
}

export const AUDIO_EXTENSIONS = new Set([
  "mp3", "m4a", "flac", "wav", "ogg", "aac",
]);

/** ファイル名から音声ファイルかどうか判定 */
export function isAudioFile(name: string): boolean {
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
      tempTranscript: "",
      lyrics: "",
      tempLyrics: "",
      draftLyrics: "",
      syncedLyrics: "",
      draftSyncedLyrics: "",
      ttml: "",
      title: "",
      album: "",
      artist: "",
      dirty: false,
    });
  }

  tracks.sort((a, b) => a.name.localeCompare(b.name));

  // mtdt.json を読み込んでメタデータを反映
  const { songsMap } = await loadMtdt(folderPath);

  const transcriptFallbackTargets: Track[] = [];
  for (const track of tracks) {
    const song = songsMap.get(track.name);
    if (song) {
      track.good = song.good ?? false;
      track.bad = song.bad ?? false;
      track.duration = song.duration ?? 0;
      track.transcript = song.transcript ?? "";
      track.tempTranscript = track.transcript;
      track.lyrics = song.lyrics ?? "";
      track.tempLyrics = track.lyrics;
      track.draftLyrics = song.draft_lyrics ?? "";
      track.syncedLyrics = song.synced_lyrics ?? "";
      track.draftSyncedLyrics = song.draft_synced_lyrics ?? "";
      track.ttml = song.ttml ?? "";
      track.title = song.title ?? "";
      track.album = song.album ?? "";
      track.artist = song.artist ?? "";
    }

    if (!track.transcript) {
      transcriptFallbackTargets.push(track);
    }
  }

  // title/album/artist が空の m4a はファイルから読み取る
  await Promise.all(
    tracks
      .filter((t) => t.name.toLowerCase().endsWith(".m4a") && (!t.title || !t.album || !t.artist || !t.lyrics || !t.syncedLyrics))
      .map(async (track) => {
        try {
          const tags = await invoke<M4aTags>("read_m4a_tags", { path: track.path });
          if (!track.title && tags.title) track.title = tags.title;
          if (!track.album && tags.album) track.album = tags.album;
          if (!track.artist && tags.artist) track.artist = tags.artist;
          if (!track.lyrics && tags.lyrics) track.lyrics = tags.lyrics;
          track.tempLyrics = track.lyrics;
          if (!track.syncedLyrics && tags.synced_lyrics) track.syncedLyrics = tags.synced_lyrics;
        } catch { /* タグ読み取り失敗は無視 */ }
      })
  );

  // transcript が空なら .txt フォールバックを並列で読む
  await Promise.all(
    transcriptFallbackTargets.map(async (track) => {
      try {
        const baseName = track.name.replace(/\.[^.]+$/, "");
        const txtPath = await join(folderPath, baseName + ".txt");
        track.transcript = (await readTextFile(txtPath)).trim();
        track.tempTranscript = track.transcript;
      } catch {
        // ファイルが存在しない場合は無視
      }
    })
  );

  return tracks;
}

/**
 * 単一の音声ファイルパスから Track を生成する（曲情報タブ用）。
 * mtdt.json と m4a タグからメタデータを反映する。
 */
export async function loadTrackFromFile(filePath: string): Promise<Track | null> {
  const normalized = filePath.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  const folderPath = slash >= 0 ? filePath.slice(0, filePath.length - (normalized.length - slash)) : filePath;
  const fileName = normalized.slice(slash + 1);
  if (!isAudioFile(fileName)) return null;

  const track: Track = {
    path: filePath,
    name: fileName,
    duration: 0,
    size: null,
    good: false,
    bad: false,
    transcript: "",
    tempTranscript: "",
    lyrics: "",
    tempLyrics: "",
    draftLyrics: "",
    syncedLyrics: "",
    draftSyncedLyrics: "",
    ttml: "",
    title: "",
    album: "",
    artist: "",
    dirty: false,
  };

  const { songsMap } = await loadMtdt(folderPath);
  const song = songsMap.get(fileName);
  if (song) {
    track.good = song.good ?? false;
    track.bad = song.bad ?? false;
    track.duration = song.duration ?? 0;
    track.transcript = song.transcript ?? "";
    track.tempTranscript = track.transcript;
    track.lyrics = song.lyrics ?? "";
    track.tempLyrics = track.lyrics;
    track.draftLyrics = song.draft_lyrics ?? "";
    track.syncedLyrics = song.synced_lyrics ?? "";
    track.draftSyncedLyrics = song.draft_synced_lyrics ?? "";
    track.ttml = song.ttml ?? "";
    track.title = song.title ?? "";
    track.album = song.album ?? "";
    track.artist = song.artist ?? "";
  }

  // m4a は不足分をタグから補完
  if (fileName.toLowerCase().endsWith(".m4a") && (!track.title || !track.album || !track.artist || !track.lyrics || !track.syncedLyrics)) {
    try {
      const tags = await invoke<M4aTags>("read_m4a_tags", { path: filePath });
      if (!track.title && tags.title) track.title = tags.title;
      if (!track.album && tags.album) track.album = tags.album;
      if (!track.artist && tags.artist) track.artist = tags.artist;
      if (!track.lyrics && tags.lyrics) track.lyrics = tags.lyrics;
      track.tempLyrics = track.lyrics;
      if (!track.syncedLyrics && tags.synced_lyrics) track.syncedLyrics = tags.synced_lyrics;
    } catch { /* タグ読み取り失敗は無視 */ }
  }

  return track;
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
 * - mtdt.json は Track.path の親フォルダを基準に更新する
 * - 移動完了後は移動済みトラックを除いた Track[] を返す
 */
/** 音声ファイルに付随する可能性のあるサイドカーファイルの拡張子 */
const SIDECAR_SUFFIXES = [".txt", ".lyrics.txt", ".json"];

/** 付随ファイルのパス一覧を返す（存在するものだけ） */
async function existingSidecars(folderPath: string, audioName: string): Promise<string[]> {
  const base = audioName.replace(/\.[^.]+$/, "");
  const candidates = await Promise.all(SIDECAR_SUFFIXES.map(async (suffix) => {
    const p = await join(folderPath, base + suffix);
    return (await exists(p)) ? p : null;
  }));
  return candidates.filter((p): p is string => p !== null);
}

export async function moveRatedFiles(
  tracks: Track[],
  rating: "good" | "bad",
  subFolderName: string,
): Promise<MoveRatedResult & { tracks?: Track[] }> {
  const targets = tracks.filter((t) => (rating === "good" ? t.good : t.bad));
  if (targets.length === 0) return { ok: true, tracks };

  // 衝突チェック（音声ファイル本体のみ。サイドカーは上書き許容）
  const conflicts = (await Promise.all(targets.map(async (t) => {
    const { folderPath, fileName } = splitFilePath(t.path);
    const destPath = await join(folderPath, subFolderName, fileName);
    return (await exists(destPath)) ? t.path : null;
  }))).filter((path): path is string => path !== null);
  if (conflicts.length > 0) return { ok: false, conflicts };

  // 移動（音声ファイル本体 + 付随ファイル）
  const movedTracks: Track[] = [];
  const sourceFolders = new Set<string>();
  for (const t of targets) {
    const { folderPath, fileName } = splitFilePath(t.path);
    sourceFolders.add(folderPath);
    const destDir = await join(folderPath, subFolderName);
    const destPath = await join(destDir, fileName);
    await mkdir(destDir, { recursive: true });
    await rename(t.path, destPath);
    for (const sidecarPath of await existingSidecars(folderPath, t.name)) {
      const sidecarName = sidecarPath.replace(/\\/g, "/").split("/").pop()!;
      await rename(sidecarPath, await join(destDir, sidecarName));
    }
    movedTracks.push({ ...t, path: destPath });
  }

  const remaining = tracks.filter((t) => !(rating === "good" ? t.good : t.bad));
  await saveMtdtByTracks([...remaining, ...movedTracks], [...sourceFolders]);

  return { ok: true, tracks: remaining };
}
