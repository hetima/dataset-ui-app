import { useState, useEffect, useRef, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import {
  searchLyrics,
  cancelLyricsSearch,
  type LyricsResult,
  type LyricsSource,
} from "@/lib/lyrics";

const LIST_DEFAULT_HEIGHT = 128; // 約4行
const LIST_MIN_HEIGHT = 48;
const LIST_MAX_HEIGHT = 400;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 検索クエリ（曲名 / アーティスト） */
  title: string;
  artist: string;
  /** 非空ならフリーワード検索に切り替える */
  free?: string;
  sources: LyricsSource[];
  geniusApiKey: string;
  /** 採用時に呼ばれる。draft=true ならドラフト側へ流し込む */
  onApply: (result: LyricsResult, draft: boolean) => void;
};

export function LyricsSearchSheet({
  open,
  onOpenChange,
  title,
  artist,
  free,
  sources,
  geniusApiKey,
  onApply,
}: Props) {
  const { t } = useTranslation();
  const [results, setResults] = useState<LyricsResult[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>("");
  // 検索結果リストの高さ（ドラッグでリサイズ可能）
  const [listHeight, setListHeight] = useState(LIST_DEFAULT_HEIGHT);
  // 結果が反映される前に Sheet を閉じた場合に古いコールバックを無視するためのフラグ
  const activeRef = useRef(false);

  // Sheet が開いたら検索を開始する
  useEffect(() => {
    if (!open) return;
    activeRef.current = true;
    setResults([]);
    setSelected(null);
    setError("");
    setSearching(true);

    searchLyrics({ title, artist, free, sources, geniusApiKey }, (msg) => {
      if (!activeRef.current) return;
      if (msg.event === "result") {
        setResults((prev) => {
          const next = [...prev, msg.data];
          // 最初の結果を自動選択する
          if (prev.length === 0) setSelected(0);
          return next;
        });
      } else if (msg.event === "sourceError") {
        setError((prev) => (prev ? `${prev}\n` : "") + `${msg.data.source}: ${msg.data.message}`);
      } else if (msg.event === "done") {
        setSearching(false);
      }
    }).catch((e) => {
      if (activeRef.current) {
        setError(String(e));
        setSearching(false);
      }
    });

    return () => {
      activeRef.current = false;
    };
  }, [open]);

  // 閉じる（＝キャンセル）。検索中ならバックエンドも中断する
  const handleClose = () => {
    activeRef.current = false;
    if (searching) cancelLyricsSearch();
    onOpenChange(false);
  };

  // 結果リストとプレビューの境界をドラッグして高さを調整する
  const handleResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = listHeight;
    const handlePointerMove = (event: PointerEvent) => {
      const next = startHeight + event.clientY - startY;
      setListHeight(Math.max(LIST_MIN_HEIGHT, Math.min(LIST_MAX_HEIGHT, next)));
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [listHeight]);

  const current = selected !== null ? results[selected] : null;

  const handleApply = (draft: boolean) => {
    if (!current) return;
    onApply(current, draft);
    handleClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!w-1/2 !max-w-none p-0 gap-0"
      >
        {/* ヘッダ: プログレス + キャンセル / ドラフトに保存 / 保存 */}
        <div className="flex items-center gap-2 border-b p-3">
          <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="text-muted-foreground truncate">{t("lyricsSearch.searching")}</span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">
                {t("lyricsSearch.resultCount", { count: results.length })}
              </span>
            )}
          </div>
          <Button variant="outline" className="text-sm" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="outline" className="text-sm" disabled={!current} onClick={() => handleApply(true)}>
            {t("lyricsSearch.applyDraft")}
          </Button>
          <Button className="text-sm" disabled={!current} onClick={() => handleApply(false)}>
            {t("lyricsSearch.apply")}
          </Button>
        </div>

        {/* エラー表示（通常は隠す） */}
        {error && (
          <div className="flex items-start gap-2 border-b bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span className="whitespace-pre-line flex-1">{error}</span>
            <button onClick={() => setError("")} className="shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 検索結果リスト（高さ可変、超過でスクロール） */}
        <div className="shrink-0 overflow-y-auto" style={{ height: listHeight }}>
          {results.length === 0 && !searching ? (
            <p className="p-3 text-xs text-muted-foreground">{t("lyricsSearch.noResults")}</p>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={cn(
                  "block w-full text-left px-3 py-1.5 text-sm truncate transition-colors",
                  selected === i ? "bg-secondary text-secondary-foreground" : "hover:bg-accent"
                )}
              >
                {r.title}
              </button>
            ))
          )}
        </div>

        {/* リサイズハンドル（結果リスト / プレビュー間） */}
        <div
          className="shrink-0 h-1 cursor-row-resize bg-border hover:bg-primary/50 transition-colors"
          onPointerDown={handleResizeStart}
          role="separator"
          aria-orientation="horizontal"
        />

        {/* プレビュー: lyrics（synced があれば上下2分割） */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <PreviewPane label={t("lyricsSearch.lyrics")} text={current?.lyrics ?? ""} />
          {current?.syncedLyrics && (
            <PreviewPane label={t("lyricsSearch.synced")} text={current.syncedLyrics} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** プレビュー1枚（ラベル + スクロール可能な本文）。高さは flex-1 で等分 */
function PreviewPane({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden border-t first:border-t-0">
      <span className="shrink-0 px-3 py-1 text-xs text-muted-foreground bg-muted/40">{label}</span>
      <pre className="flex-1 overflow-y-auto px-3 py-2 text-sm font-mono whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
