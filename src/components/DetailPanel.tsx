import { useState, useEffect } from "react";
import { Track } from "@/types";
import { formatSize, formatDuration } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  track: Track | null;
  currentIndex: number | null;
  onSetGood: () => void;
  onSetBad: () => void;
  onEditSongInfo: () => void;
  onTranscriptChange: (index: number, transcript: string) => void;
};

export function DetailPanel({ track, currentIndex, onSetGood, onSetBad, onEditSongInfo, onTranscriptChange }: Props) {
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState(track?.transcript ?? "");

  // トラックが切り替わったら textarea をリセット
  useEffect(() => {
    setTranscript(track?.transcript ?? "");
  }, [currentIndex, track?.transcript]);

  if (!track) {
    return (
      <div className="w-64 shrink-0 p-4 text-sm text-muted-foreground">
        {t("details.selectFile")}
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 p-4 text-sm space-y-3">
      <div className="flex gap-2">
        <Button
          variant={track.good ? "default" : "ghost"}
          size="icon"
          onClick={onSetGood}
          title={t("common.good")}
        >
          <ThumbsUp className="w-4 h-4" />
        </Button>
        <Button
          variant={track.bad ? "default" : "ghost"}
          size="icon"
          onClick={onSetBad}
          title={t("common.bad")}
        >
          <ThumbsDown className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEditSongInfo}
          title={t("tabs.songInfo")}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t("details.fileName")}</p>
        <p className="break-all">{track.name}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t("details.size")}</p>
        <p>{track.size === null ? t("details.loading") : formatSize(track.size)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t("details.duration")}</p>
        <p>{formatDuration(track.duration)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">{t("details.transcript")}</p>
        <textarea
          value={transcript}
          rows={6}
          onChange={(e) => {
            setTranscript(e.target.value);
            if (currentIndex !== null) onTranscriptChange(currentIndex, e.target.value);
          }}
          className="w-full resize-none rounded-xs border bg-transparent p-2 text-xs font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          spellCheck={false}
        />
      </div>
      {(track.lyrics || track.syncedLyrics || track.ttml) && (
        <div>
          <p className="text-xs text-muted-foreground">{t("details.lyrics")}</p>
          {track.lyrics && <p className="whitespace-pre-wrap break-all">{track.lyrics}</p>}
          {track.syncedLyrics && <p className="whitespace-pre-wrap break-all">{track.syncedLyrics}</p>}
          {track.ttml && <p className="whitespace-pre-wrap break-all">{track.ttml}</p>}
        </div>
      )}
    </div>
  );
}
