# Audio Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri + React 製デスクトップオーディオプレイヤーを実装する。フォルダD&Dでプレイリストを構築し、キーボードとGUIで再生操作できる。

**Architecture:** `App` が `useReducer` で全状態を管理し、隠し `<audio>` 要素を `useRef` で操作する。`Header`（AudioControls・NowPlaying・SearchField）と `MainContent`（PlaylistTable・DetailPanel）の2エリア構成。

**Tech Stack:** React 19, TypeScript, Tauri v2, tauri-plugin-fs, @tanstack/react-table, shadcn/ui (Table・Button・Input・Slider)

---

## ファイル構成

| パス | 役割 |
|------|------|
| `src/types.ts` | Track・State・Action 型定義 |
| `src/reducer.ts` | useReducer のリデューサー |
| `src/lib/audio.ts` | フォルダ走査・音声ファイル抽出（Tauri fs） |
| `src/components/Header.tsx` | ヘッダーレイアウト |
| `src/components/AudioControls.tsx` | 再生コントロール・シークバー |
| `src/components/NowPlaying.tsx` | 再生中ファイル名表示 |
| `src/components/SearchField.tsx` | 検索入力 |
| `src/components/PlaylistTable.tsx` | TanStack Table プレイリスト |
| `src/components/DetailPanel.tsx` | 選択ファイル詳細情報 |
| `src/App.tsx` | 全体組み立て・audio要素・キーボード・D&D |
| `src-tauri/Cargo.toml` | tauri-plugin-fs 追加 |
| `src-tauri/capabilities/default.json` | fs パーミッション追加 |

---

## Task 1: Tauri 側の準備（tauri-plugin-fs の追加）

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Cargo.toml に tauri-plugin-fs を追加**

`src-tauri/Cargo.toml` の `[dependencies]` に追記:

```toml
tauri-plugin-fs = "2"
```

- [ ] **Step 2: lib.rs でプラグインを登録**

`src-tauri/src/lib.rs` を開いて `tauri_plugin_fs` を登録する。既存の `tauri_plugin_opener` の次の行に追加:

```rust
.plugin(tauri_plugin_fs::init())
```

例（全体像）:
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: capabilities に fs パーミッションを追加**

`src-tauri/capabilities/default.json` の `permissions` 配列に追記:

```json
"fs:default",
"fs:allow-read-dir",
"fs:allow-stat",
"fs:allow-exists"
```

- [ ] **Step 4: ビルドが通ることを確認**

```bash
cd src-tauri && cargo check
```

Expected: エラーなし

---

## Task 2: 型定義とリデューサー

**Files:**
- Create: `src/types.ts`
- Create: `src/reducer.ts`

- [ ] **Step 1: `src/types.ts` を作成**

```typescript
export type Track = {
  path: string;
  name: string;
  duration: number; // 秒
  size: number;     // バイト
};

export type State = {
  tracks: Track[];
  currentIndex: number | null;
  selectedIndex: number | null;
  isPlaying: boolean;
  isRepeat: boolean;
  autoPlay: boolean;
  searchQuery: string;
};

export type Action =
  | { type: "SET_TRACKS"; tracks: Track[] }
  | { type: "APPEND_TRACKS"; tracks: Track[] }
  | { type: "SET_CURRENT"; index: number | null }
  | { type: "SET_SELECTED"; index: number | null }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "TOGGLE_REPEAT" }
  | { type: "TOGGLE_AUTOPLAY" }
  | { type: "SET_SEARCH"; query: string }
  | { type: "UPDATE_DURATION"; index: number; duration: number };
```

- [ ] **Step 2: `src/reducer.ts` を作成**

