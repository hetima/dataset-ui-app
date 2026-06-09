import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldDescription, FieldGroup, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";

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
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        {section === "general" && (
          <p className="text-xs text-muted-foreground">設定項目はありません</p>
        )}
        {section === "player" && (
          <FieldGroup>
            {/* 移動先フォルダ名 */}
            <FieldSet>
              <FieldLegend variant="label">移動先フォルダ名</FieldLegend>
              <Field orientation="horizontal">
                <FieldTitle className="w-10 shrink-0">Good</FieldTitle>
                <Input
                  className="h-7 text-xs"
                  value={goodFolderName}
                  onChange={(e) => onGoodFolderNameChange(e.target.value)}
                />
              </Field>
              <Field orientation="horizontal">
                <FieldTitle className="w-10 shrink-0">Bad</FieldTitle>
                <Input
                  className="h-7 text-xs"
                  value={badFolderName}
                  onChange={(e) => onBadFolderNameChange(e.target.value)}
                />
              </Field>
            </FieldSet>

            {/* 同期トグル */}
            <Field orientation="horizontal">
              <div className="flex-1">
                <FieldTitle>← / → 同期トグル</FieldTitle>
                <FieldDescription>オンにすると ← / → の挙動が変わります</FieldDescription>
              </div>
              <Switch checked={syncToggle} onCheckedChange={onSyncToggleChange} />
            </Field>

            {/* ショートカットキー */}
            <FieldSet>
              <FieldLegend variant="label">ショートカットキー</FieldLegend>
              {SHORTCUTS.map(({ key, desc }) => (
                <Field key={key} orientation="horizontal">
                  <FieldTitle className="w-48 shrink-0 font-mono">{key}</FieldTitle>
                  <FieldDescription className="whitespace-pre-line">{desc}</FieldDescription>
                </Field>
              ))}
            </FieldSet>
          </FieldGroup>
        )}
      </div>
    </div>
  );
}
