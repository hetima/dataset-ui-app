import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Track } from "@/types";
import { saveLyrics } from "@/lib/audio";
import { AppSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Play, Pause, Square, ChevronDown } from "lucide-react";

type Props = {
  track: Track | null;
  /** 保存成功時に呼ばれる。プレイヤータブの state と同期するため */
  onSaved: (path: string, lyrics: string) => void;
  /** 現在プレイヤーで再生/選択中のトラック */
  currentTrack: Track | null;
  isPlaying: boolean;
  /** 再生トグル。編集中トラック == 再生中トラックなら pause/resume、それ以外はこの曲を再生する */
  onTogglePlay: (track: Track) => void;
};

export function SongInfoView({ track, onSaved, currentTrack, isPlaying, onTogglePlay }: Props) {
  const { t } = useTranslation();
  const [lyrics, setLyrics] = useState("");
  const [saving, setSaving] = useState(false);
  const [geniusApiKey, setGeniusApiKey] = useState("");
  const [useGenius, setUseGenius] = useState(false);
  const [useLrclib, setUseLrclib] = useState(true);

  // 対象トラックが切り替わったら textarea を同期する
  useEffect(() => {
    setLyrics(track?.lyrics ?? "");
  }, [track?.path, track?.lyrics]);

  // 歌詞検索の設定を読み込む
  useEffect(() => {
    (async () => {
      const settings = await AppSettings.load();
      setGeniusApiKey(await settings.getGeniusApiKey());
      setUseGenius(await settings.getLyricsUseGenius());
      setUseLrclib(await settings.getLyricsUseLrclib());
    })();
  }, []);

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
      await saveLyrics(track.path, lyrics);
      onSaved(track.path, lyrics);
      toast.success(t("songInfo.saveComplete"));
    } catch (e) {
      console.error("saveLyrics failed:", e);
      toast.error(t("songInfo.saveFailed"));
    } finally {
      setSaving(false);
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
      <div className="shrink-0 border-b p-4 space-y-1">
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("songInfo.lyrics")}</span>
          <div className="flex items-center gap-2">
            {/* 歌詞検索ボタングループ（本体 + ▼でソース選択） */}
            <div className="flex items-stretch">
              <Button
                size="sm"
                variant="outline"
                className="rounded-r-none border-r-0"
              >
                {t("songInfo.searchLyrics")}
              </Button>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-l-none px-2"
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
                </MenuContent>
              </Menu>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {t("songInfo.save")}
            </Button>
          </div>
        </div>
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          className="flex-1 resize-none rounded-xs border bg-transparent p-3 text-sm font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
