import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const LANGUAGE_OPTIONS = ["ja", "en"] as const;
export type AppLanguage = (typeof LANGUAGE_OPTIONS)[number];

export function isAppLanguage(value: string): value is AppLanguage {
  return (LANGUAGE_OPTIONS as readonly string[]).includes(value);
}

const resources = {
  ja: {
    translation: {
      common: {
        good: "Good",
        bad: "Bad",
        none: "該当なし",
        loading: "読み込み中",
        moving: "移動中",
      },
      tabs: {
        player: "プレイヤー",
        settings: "設定",
      },
      player: {
        stopped: "再生停止中",
        loadingFolder: "フォルダを読み込んでいます...",
        movingFiles: "ファイルを移動しています...",
        itemCount: "{{count}}項目",
        saveComplete: "保存しました",
        conflictMessage: "以下のファイルが移動先に既に存在します:\n{{files}}",
        sidebarWidth: "サイドバー幅",
      },
      controls: {
        stopAfterCurrent: "再生終了後に停止",
        continuousPlayback: "連続再生",
        repeatOne: "1曲リピート",
        stop: "通常",
        continuous: "連続",
        repeat: "1曲",
      },
      search: {
        placeholder: "検索...",
      },
      playlist: {
        fileName: "ファイル名",
        duration: "時間",
        transcript: "テキスト",
      },
      details: {
        selectFile: "ファイルを選択してください",
        fileName: "ファイル名",
        size: "サイズ",
        loading: "取得中...",
        duration: "再生時間",
        transcript: "テキスト",
        lyrics: "歌詞",
      },
      sidebar: {
        folderLibrary: "フォルダライブラリ",
        recentFolders: "最近使ったフォルダ",
        noHistory: "履歴がありません",
        addByDrop: "フォルダをドロップして追加",
        collapse: "折りたたむ",
        expand: "展開",
        reload: "再読み込み",
        removeFromList: "リストから取り除く",
        count: "{{count}}件",
        move: "移動",
        moveToFolder: "「{{folder}}」フォルダに移動",
      },
      settings: {
        sections: {
          general: "全般",
          player: "プレイヤー",
        },
        language: "言語",
        languageDescription: "UI の表示言語を切り替えます",
        japanese: "日本語",
        english: "English",
        theme: "テーマ",
        themeDescription: "アプリの配色を切り替えます",
        light: "ライト",
        dark: "ダーク",
        system: "システム",
        destinationFolderName: "移動先フォルダ名",
        syncToggle: "← / → 同期トグル",
        syncToggleDescription: "オンにすると ← / → の挙動が変わります",
        shortcuts: "ショートカットキー",
        shortcutKeys: {
          space: "SPACE",
        },
        shortcutDescriptions: {
          space: "再生 / 一時停止",
          upDown: "前後のトラックに移動",
          leftRight: "Good / Bad をトグル\n同期トグルをオンにすると挙動が変わります",
          good: "Good をトグル",
          bad: "Bad をトグル",
          clear: "Good・Bad をクリア",
          playMode: "再生モードを切り替え（連続 / 1曲 / 通常）",
          search: "検索フィールドにフォーカス（再度で解除）",
          save: "mtdt.json を保存",
          escape: "検索クリア / テーブルにフォーカス戻す",
        },
      },
    },
  },
  en: {
    translation: {
      common: {
        good: "Good",
        bad: "Bad",
        none: "None",
        loading: "Loading",
        moving: "Moving",
      },
      tabs: {
        player: "Player",
        settings: "Settings",
      },
      player: {
        stopped: "Stopped",
        loadingFolder: "Loading folder...",
        movingFiles: "Moving files...",
        itemCount: "{{count}} items",
        saveComplete: "Saved",
        conflictMessage: "The following files already exist in the destination:\n{{files}}",
        sidebarWidth: "Sidebar width",
      },
      controls: {
        stopAfterCurrent: "Stop after current track",
        continuousPlayback: "Continuous playback",
        repeatOne: "Repeat one",
        stop: "Stop",
        continuous: "Continuous",
        repeat: "Repeat",
      },
      search: {
        placeholder: "Search...",
      },
      playlist: {
        fileName: "File name",
        duration: "Duration",
        transcript: "Text",
      },
      details: {
        selectFile: "Select a file",
        fileName: "File name",
        size: "Size",
        loading: "Loading...",
        duration: "Duration",
        transcript: "Text",
        lyrics: "Lyrics",
      },
      sidebar: {
        folderLibrary: "Folder library",
        recentFolders: "Recent folders",
        noHistory: "No history",
        addByDrop: "Drop folders to add",
        collapse: "Collapse",
        expand: "Expand",
        reload: "Reload",
        removeFromList: "Remove from list",
        count: "{{count}} items",
        move: "Move",
        moveToFolder: "Move to \"{{folder}}\" folder",
      },
      settings: {
        sections: {
          general: "General",
          player: "Player",
        },
        language: "Language",
        languageDescription: "Change the UI display language",
        japanese: "日本語",
        english: "English",
        theme: "Theme",
        themeDescription: "Change the app color scheme",
        light: "Light",
        dark: "Dark",
        system: "System",
        destinationFolderName: "Destination folder names",
        syncToggle: "← / → sync toggle",
        syncToggleDescription: "Changes ← / → behavior when enabled",
        shortcuts: "Keyboard shortcuts",
        shortcutKeys: {
          space: "SPACE",
        },
        shortcutDescriptions: {
          space: "Play / pause",
          upDown: "Move to previous / next track",
          leftRight: "Toggle Good / Bad\nBehavior changes when sync toggle is enabled",
          good: "Toggle Good",
          bad: "Toggle Bad",
          clear: "Clear Good / Bad",
          playMode: "Switch play mode (continuous / repeat one / stop)",
          search: "Focus search field (press again to leave)",
          save: "Save mtdt.json",
          escape: "Clear search / return focus to table",
        },
      },
    },
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: "ja",
  fallbackLng: "ja",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
