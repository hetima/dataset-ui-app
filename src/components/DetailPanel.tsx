import { Track } from "@/types";
import { formatSize, formatDuration } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  track: Track | null;
  onSetGood: () => void;
  onSetBad: () => void;
};

export function DetailPanel({ track, onSetGood, onSetBad }: Props) {
  const { t } = useTranslation();

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
      {track.transcript && (
        <div>
          <p className="text-xs text-muted-foreground">{t("details.transcript")}</p>
          <p className="whitespace-pre-wrap break-all">{track.transcript}</p>
        </div>
      )}
    </div>
  );
}
