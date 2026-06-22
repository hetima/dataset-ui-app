import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { dirname, join } from "@tauri-apps/api/path";

/** dataset-ui のルートフォルダにある config.json から読み取る設定 */
export type DatasetUiDirConfig = {
  models_dir?: string;
  outputs_dir?: string;
  train_dir?: string;
};

/** 前後を囲む " を除去する */
export function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** パスがフォルダとして存在するか */
export async function datasetUiPathExists(path: string): Promise<boolean> {
  if (path === "") return false;
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

/** dataset-ui のパスを基準に既定の venv 候補を順番に探す */
export async function findDatasetUiVenvPath(path: string): Promise<string | null> {
  if (path === "") return null;
  try {
    const parentPath = await dirname(path);
    const candidates = [
      await join(path, ".venv"),
      await join(path, "venv"),
      await join(parentPath, ".venv"),
      await join(parentPath, "venv"),
    ];
    for (const candidate of candidates) {
      if (await exists(candidate)) return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * dataset-ui ルートフォルダの config.json を読み込む（読み込みのみ・書き込みはしない）。
 * 読めない場合や該当キーが無い場合は空の設定を返す。
 */
export async function loadDatasetUiDirConfig(path: string): Promise<DatasetUiDirConfig> {
  if (path === "") return {};
  try {
    const configPath = await join(path, "config.json");
    if (!(await exists(configPath))) return {};
    const text = await readTextFile(configPath);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const pick = (key: string): string | undefined =>
      typeof parsed[key] === "string" ? (parsed[key] as string) : undefined;
    return {
      models_dir: pick("models_dir"),
      outputs_dir: pick("outputs_dir"),
      train_dir: pick("train_dir"),
    };
  } catch {
    return {};
  }
}
