import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Track } from "@/types";
import { saveLyricsData } from "@/lib/audio";
import { AppSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LyricsSearchSheet } from "@/components/LyricsSearchSheet";
import type { LyricsResult, LyricsSource } from "@/lib/lyrics";
import { cn } from "@/lib/utils";
import { Play, Pause, Square, ChevronDown, Music2, ListMusic, SwatchBook, Hammer } from "lucide-react";
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
  /** 現在プレイヤーで再生/選択中のトラック */
  currentTrack: Track | null;
  isPlaying: boolean;
  /** 再生トグル。編集中トラック == 再生中トラックなら pause/resume、それ以外はこの曲を再生する */
  onTogglePlay: (track: Track) => void;
};

export function SongInfoView({ track, onSaved, currentTrack, isPlaying, onTogglePlay }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LyricsTab>("lyrics");
  const [lyrics, setLyrics] = useState("");
  const [draftLyrics, setDraftLyrics] = useState("");
  const [syncedLyrics, setSyncedLyrics] = useState("");
  const [draftSyncedLyrics, setDraftSyncedLyrics] = useState("");
  const [saving, setSaving] = useState(false);
  const [geniusApiKey, setGeniusApiKey] = useState("");
  const [useGenius, setUseGenius] = useState(false);
  const [useLrclib, setUseLrclib] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  // 実際に検索に使う曲名 / アーティスト（通常はトラック値、カスタム検索時はダイアログ入力値）
  const [searchTitle, setSearchTitle] = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  // カスタム検索ワード入力ダイアログ
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");

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
  ];

  // トラックから導出する既定の曲名（title 空ならファイル名・拡張子抜き）
  const defaultTitle = track.title || track.name.replace(/\.[^.]+$/, "");

  // 通常検索（トラックの title/artist）を開く
  const handleOpenSearch = () => {
    setSearchTitle(defaultTitle);
    setSearchArtist(track.artist);
    setSearchOpen(true);
  };

  // カスタム検索ダイアログを開く（初期値はトラックの値）
  const handleOpenCustom = () => {
    setCustomTitle(defaultTitle);
    setCustomArtist(track.artist);
    setCustomOpen(true);
  };

  // カスタム検索の確定。入力した title/artist で検索を開始する
  const handleCustomSubmit = () => {
    setCustomOpen(false);
    setSearchTitle(customTitle);
    setSearchArtist(customArtist);
    setSearchOpen(true);
  };

  // 検索結果の採用。lyrics / synced 両方を Actual または Draft 側へ流し込む
  const handleApplyResult = (result: LyricsResult, draft: boolean) => {
    if (draft) {
      setDraftLyrics(result.lyrics);
      setDraftSyncedLyrics(result.syncedLyrics ?? "");
    } else {
      setLyrics(result.lyrics);
      setSyncedLyrics(result.syncedLyrics ?? "");
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
            <p className="text-xs text-muted-foreground break-all">{t("songInfo.filePath")}</p>
            <p className="text-sm break-all">{track.path}</p>
            {metaLine && <p className="text-sm text-muted-foreground break-all">{metaLine}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => onTogglePlay(track)}
            title={playTitle}
          >
            <PlayIcon className="w-4 h-4" />
          </Button>
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
            {/* 歌詞検索ボタングループ（本体 + ▼でソース選択） */}
            <div className="flex items-stretch">
              <Button
                variant="outline"
                className="rounded-r-none border-r-0 text-sm"
                disabled={searchSources.length === 0}
                onClick={handleOpenSearch}
              >
                {t("songInfo.searchLyrics")}
              </Button>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      variant="outline"
                      className="rounded-l-none px-2 text-sm"
                      title={t("songInfo.searchSources")}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  }
                />
                <MenuContent align="end" className="min-w-44">
                  <MenuItem
                    closeOnClick={false}
                    disabled={geniusDisabled}
                    onClick={() => !geniusDisabled && handleUseGeniusChange(!useGenius)}
                  >
                    <Checkbox checked={useGenius} disabled={geniusDisabled} />
                    <span className="flex-1">Genius</span>
                    {geniusDisabled && (
                      <span className="text-[10px] text-muted-foreground">
                        {t("songInfo.sourceGeniusHint")}
                      </span>
                    )}
                  </MenuItem>
                  <MenuItem
                    closeOnClick={false}
                    onClick={() => handleUseLrclibChange(!useLrclib)}
                  >
                    <Checkbox checked={useLrclib} />
                    <span className="flex-1">LRCLIB</span>
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem disabled={searchSources.length === 0} onClick={handleOpenCustom}>
                    {t("songInfo.customSearch")}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
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
            onChange={lyricsSetters[TAB_PANES[tab].left]}
          />
          <LyricsPane
            label={t(`songInfo.paneLabel.${TAB_PANES[tab].rightLabel}`)}
            value={lyricsValues[TAB_PANES[tab].right]}
            onChange={lyricsSetters[TAB_PANES[tab].right]}
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

      {/* カスタム検索ワード入力ダイアログ */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="min-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("songInfo.customSearch")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">{t("songInfo.searchArtist")}</label>
              <Input
                className="!text-sm rounded-xs"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">{t("songInfo.searchTitle")}</label>
              <Input
                className="!text-sm rounded-xs"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="text-sm" variant="outline" onClick={() => setCustomOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button className="text-sm" onClick={handleCustomSubmit} disabled={!customTitle.trim() && !customArtist.trim()}>
              {t("common.search")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

/** Actual / Draft それぞれの歌詞編集ペイン（ラベル + textarea） */
function LyricsPane({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 resize-none rounded-xs border bg-transparent p-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        spellCheck={false}
      />
    </div>
  );
}