```typescript
import { State, Action } from "./types";

export const initialState: State = {
  tracks: [],
  currentIndex: null,
  selectedIndex: null,
  isPlaying: false,
  isRepeat: false,
  autoPlay: false,
  searchQuery: "",
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TRACKS":
      return { ...state, tracks: action.tracks, currentIndex: null, selectedIndex: null, isPlaying: false };
    case "APPEND_TRACKS":
      return { ...state, tracks: [...state.tracks, ...action.tracks] };
    case "SET_CURRENT":
      return { ...state, currentIndex: action.index, isPlaying: action.index !== null };
    case "SET_SELECTED":
      return { ...state, selectedIndex: action.index };
    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };
    case "TOGGLE_REPEAT":
      return { ...state, isRepeat: !state.isRepeat };
    case "TOGGLE_AUTOPLAY":
      return { ...state, autoPlay: !state.autoPlay };
    case "SET_SEARCH":
      return { ...state, searchQuery: action.query };
    case "UPDATE_DURATION":
      return {
        ...state,
        tracks: state.tracks.map((t, i) =>
          i === action.index ? { ...t, duration: action.duration } : t
        ),
      };
    default:
      return state;
  }
}
```

---

## Task 3: フォルダ走査ユーティリティ

**Files:**
- Create: `src/lib/audio.ts`

- [ ] **Step 1: `src/lib/audio.ts` を作成**

```typescript
import { readDir, stat } from "@tauri-apps/plugin-fs";
import { Track } from "../types";

const AUDIO_EXTENSIONS = new Set([
  "mp3", "m4a", "flac", "wav", "ogg", "aac", "opus",
]);

function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext);
}

// フォルダを再帰的に走査して音声ファイルの Track[] を返す
export async function scanFolder(folderPath: string): Promise<Track[]> {
  const entries = await readDir(folderPath, { recursive: true });
  const tracks: Track[] = [];

  for (const entry of entries) {
    if (!entry.isFile || !isAudioFile(entry.name)) continue;
    const info = await stat(entry.path);
    tracks.push({
      path: entry.path,
      name: entry.name,
      duration: 0, // loadedmetadata イベントで後から更新
      size: info.size,
    });
  }

  // ファイル名でソートして返す
  tracks.sort((a, b) => a.name.localeCompare(b.name));
  return tracks;
}

// 秒数を mm:ss 形式に変換
export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ファイルサイズを人間が読める形式に変換
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 2: TypeScript エラーがないことを確認**

```bash
pnpm tsc --noEmit
```

Expected: エラーなし（plugin-fs の型が解決される）

---

## Task 4: NowPlaying・SearchField コンポーネント

**Files:**
- Create: `src/components/NowPlaying.tsx`
- Create: `src/components/SearchField.tsx`

- [ ] **Step 1: `src/components/NowPlaying.tsx` を作成**

```tsx
type Props = {
  fileName: string | null;
};

