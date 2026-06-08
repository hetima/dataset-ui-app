import { Track } from "@/types";
import { formatSize, formatDuration } from "@/lib/audio";

type Props = {
  track: Track | null;
};

export function DetailPanel({ track }: Props) {
  if (!track) {
    return (
      <div className="w-64 shrink-0 border-l p-4 text-sm text-muted-foreground">
        ファイルを選択してください
      </div>
    );
  }

  const ext = track.name.split(".").pop()?.toUpperCase() ?? "";

  return (
    <div className="w-64 shrink-0 border-l p-4 text-sm space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">ファイル名</p>
        <p className="break-all">{track.name}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">パス</p>
        <p className="break-all text-xs">{track.path}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">サイズ</p>
        <p>{formatSize(track.size)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">再生時間</p>
        <p>{formatDuration(track.duration)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">形式</p>
        <p>{ext}</p>
      </div>
    </div>
  );
}
