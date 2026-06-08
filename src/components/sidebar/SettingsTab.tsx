const SHORTCUTS = [
  { key: "スペース", desc: "再生 / 一時停止" },
  { key: "↑ / ↓", desc: "前後のトラックに移動" },
  { key: "← /F / G", desc: "Good をトグル" },
  { key: "→ / B", desc: "Bad をトグル" },
  { key: "Del / Backspace / H / C", desc: "Good・Bad をクリア" },
  { key: "L", desc: "再生モードを切り替え（連続 / 1曲 / 通常）" },
  { key: "Ctrl+F", desc: "検索フィールドにフォーカス（再度で解除）" },
  { key: "Esc", desc: "検索クリア / テーブルにフォーカス戻す" },
];

export function SettingsTab() {
  return (
    <div className="px-2 space-y-0">
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
  );
}
