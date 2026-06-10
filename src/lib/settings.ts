import { load, Store } from "@tauri-apps/plugin-store";
import { isAppLanguage, type AppLanguage } from "./i18n";
import { isAppTheme, type AppTheme } from "./theme";

const STORE_PATH = "settings.json";
const RECENT_FOLDERS_LIMIT = 16;

const APP_KEYS = {
  language: "app.language",
  theme: "app.theme",
  llmBaseUrl: "app.llm.baseUrl",
  llmModel: "app.llm.model",
  llmApiKey: "app.llm.apiKey",
} as const;

const PLAYER_VIEW_KEYS = {
  volume: "playerview.volume",
  folderLibrary: "playerview.folderLibrary",
  recentFolders: "playerview.recentFolders",
  goodFolderName: "playerview.goodFolderName",
  badFolderName: "playerview.badFolderName",
  playMode: "playerview.playMode",
  syncToggle: "playerview.syncToggle",
  sidebarWidth: "playerview.sidebarWidth",
} as const;

/** アプリ設定の読み書きを担当するクラス */
export class AppSettings {
  readonly playerView: PlayerViewSettings;

  private constructor(private store: Store) {
    this.playerView = new PlayerViewSettings(store);
  }

  static async load(): Promise<AppSettings> {
    const store = await load(STORE_PATH, {
      defaults: {
        [PLAYER_VIEW_KEYS.volume]: 1,
        [PLAYER_VIEW_KEYS.folderLibrary]: [],
        [PLAYER_VIEW_KEYS.recentFolders]: [],
        [PLAYER_VIEW_KEYS.goodFolderName]: "good",
        [PLAYER_VIEW_KEYS.badFolderName]: "bad",
        [PLAYER_VIEW_KEYS.playMode]: "stop",
        [PLAYER_VIEW_KEYS.syncToggle]: false,
        [PLAYER_VIEW_KEYS.sidebarWidth]: 0,
        [APP_KEYS.language]: "ja",
        [APP_KEYS.theme]: "system",
        [APP_KEYS.llmBaseUrl]: "",
        [APP_KEYS.llmModel]: "",
        [APP_KEYS.llmApiKey]: "",
      },
      autoSave: false,
    });
    return new AppSettings(store);
  }

  async getLanguage(): Promise<AppLanguage> {
    const language = await this.store.get<string>(APP_KEYS.language);
    return language && isAppLanguage(language) ? language : "ja";
  }

  async setLanguage(language: AppLanguage): Promise<void> {
    await this.store.set(APP_KEYS.language, language);
    await this.store.save();
  }

  async getTheme(): Promise<AppTheme> {
    const theme = await this.store.get<string>(APP_KEYS.theme);
    return theme && isAppTheme(theme) ? theme : "system";
  }

  async setTheme(theme: AppTheme): Promise<void> {
    await this.store.set(APP_KEYS.theme, theme);
    await this.store.save();
  }

  async getLlmBaseUrl(): Promise<string> {
    return (await this.store.get<string>(APP_KEYS.llmBaseUrl)) ?? "";
  }

  async setLlmBaseUrl(baseUrl: string): Promise<void> {
    await this.store.set(APP_KEYS.llmBaseUrl, baseUrl);
    await this.store.save();
  }

  async getLlmModel(): Promise<string> {
    return (await this.store.get<string>(APP_KEYS.llmModel)) ?? "";
  }

  async setLlmModel(model: string): Promise<void> {
    await this.store.set(APP_KEYS.llmModel, model);
    await this.store.save();
  }

  async getLlmApiKey(): Promise<string> {
    return (await this.store.get<string>(APP_KEYS.llmApiKey)) ?? "";
  }

  async setLlmApiKey(apiKey: string): Promise<void> {
    await this.store.set(APP_KEYS.llmApiKey, apiKey);
    await this.store.save();
  }
}

/** PlayerView の設定の読み書きを担当するクラス */
export class PlayerViewSettings {
  constructor(private store: Store) {}

  async getVolume(): Promise<number> {
    return (await this.store.get<number>(PLAYER_VIEW_KEYS.volume)) ?? 1;
  }

  async setVolume(v: number): Promise<void> {
    await this.store.set(PLAYER_VIEW_KEYS.volume, v);
    await this.store.save();
  }

  async getFolderLibrary(): Promise<string[]> {
    return (await this.store.get<string[]>(PLAYER_VIEW_KEYS.folderLibrary)) ?? [];
  }

  async setFolderLibrary(folders: string[]): Promise<void> {
    await this.store.set(PLAYER_VIEW_KEYS.folderLibrary, folders);
    await this.store.save();
  }

  async getRecentFolders(): Promise<string[]> {
    return (await this.store.get<string[]>(PLAYER_VIEW_KEYS.recentFolders)) ?? [];
  }

  async getPlayMode(): Promise<string> {
    return (await this.store.get<string>(PLAYER_VIEW_KEYS.playMode)) ?? "stop";
  }

  async setPlayMode(mode: string): Promise<void> {
    await this.store.set(PLAYER_VIEW_KEYS.playMode, mode);
    await this.store.save();
  }

  async getSyncToggle(): Promise<boolean> {
    return (await this.store.get<boolean>(PLAYER_VIEW_KEYS.syncToggle)) ?? false;
  }

  async setSyncToggle(v: boolean): Promise<void> {
    await this.store.set(PLAYER_VIEW_KEYS.syncToggle, v);
    await this.store.save();
  }

  async getSidebarWidth(): Promise<number> {
    return (await this.store.get<number>(PLAYER_VIEW_KEYS.sidebarWidth)) ?? 0;
  }

  async setSidebarWidth(width: number): Promise<void> {
    await this.store.set(PLAYER_VIEW_KEYS.sidebarWidth, width);
    await this.store.save();
  }

  async getGoodFolderName(): Promise<string> {
    return (await this.store.get<string>(PLAYER_VIEW_KEYS.goodFolderName)) ?? "good";
  }

  async setGoodFolderName(name: string): Promise<void> {
    await this.store.set(PLAYER_VIEW_KEYS.goodFolderName, name);
    await this.store.save();
  }

  async getBadFolderName(): Promise<string> {
    return (await this.store.get<string>(PLAYER_VIEW_KEYS.badFolderName)) ?? "bad";
  }

  async setBadFolderName(name: string): Promise<void> {
    await this.store.set(PLAYER_VIEW_KEYS.badFolderName, name);
    await this.store.save();
  }

  /** 先頭に追加し上限16件を超えたら末尾を削除 */
  async pushRecentFolder(folder: string): Promise<string[]> {
    const current = await this.getRecentFolders();
    const updated = [folder, ...current.filter((f) => f !== folder)].slice(0, RECENT_FOLDERS_LIMIT);
    await this.store.set(PLAYER_VIEW_KEYS.recentFolders, updated);
    await this.store.save();
    return updated;
  }
}
