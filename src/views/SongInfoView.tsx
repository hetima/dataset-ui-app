import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Track } from "@/types";
import { saveLyricsData } from "@/lib/audio";
import { AppSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { LyricsSearchSheet } from "@/components/LyricsSearchSheet";
import { LyricsSearchButton } from "@/components/LyricsSearchButton";
import type { LyricsResult, LyricsSource } from "@/lib/lyrics";
import { cn } from "@/lib/utils";
import { Play, Pause, Square, SkipBack, SkipForward, Music2, ListMusic, SwatchBook, Hammer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type LyricsTab = "lyrics" | "synced" | "actual" | "draft";

// 4 種の歌詞フィールドのキー
type LyricsKey = "lyrics" | "draftLyrics" | "syncedLyrics" | "draftSyncedLyrics";

// 各タブのアイコン
const TAB_ICONS: Record<LyricsTab, LucideIcon> = {
  lyrics: Music2,
  synced: ListMusic,
  actual: SwatchBook,
  draft: Hammer,
};

// 各タブが左右ペインに表示するフィールドキーと、ペインのラベル翻訳キー
const TAB_PANES: Record<LyricsTab, { left: LyricsKey; right: LyricsKey; leftLabel: string; rightLabel: string }> = {
  // Lyrics / Synced: lyrics 種別を固定し actual | draft を並べる
  lyrics: { left: "lyrics", right: "draftLyrics", leftLabel: "actualLyrics", rightLabel: "draftLyrics" },
  synced: { left: "syncedLyrics", right: "draftSyncedLyrics", leftLabel: "actualSynced", rightLabel: "draftSynced" },
  // Actual / Draft: actual / draft を固定し lyrics | synced を並べる
  actual: { left: "lyrics", right: "syncedLyrics", leftLabel: "actualLyrics", rightLabel: "actualSynced" },
  draft: { left: "draftLyrics", right: "draftSyncedLyrics", leftLabel: "draftLyrics", rightLabel: "draftSynced" },
};

type Props = {
  track: Track | null;
  /** 保存成功時に呼ばれる。プレイヤータブの state と同期するため */
  onSaved: (
    path: string,
    data: { lyrics: string; draftLyrics: string; syncedLyrics: string; draftSyncedLyrics: string }
  ) => void;
  /** 編集中の歌詞をプレイヤー側 state に反映する */
  onLyricsChange: (
    path: string,
    data: { lyrics: string; draftLyrics: string; syncedLyrics: string; draftSyncedLyrics: string }
  ) => void;
  /** 現在プレイヤーで再生/選択中のトラック */
  currentTrack: Track | null;
  isPlaying: boolean;
  /** 再生トグル。編集中トラック == 再生中トラックなら pause/resume、それ以外はこの曲を再生する */
  onTogglePlay: (track: Track) => void;
  /** 前の曲へ送る */
  onPrev: () => void;
  /** 次の曲へ送る */
  onNext: () => void;
  /** 編集対象トラックが再生リストに属しているか（false なら曲送り不可） */
  canSkip: boolean;
};

export function SongInfoView({ track, onSaved, onLyricsChange, currentTrack, isPlaying, onTogglePlay, onPrev, onNext, canSkip }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LyricsTab>("lyrics");
  const [lyrics, setLyrics] = useState("");
  const [draftLyrics, setDraftLyrics] = useState("");
  const [syncedLyrics, setSyncedLyrics] = useState("");
  const [draftSyncedLyrics, setDraftSyncedLyrics] = useState("");
  const [saving, setSaving] = useState(false);
  const [geniusApiKey, setGeniusApiKey] = useState("");
  const [useGenius, setUseGenius] = useState(false);
  const [useLrclib, setUseLrclib] = useState(false);
  const [useYtmusic, setUseYtmusic] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  // 実際に検索に使う曲名 / アーティスト（通常はトラック値、カスタム検索時はダイアログ入力値）
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");

  // 対象トラックが切り替わったら各 textarea を同期する
  useEffect(() => {
    setLyrics(track?.lyrics ?? "");
    setDraftLyrics(track?.draftLyrics ?? "");
    setSyncedLyrics(track?.syncedLyrics ?? "");
    setDraftSyncedLyrics(track?.draftSyncedLyrics ?? "");
  }, [track?.path, track?.lyrics, track?.draftLyrics, track?.syncedLyrics, track?.draftSyncedLyrics]);

  // 歌詞検索の設定を読み込む
  useEffect(() => {
    (async () => {
      const settings = await AppSettings.load();
      setGeniusApiKey(await settings.getGeniusApiKey());
      setUseGenius(await settings.getLyricsUseGenius());
      setUseLrclib(await settings.getLyricsUseLrclib());
      setUseYtmusic(await settings.getLyricsUseYtmusic());
    })();
  }, []);

  // フィールドキー → 値 / setter のマップ（ペイン描画で参照する）
  const lyricsValues: Record<LyricsKey, string> = { lyrics, draftLyrics, syncedLyrics, draftSyncedLyrics };
  const lyricsSetters: Record<LyricsKey, (v: string) => void> = {
    lyrics: setLyrics,
    draftLyrics: setDraftLyrics,
    syncedLyrics: setSyncedLyrics,
    draftSyncedLyrics: setDraftSyncedLyrics,
  };

  const updateLyricsField = (key: LyricsKey, value: string) => {
    if (!track) return;
    const next = {
      lyrics,
      draftLyrics,
      syncedLyrics,
      draftSyncedLyrics,
      [key]: value,
    };
    lyricsSetters[key](value);
    onLyricsChange(track.path, next);
  };

  const geniusDisabled = geniusApiKey.trim() === "";

  const handleUseGeniusChange = async (v: boolean) => {
    setUseGenius(v);
    const settings = await AppSettings.load();
    await settings.setLyricsUseGenius(v);
  };

  const handleUseLrclibChange = async (v: boolean) => {
    setUseLrclib(v);
    const settings = await AppSettings.load();
    await settings.setLyricsUseLrclib(v);
  };

  const handleUseYtmusicChange = async (v: boolean) => {
    setUseYtmusic(v);
    const settings = await AppSettings.load();
    await settings.setLyricsUseYtmusic(v);
  };

  if (!track) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <p>{t("songInfo.noTrack")}</p>
        <p className="text-xs">{t("songInfo.hint")}</p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLyricsData(track.path, { lyrics, draftLyrics, syncedLyrics, draftSyncedLyrics });
      onSaved(track.path, { lyrics, draftLyrics, syncedLyrics, draftSyncedLyrics });
      toast.success(t("songInfo.saveComplete"));
    } catch (e) {
      console.error("saveLyrics failed:", e);
      toast.error(t("songInfo.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // 検索に使うソース（設定のチェック状態から導出）
  const searchSources: LyricsSource[] = [
    ...(useGenius && !geniusDisabled ? (["genius"] as const) : []),
    ...(useLrclib ? (["lrclib"] as const) : []),
    ...(useYtmusic ? (["ytmusic"] as const) : []),
  ];

  // トラックから導出する既定の曲名（title 空ならファイル名・拡張子抜き）
  const defaultTitle = track.title || track.name.replace(/\.[^.]+$/, "");

  const handleOpenSearch = (title: string, artist: string) => {
    setSearchTitle(title);
    setSearchArtist(artist);
    setSearchOpen(true);
  };

  // 検索結果の採用。lyrics / synced 両方を Actual または Draft 側へ流し込む
  const handleApplyResult = (result: LyricsResult, draft: boolean) => {
    if (!track) return;
    if (draft) {
      setDraftLyrics(result.lyrics);
      setDraftSyncedLyrics(result.syncedLyrics ?? "");
      onLyricsChange(track.path, {
        lyrics,
        draftLyrics: result.lyrics,
        syncedLyrics,
        draftSyncedLyrics: result.syncedLyrics ?? "",
      });
    } else {
      setLyrics(result.lyrics);
      setSyncedLyrics(result.syncedLyrics ?? "");
      onLyricsChange(track.path, {
        lyrics: result.lyrics,
        draftLyrics,
        syncedLyrics: result.syncedLyrics ?? "",
        draftSyncedLyrics,
      });
    }
  };

  // ヘッダ表示用の title|album|artist（空はスキップして | 区切り）
  const metaLine = [track.title, track.album, track.artist].filter(Boolean).join(" | ");

  const isSameTrack = currentTrack?.path === track.path;
  // 再生ボタンのアイコンとtitle
  let PlayIcon = Play;
  let playTitle = "再生";
  if (isSameTrack) {
    PlayIcon = isPlaying ? Pause : Play;
    playTitle = isPlaying ? "一時停止" : "再生";
  } else if (isPlaying) {
    PlayIcon = Square;
    playTitle = "停止";
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 border-b px-4 py-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm break-all">{track.name}</p>
            {metaLine && <p className="text-sm text-muted-foreground break-all">{metaLine}</p>}
          </div>
          <div className="flex items-center shrink-0">
            <Button variant="ghost" size="icon" onClick={onPrev} disabled={!canSkip} title="前の曲">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTogglePlay(track)}
              title={playTitle}
            >
              <PlayIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNext} disabled={!canSkip} title="次の曲">
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
        {/* 第二ヘッダ: Lyrics/Synced タブ切替 ＋ 検索/保存アクション */}
        <div className="flex items-center justify-between">
          {/* タブ: (Lyrics|Synced) と (Actual|Draft) の2グループ。選択は全体で排他 */}
          <div className="flex items-center gap-2">
            <TabGroup tabs={["lyrics", "synced"]} active={tab} onSelect={setTab} t={t} />
            <TabGroup tabs={["actual", "draft"]} active={tab} onSelect={setTab} t={t} />
          </div>
          <div className="flex items-center gap-2">
            <LyricsSearchButton
              disabled={searchSources.length === 0}
              geniusDisabled={geniusDisabled}
              useGenius={useGenius}
              useLrclib={useLrclib}
              useYtmusic={useYtmusic}
              defaultTitle={defaultTitle}
              defaultArtist={track.artist}
              onSearch={handleOpenSearch}
              onUseGeniusChange={handleUseGeniusChange}
              onUseLrclibChange={handleUseLrclibChange}
              onUseYtmusicChange={handleUseYtmusicChange}
            />
            <Button onClick={handleSave} disabled={saving} className="text-sm">
              {t("songInfo.save")}
            </Button>
          </div>
        </div>
        {/* メイン: タブに応じた2フィールドを左右2分割 */}
        <div className="flex flex-1 overflow-hidden gap-3">
          <LyricsPane
            label={t(`songInfo.paneLabel.${TAB_PANES[tab].leftLabel}`)}
            value={lyricsValues[TAB_PANES[tab].left]}
            onChange={(value) => updateLyricsField(TAB_PANES[tab].left, value)}
            synced={TAB_PANES[tab].left === "syncedLyrics" || TAB_PANES[tab].left === "draftSyncedLyrics"}
          />
          <LyricsPane
            label={t(`songInfo.paneLabel.${TAB_PANES[tab].rightLabel}`)}
            value={lyricsValues[TAB_PANES[tab].right]}
            onChange={(value) => updateLyricsField(TAB_PANES[tab].right, value)}
            synced={TAB_PANES[tab].right === "syncedLyrics" || TAB_PANES[tab].right === "draftSyncedLyrics"}
          />
        </div>
      </div>

      <LyricsSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={searchTitle}
        artist={searchArtist}
        sources={searchSources}
        geniusApiKey={geniusApiKey}
        onApply={handleApplyResult}
      />

    </div>
  );
}

/** タブボタンのグループ（枠で囲った排他ボタン群） */
function TabGroup({
  tabs,
  active,
  onSelect,
  t,
}: {
  tabs: LyricsTab[];
  active: LyricsTab;
  onSelect: (tab: LyricsTab) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex items-stretch rounded-sm border overflow-hidden">
      {tabs.map((value) => {
        const Icon = TAB_ICONS[value];
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-7 text-sm transition-colors",
              active === value
                ? "bg-secondary text-secondary-foreground font-bold"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            <Icon className="w-4 h-4" />
            {t(`songInfo.tab.${value}`)}
          </button>
        );
      })}
    </div>
  );
}

// セクションタグの候補リスト
const SECTION_CANDIDATES = [
  "[Intro]", "[Verse]", "[Chorus]", "[Pre-Chorus]", "[Bridge]", "[Outro]",
  "[Hook]", "[End]", "[Interlude]", "[Transition]", "[Modulation]", "[Drop]",
  "[Build-up]", "[Solo]", "[Guitar Solo]", "[Piano Solo]", "[Instrumental]",
  "[Break]", "[Fade Out]", "[Refrain]", "[Male Voice]", "[Female Voice]", "[Rap]",
];

/** Actual / Draft それぞれの歌詞編集ペイン（ラベル + textarea）。
 * synced=true の場合はセクションタグ補完を無効化する。 */
function LyricsPane({
  label,
  value,
  onChange,
  synced = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  synced?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // [ のあとに入力した文字列（null = 補完非アクティブ）
  const [query, setQuery] = useState<string | null>(null);
  // カーソル直前の [ の位置
  const bracketPosRef = useRef<number>(-1);
  const [activeIdx, setActiveIdx] = useState(0);
  // ポップアップ表示座標（textarea 左上基準）
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  const candidates = query === null
    ? []
    : SECTION_CANDIDATES.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  // 候補リストが変わったら選択を先頭に戻す
  useEffect(() => { setActiveIdx(0); }, [candidates.length]);

  // ミラー要素でカーソルの座標を計算する
  const calcPopupPos = useCallback((ta: HTMLTextAreaElement, cursorPos: number) => {
    const mirror = mirrorRef.current;
    if (!mirror) return;

    // ミラーに textarea のスタイルをコピー
    const style = window.getComputedStyle(ta);
    mirror.style.width = ta.offsetWidth + "px";
    mirror.style.font = style.font;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.padding = style.padding;
    mirror.style.border = style.border;
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflowWrap = "break-word";
    mirror.style.boxSizing = "border-box";

    // カーソル位置までのテキストを入れてスパンでマーク
    const before = ta.value.slice(0, cursorPos);
    mirror.innerHTML = "";
    const textNode = document.createTextNode(before);
    const span = document.createElement("span");
    span.textContent = "​"; // zero-width space でスパン高さを確保
    mirror.appendChild(textNode);
    mirror.appendChild(span);

    // スクロール量を合わせる
    mirror.scrollTop = ta.scrollTop;

    const taRect = ta.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    setPopupPos({
      top: spanRect.bottom - taRect.top,
      left: spanRect.left - taRect.left,
    });
  }, []);

  // 候補を選択して textarea に流し込む
  const applyCandidate = useCallback((candidate: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = bracketPosRef.current;
    const before = value.slice(0, pos);
    const after = value.slice(ta.selectionEnd);
    const next = before + candidate + after;
    onChange(next);
    setQuery(null);
    setPopupPos(null);
    // カーソルを候補末尾に移動（次の render 後）
    const newPos = pos + candidate.length;
    requestAnimationFrame(() => {
      ta.setSelectionRange(newPos, newPos);
      ta.focus();
    });
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query === null) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, candidates.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (candidates.length > 0) {
        e.preventDefault();
        applyCandidate(candidates[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setQuery(null);
      setPopupPos(null);
    }
  }, [query, candidates, activeIdx, applyCandidate]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!synced) {
      const ta = e.target;
      const cursor = ta.selectionStart;
      const textBefore = ta.value.slice(0, cursor);
      // カーソル直前の [ を探す（改行や ] をまたがない）
      const bracketMatch = textBefore.match(/\[([^\]\n]*)$/);
      if (bracketMatch) {
        bracketPosRef.current = cursor - bracketMatch[0].length;
        setQuery(bracketMatch[1]);
        calcPopupPos(ta, cursor);
      } else {
        setQuery(null);
        setPopupPos(null);
      }
    }
    onChange(e.target.value);
  }, [synced, onChange, calcPopupPos]);

  const showPopup = !synced && query !== null && candidates.length > 0 && popupPos !== null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none rounded-xs border bg-transparent p-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          spellCheck={false}
        />
        {/* ミラー要素: カーソル座標計算用、非表示 */}
        <div
          ref={mirrorRef}
          aria-hidden
          className="absolute top-0 left-0 invisible pointer-events-none text-sm leading-relaxed overflow-hidden"
        />
        {showPopup && (
          <ul
            className="absolute z-50 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md text-sm"
            style={{ top: popupPos!.top, left: popupPos!.left }}
          >
            {candidates.map((c, i) => (
              <li
                key={c}
                className={cn(
                  "px-3 py-1 cursor-pointer whitespace-nowrap",
                  i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
                onMouseDown={(e) => { e.preventDefault(); applyCandidate(c); }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
