import { load, Store } from "@tauri-apps/plugin-store";

const STORE_PATH = "settings.json";

/** アプリ設定の読み書きを担当するクラス */
export class AppSettings {
  private constructor(private store: Store) {}

  static async load(): Promise<AppSettings> {
    const store = await load(STORE_PATH, { defaults: { volume: 1 }, autoSave: false });
    return new AppSettings(store);
  }

  async getVolume(): Promise<number> {
    return (await this.store.get<number>("volume")) ?? 1;
  }

  async setVolume(v: number): Promise<void> {
    await this.store.set("volume", v);
    await this.store.save();
  }
}
