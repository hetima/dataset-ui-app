import { Track } from "@/types";
import { formatSize, formatDuration } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Star, ThumbsDown } from "lucide-react";

type Props = {
  track: Track | null;
  onSetGood: () => void;
  onSetBad: () => void;
};

export function DetailPanel({ track, onSetGood, onSetBad }: Props) {
  if (!track) {
    return (
      <div className="w-64 shrink-0 border-l p-4 text-sm text-muted-foreground">
        ファイルを選択してください
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-l p-4 text-sm space-y-3">
      <div className="flex gap-2">
        <Button
          variant={track.good ? "default" : "ghost"}
          size="icon"
          onClick={onSetGood}
          title="Good"
        >
          <Star className="w-4 h-4" />
        </Button>
        <Button
          variant={track.bad ? "default" : "ghost"}
          size="icon"
          onClick={onSetBad}
          title="Bad"
        >
          <ThumbsDown className="w-4 h-4" />
        </Button>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">ファイル名</p>
        <p className="break-all">{track.name}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">サイズ</p>
        <p>{formatSize(track.size)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">再生時間</p>
        <p>{formatDuration(track.duration)}</p>
      </div>
    </div>
  );
}
