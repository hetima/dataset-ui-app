# dataset-ui-app

Tauri v2 + React 19 + TypeScript 製のデスクトップオーディオプレイヤー。

## 技術スタック

- **フロントエンド**: React 19, TypeScript, Vite 7, Tailwind CSS v4
- **デスクトップ**: Tauri v2
- **UI**: shadcn/ui (Table, Button, Input, Slider)
- **テーブル**: @tanstack/react-table（ソート・フィルタ）
- **国際化**: i18next, react-i18next

## 主な機能

- フォルダをウィンドウにD&Dしてプレイリストを構築（Shiftキーで追加）
- 単体音声ファイルのD&Dで歌詞タブを開く
- 上下キーでリスト選択・再生、スペースバーで再生/停止
- 連続再生・1曲リピート・停止の3再生モード
- 検索フィールドによるリアルタイムフィルタ
- good/bad レーティング → サブフォルダへの一括移動
- 詳細情報パネル（右パネル）：transcript の編集、Ctrl+S で mtdt.json 保存
- 歌詞タブ：lyrics の textarea 編集・ファイルごとのピンポイント保存（mtdt.json + m4a タグ）
- m4a ファイルは iTunes タグから title/album/artist/lyrics を読み取り・書き込み（Rust: mp4ameta）

## ファイル構成

```
src/
  types.ts              # Track・State・Action 型定義
  reducer.ts            # useReducer のリデューサー
  App.tsx               # ThemeProvider ルート
  lib/
    audio.ts            # フォルダ走査・saveMtdt・saveLyrics・loadTrackFromFile・format系
    settings.ts         # 設定の読み書き（tauri-plugin-store）
    i18n.ts             # i18next 初期化・翻訳リソース（ja/en）
    theme.ts            # テーマ型定義
    utils.ts            # shadcn/ui ユーティリティ（cn）
  hooks/
    use-mobile.ts       # モバイル判定フック
  views/
    PlayerView.tsx      # メインビュー。useReducer・audio要素・D&D・キーボード・タブ管理
    SongInfoView.tsx    # 歌詞編集タブ。lyrics の textarea 編集・保存・再生ボタン
    SettingsView.tsx    # 設定タブ
  components/
    PlayerSidebar.tsx   # サイドバー全体レイアウト
    Header.tsx          # ヘッダーレイアウト
    AudioControls.tsx   # 再生コントロール・シークバー
    NowPlaying.tsx      # 再生中ファイル名表示
    SearchField.tsx     # 検索入力
    PlaylistTable.tsx   # TanStack Table プレイリスト
    DetailPanel.tsx     # 選択ファイル詳細情報・transcript 編集 textarea
    sidebar/
      FolderLibrary.tsx # フォルダライブラリ一覧
      RatedList.tsx     # good/bad レーティング済みリスト・移動操作
      RecentFolders.tsx # 最近開いたフォルダ
    ui/                 # shadcn/ui コンポーネント
src-tauri/
  src/
    lib.rs              # Tauri コマンド（read_m4a_tags・write_m4a_lyrics）
    main.rs             # エントリーポイント
docs/
  superpowers/
    specs/              # 設計書
    plans/              # 実装計画
```

## 対応音声フォーマット

mp3, m4a, flac, wav, ogg, aac

## 開発コマンド

```bash
pnpm dev          # フロントエンドのみ起動
pnpm tauri dev    # Tauriアプリとして起動
pnpm build        # TypeScriptビルド
pnpm tauri build  # アプリパッケージング
```

## 状態管理

`PlayerView` が `useReducer` で全状態を一元管理する。隠し `<audio>` 要素を `useRef` で操作して再生を制御する。

| 状態 | 説明 |
|------|------|
| `tracks` | プレイリスト全件 |
| `currentIndex` | 再生中/選択中トラックのインデックス |
| `isPlaying` | 再生中かどうか |
| `playMode` | `"stop"` / `"continuous"` / `"repeat"` |
| `searchQuery` | 検索文字列（PlaylistTable のフィルタに使用） |
| `songInfoTrack` | 歌詞タブで編集中のトラック（プレイリストとは独立） |

`Track` 型の主なフィールド：

| フィールド | 説明 |
|---|---|
| `transcript` | テキスト（DetailPanel の textarea で編集・Ctrl+S で保存） |
| `tempTranscript` | 保存済みの transcript のスナップショット（未保存判定用） |
| `lyrics` | 歌詞（歌詞タブで編集・ピンポイント保存） |
| `good` / `bad` | レーティングフラグ |


## mtdt.json

フォルダごとに1個存在するメタデータファイル。`songs` は filename をキーとした辞書形式（旧形式の配列との互換あり）。

```json
{
  "songs": {
    "1.wav": {
      "filename": "1.wav",
      "transcript": "こんにちは",
      "good": true,
      "bad": false,
      "lyrics": "...",
      "duration": 10
    }
  },
  "other_property": {}
}
```

- `transcript` / `good` / `bad` / `duration` / `lyrics` を本アプリで扱う。それ以外のキーも存在する。
- 保存は必ず **読み込み→マージ→書き込み** の手順で行い、管理外キーを消さない。
- 保存時点でフォルダに存在しないファイルのレコードは削除する。
- `transcript` が空の場合は `ファイル名.txt` の内容をフォールバックとして読み込む。

### 保存タイミング

| 操作 | 対象 | 関数 |
|---|---|---|
| Ctrl+S / フォルダ切り替え / ウィンドウ終了 | フォルダ全体 | `saveMtdt` |
| 歌詞タブの保存ボタン | 1ファイルの `lyrics` のみ | `saveLyrics` |


