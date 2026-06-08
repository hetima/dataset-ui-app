# オーディオプレイヤー 設計書

作成日: 2026-06-08

## 概要

Tauri + React 製のデスクトップオーディオプレイヤー。フォルダをD&Dしてプレイリストを構築し、キーボードとGUI両方で操作できる。

---

## アーキテクチャ

```
App
├── Header
│   ├── AudioControls（再生・停止・前へ・次へ・リピートボタン、シークバー）
│   ├── NowPlaying（再生中ファイル名）
│   └── SearchField（検索入力）
└── MainContent（横並びレイアウト）
    ├── PlaylistTable（TanStack Table）
    └── DetailPanel（選択ファイルの詳細情報）
```

---

## コンポーネント詳細

### App
- アプリ全体の状態を `useReducer` で一元管理
- `<audio>` 要素を隠し要素として保持し `useRef` で操作
- キーボードイベント（上下キー・スペースバー）をここで受け取る

### Header
- 3つの子コンポーネントを横並びに配置
- 高さ固定、コンテンツエリアの上部に常時表示

### AudioControls
- ボタン: 前へ・再生/停止・次へ・リピート切替・自動再生切替
- シークバー: shadcn `Slider` を使用
- 現在時刻・総再生時間を表示

### NowPlaying
- 再生中トラックのファイル名を表示
- 再生中でなければ空欄

### SearchField
- shadcn `Input` を使用
- 入力値で `tracks` をリアルタイムフィルタリング（フィルタ後の順序で再生）

### PlaylistTable
- `@tanstack/react-table` + shadcn `Table` を使用
- カラム: ファイル名・再生時間（将来的に拡張予定）
- 行クリックで `selectedIndex` を更新（`autoPlay` オンなら即再生）
- 行ダブルクリックで `currentIndex` を更新して再生開始（`autoPlay` オフ時も強制再生）
- 上下キーで `selectedIndex` 移動、Enterで再生
- 再生中行と選択行を別スタイルでハイライト
- カラムヘッダクリックでソート（ソート後の順序で再生）

### DetailPanel
- `selectedIndex` のトラック情報を表示
- 表示項目: ファイル名・フルパス・ファイルサイズ・拡張子
- ファイルサイズは Tauri `tauri-plugin-fs` の `stat` で取得

---

## 状態設計

```typescript
type Track = {
  path: string;       // フルパス
  name: string;       // ファイル名
  duration: number;   // 再生時間（秒）
  size: number;       // ファイルサイズ（バイト）
};

type State = {
  tracks: Track[];
  currentIndex: number | null;  // 再生中トラック
  selectedIndex: number | null; // テーブル選択行
  isPlaying: boolean;
  isRepeat: boolean;
  autoPlay: boolean;            // 選択変更時に即再生するか
  searchQuery: string;
};
```

---

## D&Dフロー

1. Tauri `onDragDropEvent` でドロップされたパスを受け取る
2. パスがフォルダかどうかを `tauri-plugin-fs` で判定
3. フォルダを再帰走査し、音声ファイル（mp3・m4a・flac・wav・ogg・aac・opus）を抽出
4. 各ファイルの `stat` でサイズを取得
5. **Shiftキーなし**: 既存プレイリストを置き換え
6. **Shiftキーあり**: 既存プレイリストの末尾に追加
7. 再生時間は `<audio>` の `loadedmetadata` イベントで非同期取得

---

## 再生フロー

- `currentIndex` が変わると `<audio>` の `src` を差し替えて自動再生
- `ended` イベント発火時:
  - リピートオン: 同トラックを最初から再生
  - リピートオフ: 次のトラックへ（最後のトラックなら停止）
- `timeupdate` イベントでシークバーの現在位置を更新

---

## キーボード操作

| キー | 動作 |
|------|------|
| スペース | 再生/停止トグル |
| 上矢印 | `selectedIndex` を1つ上へ |
| 下矢印 | `selectedIndex` を1つ下へ |
| Enter | `selectedIndex` のトラックを再生 |

---

## 使用ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `@tanstack/react-table` | テーブルのソート・フィルタ |
| `shadcn/ui` | UI コンポーネント（Table・Button・Input・Slider） |
| `tauri-plugin-fs` | フォルダ走査・ファイルstat取得 |
| Web Audio API (`<audio>`) | 音声再生エンジン |

---

## 対応音声フォーマット

mp3・m4a・flac・wav・ogg・aac・opus
