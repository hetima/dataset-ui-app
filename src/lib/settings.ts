import { load, Store } from "@tauri-apps/plugin-store";

const STORE_PATH = "settings.json";
const RECENT_FOLDERS_LIMIT = 16;

/** アプリ設定の読み書きを担当するクラス */
export class AppSettings {
  private constructor(private store: Store) {}

  static async load(): Promise<AppSettings> {
    const store = await load(STORE_PATH, {
      defaults: { volume: 1, folderLibrary: [], recentFolders: [], goodFolderName: "good", badFolderName: "bad", playMode: "stop" },
      autoSave: false,
    });
    return new AppSettings(store);
  }

  async getVolume(): Promise<number> {
    return (await this.store.get<number>("volume")) ?? 1;
  }

  async setVolume(v: number): Promise<void> {
    await this.store.set("volume", v);
    await this.store.save();
  }

  async getFolderLibrary(): Promise<string[]> {
    return (await this.store.get<string[]>("folderLibrary")) ?? [];
  }

  async setFolderLibrary(folders: string[]): Promise<void> {
    await this.store.set("folderLibrary", folders);
    await this.store.save();
  }

  async getRecentFolders(): Promise<string[]> {
    return (await this.store.get<string[]>("recentFolders")) ?? [];
  }

  async getPlayMode(): Promise<string> {
    return (await this.store.get<string>("playMode")) ?? "stop";
  }

  async setPlayMode(mode: string): Promise<void> {
    await this.store.set("playMode", mode);
    await this.store.save();
  }

  async getGoodFolderName(): Promise<string> {
    return (await this.store.get<string>("goodFolderName")) ?? "good";
  }

  async setGoodFolderName(name: string): Promise<void> {
    await this.store.set("goodFolderName", name);
    await this.store.save();
  }

  async getBadFolderName(): Promise<string> {
    return (await this.store.get<string>("badFolderName")) ?? "bad";
  }

  async setBadFolderName(name: string): Promise<void> {
    await this.store.set("badFolderName", name);
    await this.store.save();
  }

  /** 先頭に追加し上限16件を超えたら末尾を削除 */
  async pushRecentFolder(folder: string): Promise<string[]> {
    const current = await this.getRecentFolders();
    const updated = [folder, ...current.filter((f) => f !== folder)].slice(0, RECENT_FOLDERS_LIMIT);
    await this.store.set("recentFolders", updated);
    await this.store.save();
    return updated;
  }
}