export function NowPlaying({ fileName }: Props) {
  return (
    <div className="flex items-center min-w-0 flex-1 px-4">
      <span className="text-sm text-muted-foreground truncate">
        {fileName ?? "再生停止中"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: `src/components/SearchField.tsx` を作成**

```tsx
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchField({ value, onChange }: Props) {
  return (
    <div className="w-48">
      <Input
        type="search"
        placeholder="検索..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
```

---

## Task 5: AudioControls コンポーネント

**Files:**
- Create: `src/components/AudioControls.tsx`

- [ ] **Step 1: `src/components/AudioControls.tsx` を作成**

```tsx
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/audio";

type Props = {
  isPlaying: boolean;
  isRepeat: boolean;
  autoPlay: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRepeat: () => void;
  onToggleAutoPlay: () => void;
  onSeek: (time: number) => void;
};

export function AudioControls({
  isPlaying,
  isRepeat,
  autoPlay,
  currentTime,
  duration,
  onPlayPause,
  onPrev,
  onNext,
  onToggleRepeat,
  onToggleAutoPlay,
  onSeek,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={onPrev}>⏮</Button>
      <Button variant="ghost" size="icon" onClick={onPlayPause}>
        {isPlaying ? "⏸" : "▶"}
      </Button>
      <Button variant="ghost" size="icon" onClick={onNext}>⏭</Button>
      <Button
        variant={isRepeat ? "default" : "ghost"}
        size="icon"
        onClick={onToggleRepeat}
        title="1曲リピート"
      >
        🔂
      </Button>
      <Button
        variant={autoPlay ? "default" : "ghost"}
        size="icon"
        onClick={onToggleAutoPlay}
        title="選択時に自動再生"
      >
        ▶️
      </Button>
      <span className="text-xs text-muted-foreground w-10 text-right">
        {formatDuration(currentTime)}
      </span>
      <Slider
        className="w-32"
        min={0}
        max={duration || 1}
        step={1}
        value={[currentTime]}
        onValueChange={([v]) => onSeek(v)}
      />
      <span className="text-xs text-muted-foreground w-10">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
```

---

## Task 6: Header コンポーネント

**Files:**
- Create: `src/components/Header.tsx`

- [ ] **Step 1: `src/components/Header.tsx` を作成**

```tsx
import { AudioControls } from "./AudioControls";
import { NowPlaying } from "./NowPlaying";
import { SearchField } from "./SearchField";

type Props = {
  isPlaying: boolean;
  isRepeat: boolean;
  autoPlay: boolean;
  currentTime: number;
  duration: number;
  nowPlayingName: string | null;
  searchQuery: string;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRepeat: () => void;
  onToggleAutoPlay: () => void;
  onSeek: (time: number) => void;
  onSearchChange: (query: string) => void;
};

export function Header(props: Props) {
  return (
    <header className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
      <AudioControls
        isPlaying={props.isPlaying}
        isRepeat={props.isRepeat}
        autoPlay={props.autoPlay}
        currentTime={props.currentTime}
        duration={props.duration}
        onPlayPause={props.onPlayPause}
        onPrev={props.onPrev}
        onNext={props.onNext}
        onToggleRepeat={props.onToggleRepeat}
        onToggleAutoPlay={props.onToggleAutoPlay}
        onSeek={props.onSeek}
      />
      <NowPlaying fileName={props.nowPlayingName} />
      <SearchField value={props.searchQuery} onChange={props.onSearchChange} />
    </header>
  );
}
```

---

## Task 7: DetailPanel コンポーネント

**Files:**
- Create: `src/components/DetailPanel.tsx`

- [ ] **Step 1: `src/components/DetailPanel.tsx` を作成**

```tsx
import { Track } from "@/types";
import { formatSize, formatDuration } from "@/lib/audio";

type Props = {
  track: Track | null;
};

export function DetailPanel({ track }: Props) {
  if (!track) {
    return (
      <div className="w-64 shrink-0 border-l p-4 text-sm text-muted-foreground">
        ファイルを選択してください
      </div>
    );
  }

  const ext = track.name.split(".").pop()?.toUpperCase() ?? "";

  return (
    <div className="w-64 shrink-0 border-l p-4 text-sm space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">ファイル名</p>
        <p className="break-all">{track.name}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">パス</p>
        <p className="break-all text-xs">{track.path}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">サイズ</p>
        <p>{formatSize(track.size)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">再生時間</p>
        <p>{formatDuration(track.duration)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">形式</p>
        <p>{ext}</p>
      </div>
    </div>
  );
}
```

---

## Task 8: PlaylistTable コンポーネント

**Files:**
- Create: `src/components/PlaylistTable.tsx`

- [ ] **Step 1: PlaylistTable を作成**

```tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Track } from "@/types";
import { formatDuration } from "@/lib/audio";

type Props = {
  tracks: Track[];
  currentIndex: number | null;
  selectedIndex: number | null;
  searchQuery: string;
  onSelect: (index: number) => void;
  onPlay: (index: number) => void;
};

const columnHelper = createColumnHelper<Track>();

const columns = [
  columnHelper.accessor("name", {
    header: "ファイル名",
    cell: (info) => <span className="truncate block max-w-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor("duration", {
    header: "時間",
    cell: (info) => formatDuration(info.getValue()),
    size: 80,
  }),
];

export function PlaylistTable({
  tracks,
  currentIndex,
  selectedIndex,
  searchQuery,
  onSelect,
  onPlay,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting, globalFilter: searchQuery },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const originalIndex = tracks.indexOf(row.original);
            const isSelected = originalIndex === selectedIndex;
            const isCurrent = originalIndex === currentIndex;
            return (
              <TableRow
                key={row.id}
                className={
                  isCurrent
                    ? "bg-primary/20 font-semibold"
                    : isSelected
                    ? "bg-muted"
                    : "cursor-pointer"
                }
                onClick={() => onSelect(originalIndex)}
                onDoubleClick={() => onPlay(originalIndex)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## Task 9: App.tsx — 全体組み立て

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: App.tsx を全面的に書き換える**

```tsx
import { useReducer, useRef, useEffect, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { reducer, initialState } from "./reducer";
import { scanFolder } from "./lib/audio";
import { Header } from "./components/Header";
import { PlaylistTable } from "./components/PlaylistTable";
import { DetailPanel } from "./components/DetailPanel";
import "./App.css";

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTimeRef = useRef(0);
  const [currentTime, setCurrentTime] = useStateRef(0);

  // 再生中トラックの変化に追従して audio src を更新
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.currentIndex === null) {
      audio.pause();
      return;
    }
    const track = state.tracks[state.currentIndex];
    if (!track) return;
    audio.src = `asset://localhost/${encodeURIComponent(track.path)}`;
    if (state.isPlaying) audio.play();
  }, [state.currentIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.isPlaying) {
      audio.play();
    } else {
      audio.pause();
    }
  }, [state.isPlaying]);

  // 再生終了イベント
  const handleEnded = useCallback(() => {
    if (state.isRepeat && state.currentIndex !== null) {
      audioRef.current?.play();
      return;
    }
    const next = state.currentIndex !== null ? state.currentIndex + 1 : null;
    if (next !== null && next < state.tracks.length) {
      dispatch({ type: "SET_CURRENT", index: next });
    } else {
      dispatch({ type: "SET_PLAYING", playing: false });
    }
  }, [state.isRepeat, state.currentIndex, state.tracks.length]);

  // loadedmetadata で duration を取得して state を更新
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || state.currentIndex === null) return;
    dispatch({ type: "UPDATE_DURATION", index: state.currentIndex, duration: audio.duration });
  }, [state.currentIndex]);

  // timeupdate
  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(audioRef.current?.currentTime ?? 0);
  }, []);

  // D&D
  useEffect(() => {
    const unlisten = appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type !== "drop") return;
      const paths = event.payload.paths;
      const shiftHeld = (event.payload as any).modifiers?.shift ?? false;
      const allTracks = [];
      for (const p of paths) {
        try {
          const tracks = await scanFolder(p);
          allTracks.push(...tracks);
        } catch {
          // ファイルが渡された場合などは無視
        }
      }
      if (allTracks.length === 0) return;
      if (shiftHeld) {
        dispatch({ type: "APPEND_TRACKS", tracks: allTracks });
      } else {
        dispatch({ type: "SET_TRACKS", tracks: allTracks });
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // キーボード操作
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYING", playing: !state.isPlaying });
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        const next = state.selectedIndex !== null ? Math.max(0, state.selectedIndex - 1) : 0;
        handleSelect(next);
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        const next = state.selectedIndex !== null
          ? Math.min(state.tracks.length - 1, state.selectedIndex + 1)
          : 0;
        handleSelect(next);
      }
      if (e.code === "Enter" && state.selectedIndex !== null) {
        dispatch({ type: "SET_CURRENT", index: state.selectedIndex });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.isPlaying, state.selectedIndex, state.tracks.length, state.autoPlay]);

  const handleSelect = useCallback((index: number) => {
    dispatch({ type: "SET_SELECTED", index });
    if (state.autoPlay) {
      dispatch({ type: "SET_CURRENT", index });
    }
  }, [state.autoPlay]);

  const handlePlayPause = () => dispatch({ type: "SET_PLAYING", playing: !state.isPlaying });
  const handlePrev = () => {
    if (state.currentIndex !== null && state.currentIndex > 0) {
      dispatch({ type: "SET_CURRENT", index: state.currentIndex - 1 });
    }
  };
  const handleNext = () => {
    if (state.currentIndex !== null && state.currentIndex < state.tracks.length - 1) {
      dispatch({ type: "SET_CURRENT", index: state.currentIndex + 1 });
    }
  };
  const handleSeek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const nowPlayingTrack = state.currentIndex !== null ? state.tracks[state.currentIndex] : null;
  const selectedTrack = state.selectedIndex !== null ? state.tracks[state.selectedIndex] : null;

  return (
    <div className="flex flex-col h-screen">
      <Header
        isPlaying={state.isPlaying}
        isRepeat={state.isRepeat}
        autoPlay={state.autoPlay}
        currentTime={currentTime}
        duration={nowPlayingTrack?.duration ?? 0}
        nowPlayingName={nowPlayingTrack?.name ?? null}
        searchQuery={state.searchQuery}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        onToggleRepeat={() => dispatch({ type: "TOGGLE_REPEAT" })}
        onToggleAutoPlay={() => dispatch({ type: "TOGGLE_AUTOPLAY" })}
        onSeek={handleSeek}
        onSearchChange={(q) => dispatch({ type: "SET_SEARCH", query: q })}
      />
      <div className="flex flex-1 overflow-hidden">
        <PlaylistTable
          tracks={state.tracks}
          currentIndex={state.currentIndex}
          selectedIndex={state.selectedIndex}
          searchQuery={state.searchQuery}
          onSelect={handleSelect}
          onPlay={(index) => dispatch({ type: "SET_CURRENT", index })}
        />
        <DetailPanel track={selectedTrack} />
      </div>
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
      />
    </div>
  );
}

