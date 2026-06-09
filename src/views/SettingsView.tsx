import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Section = "general" | "player";

const SHORTCUTS = [
  { key: "スペース", desc: "再生 / 一時停止" },
  { key: "↑ / ↓", desc: "前後のトラックに移動" },
  { key: "← / →", desc: "Good / Bad をトグル\n同期トグルをオンにすると挙動が変わります" },
  { key: "← / G", desc: "Good をトグル" },
  { key: "→ / B", desc: "Bad をトグル" },
  { key: "Del / Backspace / H / C", desc: "Good・Bad をクリア" },
  { key: "L", desc: "再生モードを切り替え（連続 / 1曲 / 通常）" },
  { key: "Ctrl+F", desc: "検索フィールドにフォーカス（再度で解除）" },
  { key: "Ctrl+S", desc: "mtdt.json を保存" },
  { key: "Esc", desc: "検索クリア / テーブルにフォーカス戻す" },
];

type Props = {
  goodFolderName: string;
  badFolderName: string;
  syncToggle: boolean;
  onGoodFolderNameChange: (name: string) => void;
  onBadFolderNameChange: (name: string) => void;
  onSyncToggleChange: (v: boolean) => void;
};

export function SettingsView({ goodFolderName, badFolderName, syncToggle, onGoodFolderNameChange, onBadFolderNameChange, onSyncToggleChange }: Props) {
  const [section, setSection] = useState<Section>("general");

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* セクションリスト（左） */}
      <div className="flex flex-col gap-0.5 p-2 w-28 shrink-0 border-r">
        {(["general", "player"] as Section[]).map((s) => (
          <Button
            key={s}
            variant={section === s ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start text-xs h-7"
            onClick={() => setSection(s)}
          >
            {s === "general" ? "全般" : "プレイヤー"}
          </Button>
        ))}
      </div>

      {/* コンテンツ（右） */}
      <div className="flex-1 overflow-y-auto p-3 max-w-2xl mx-auto w-full">
        {section === "general" && (
          <p className="text-xs text-muted-foreground">設定項目はありません</p>
        )}
        {section === "player" && (
          <div className="space-y-4">
            {/* 移動先フォルダ名設定 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">移動先フォルダ名</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8 shrink-0">Good</span>
                  <Input
                    className="h-6 text-xs"
                    value={goodFolderName}
                    onChange={(e) => onGoodFolderNameChange(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8 shrink-0">Bad</span>
                  <Input
                    className="h-6 text-xs"
                    value={badFolderName}
                    onChange={(e) => onBadFolderNameChange(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <hr className="border-border/50" />

            {/* 同期トグル設定 */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">← / → 同期トグル</span>
              <Switch checked={syncToggle} onCheckedChange={onSyncToggleChange} />
            </div>

            <hr className="border-border/50" />

            {/* ショートカットキー */}
            <div className="space-y-0">
              <p className="text-xs font-semibold text-muted-foreground mb-3">ショートカットキー</p>
              {SHORTCUTS.map(({ key, desc }, i) => (
                <div key={key}>
                  <div className="py-2">
                    <p className="text-xs font-mono font-semibold text-foreground">{key}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{desc}</p>
                  </div>
                  {i < SHORTCUTS.length - 1 && <hr className="border-border/50" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
