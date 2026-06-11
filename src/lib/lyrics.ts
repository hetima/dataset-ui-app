import { invoke, Channel } from "@tauri-apps/api/core";

/** 歌詞検索の 1 件分の結果 */
export type LyricsResult = {
  title: string;
  lyrics: string;
  syncedLyrics: string | null;
};

/** 検索進捗イベント（Rust の SearchEvent と対応） */
export type SearchEvent =
  | { event: "result"; data: LyricsResult }
  | { event: "sourceError"; data: { source: string; message: string } }
  | { event: "done" };

/** 歌詞検索のソース種別 */
export type LyricsSource = "genius" | "lrclib";

/**
 * 歌詞検索を実行する。見つかった結果は onEvent で逐次通知される。
 * Promise は全ソースの検索完了（Done 送信）後に解決する。
 */
export async function searchLyrics(
  params: { title: string; artist: string; free?: string; sources: LyricsSource[]; geniusApiKey: string },
  onEvent: (event: SearchEvent) => void
): Promise<void> {
  const channel = new Channel<SearchEvent>();
  channel.onmessage = onEvent;
  await invoke("search_lyrics", {
    title: params.title,
    artist: params.artist,
    free: params.free ?? "",
    sources: params.sources,
    geniusApiKey: params.geniusApiKey,
    channel,
  });
}

/** 実行中の歌詞検索をバックエンドで中断する */
export async function cancelLyricsSearch(): Promise<void> {
  await invoke("cancel_lyrics_search");
}
