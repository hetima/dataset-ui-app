import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Track } from "@/types";
import { saveLyrics } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square } from "lucide-react";

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

  // 対象トラックが切り替わったら textarea を同期する
  useEffect(() => {
    setLyrics(track?.lyrics ?? "");
  }, [track?.path, track?.lyrics]);

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
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {t("songInfo.save")}
          </Button>
        </div>
        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          className="flex-1 resize-none rounded-md border bg-transparent p-3 text-sm font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