// currentTime 用の軽量ステートヘルパー
function useStateRef(initial: number): [number, (v: number) => void] {
  const [val, setVal] = import("react").then(({ useState }) => useState(initial)) as any;
  return [val, setVal];
}
```

> **注意:** `useStateRef` のインライン実装は不完全です。次の Step で正しい実装に置き換えます。

- [ ] **Step 2: currentTime の管理を useState に修正**

`useStateRef` は削除し、通常の `useState` を使います。App.tsx 冒頭の import を修正:

```tsx
import { useReducer, useRef, useEffect, useCallback, useState } from "react";
```

`useStateRef` 呼び出し部分を削除して以下に置き換え:

```tsx
const [currentTime, setCurrentTime] = useState(0);
```

ファイル末尾の `useStateRef` 関数定義も削除します。

- [ ] **Step 3: TypeScript エラーがないことを確認**

```bash
pnpm tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: dev サーバーで動作確認（フロントエンドのみ）**

```bash
pnpm dev
```

ブラウザで画面が表示されることを確認する。

---

## Task 10: asset プロトコルの設定とフル動作確認

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: asset プロトコルを有効化**

`src-tauri/tauri.conf.json` の `app.security` に追記:

```json
"assetProtocol": {
  "enable": true,
  "scope": ["**"]
}
```

- [ ] **Step 2: Tauri アプリ全体を起動して動作確認**

```bash
pnpm tauri dev
```

以下を順に確認:
1. アプリが起動する
2. 音声ファイルが入ったフォルダをウィンドウにD&Dするとプレイリストに表示される
3. 行をダブルクリックすると再生が始まる
4. スペースバーで停止・再開できる
5. 上下キーで選択行が移動する
6. シークバーが再生位置に追従する
7. Shiftキーを押しながらD&Dすると追記される
8. 自動再生ボタンをオンにして行クリックで即再生される

---

## 自己レビュー結果

- **スペックカバレッジ:** 全要件をタスクに対応済み
- **プレースホルダー:** Task 9 Step 1 の `useStateRef` は Step 2 で即修正する流れで記載済み
- **型の一貫性:** `Track`・`State`・`Action` は Task 2 で定義し、以降は import して使用

