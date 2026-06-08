import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Repeat1, ListEnd, StopCircle } from "lucide-react";
import { PlayMode } from "@/types";

type Props = {
  isPlaying: boolean;
  playMode: PlayMode;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCyclePlayMode: () => void;
};

const PLAY_MODE_ICON: Record<PlayMode, React.ReactNode> = {
  stop:       <StopCircle className="w-5 h-5" />,
  continuous: <ListEnd className="w-5 h-5" />,
  repeat:     <Repeat1 className="w-5 h-5" />,
};

const PLAY_MODE_TITLE: Record<PlayMode, string> = {
  stop:       "再生終了後に停止",
  continuous: "連続再生",
  repeat:     "1曲リピート",
};

const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  stop:       "通常",
  continuous: "連続",
  repeat:     "1曲",
};

export function AudioControls({
  isPlaying,
  playMode,
  onPlayPause,
  onPrev,
  onNext,
  onCyclePlayMode,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="lg" className="px-3" onClick={onPrev}><SkipBack className="w-5 h-5" /></Button>
      <Button variant="ghost" size="lg" className="px-3" onClick={onPlayPause}>
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </Button>
      <Button variant="ghost" size="lg" className="px-3" onClick={onNext}><SkipForward className="w-5 h-5" /></Button>
      <Button
        variant="ghost"
        size="lg"
        className="px-3 gap-1"
        onClick={onCyclePlayMode}
        title={PLAY_MODE_TITLE[playMode]}
      >
        {PLAY_MODE_ICON[playMode]}
        <span className="text-xs">{PLAY_MODE_LABEL[playMode]}</span>
      </Button>
    </div>
  );
}
