# voice-preview-app

Tauri v2 + React 19 + TypeScript 製のデスクトップオーディオプレイヤー。

## 技術スタック

- **フロントエンド**: React 19, TypeScript, Vite 7, Tailwind CSS v4
- **デスクトップ**: Tauri v2
- **UI**: shadcn/ui (Table, Button, Input, Slider)
- **テーブル**: @tanstack/react-table（ソート・フィルタ）
- **国際化**: i18next, react-i18next

## 主な機能

- フォルダをウィンドウにD&Dしてプレイリストを構築（Shiftキーで追加）
- 上下キーでリスト選択、スペースバーで再生/停止、Enterで再生
- 1曲リピート、自動再生（選択変更時に即再生）
- 検索フィールドによるリアルタイムフィルタ
- 選択ファイルの詳細情報パネル（パス・サイズ・形式）

## ファイル構成

```
src/
  types.ts              # Track・State・Action 型定義
  reducer.ts            # useReducer のリデューサー
  App.tsx               # 全体組み立て・audio要素・D&D・キーボード
  lib/
    audio.ts            # フォルダ走査・formatDuration・formatSize
  components/
    Header.tsx          # ヘッダーレイアウト
    AudioControls.tsx   # 再生コントロール・シークバー
    NowPlaying.tsx      # 再生中ファイル名表示
    SearchField.tsx     # 検索入力
    PlaylistTable.tsx   # TanStack Table プレイリスト
    DetailPanel.tsx     # 選択ファイル詳細情報
    ui/                 # shadcn/ui コンポーネント
src-tauri/              # Tauri バックエンド（Rust）
docs/
  superpowers/
    specs/              # 設計書
    plans/              # 実装計画
```

## 対応音声フォーマット

mp3, m4a, flac, wav, ogg, aac, opus

## 開発コマンド

```bash
pnpm dev          # フロントエンドのみ起動
pnpm tauri dev    # Tauriアプリとして起動
pnpm build        # TypeScriptビルド
pnpm tauri build  # アプリパッケージング
```

## 状態管理

`App` コンポーネントが `useReducer` で全状態を一元管理する。隠し `<audio>` 要素を `useRef` で操作して再生を制御する。

| 状態 | 説明 |
|------|------|
| `tracks` | プレイリスト全件 |
| `currentIndex` | 再生中トラックのインデックス |
| `selectedIndex` | テーブル選択行のインデックス（再生中とは独立） |
| `isPlaying` | 再生中かどうか |
| `isRepeat` | 1曲リピートかどうか |
| `autoPlay` | 選択変更時に即再生するか |
| `searchQuery` | 検索文字列 |
