import { Input } from "@/components/ui/input";

const SHORTCUTS = [
  { key: "スペース", desc: "再生 / 一時停止" },
  { key: "↑ / ↓", desc: "前後のトラックに移動" },
  { key: "← /F / G", desc: "Good をトグル" },
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
  onGoodFolderNameChange: (name: string) => void;
  onBadFolderNameChange: (name: string) => void;
};

export function SettingsTab({ goodFolderName, badFolderName, onGoodFolderNameChange, onBadFolderNameChange }: Props) {
  return (
    <div className="px-2 space-y-4">
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

      {/* ショートカットキー */}
      <div className="space-y-0">
        <p className="text-xs font-semibold text-muted-foreground mb-3">ショートカットキー</p>
        {SHORTCUTS.map(({ key, desc }, i) => (
          <div key={key}>
            <div className="py-2">
              <p className="text-xs font-mono font-semibold text-foreground">{key}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            {i < SHORTCUTS.length - 1 && <hr className="border-border/50" />}
          </div>
        ))}
      </div>
    </div>
  );
}
