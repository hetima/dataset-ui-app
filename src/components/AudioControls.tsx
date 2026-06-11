import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Repeat1, ListEnd, StopCircle, Square, SquareCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PlayMode } from "@/types";

type Props = {
  isPlaying: boolean;
  playMode: PlayMode;
  autoPlay: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCyclePlayMode: () => void;
  onToggleAutoPlay: () => void;
};

const PLAY_MODE_ICON: Record<PlayMode, React.ReactNode> = {
  stop:       <StopCircle className="w-5 h-5" />,
  continuous: <ListEnd className="w-5 h-5" />,
  repeat:     <Repeat1 className="w-5 h-5" />,
};

export function AudioControls({
  isPlaying,
  playMode,
  autoPlay,
  onPlayPause,
  onPrev,
  onNext,
  onCyclePlayMode,
  onToggleAutoPlay,
}: Props) {
  const { t } = useTranslation();
  const playModeTitle: Record<PlayMode, string> = {
    stop: t("controls.stopAfterCurrent"),
    continuous: t("controls.continuousPlayback"),
    repeat: t("controls.repeatOne"),
  };
  const playModeLabel: Record<PlayMode, string> = {
    stop: t("controls.stop"),
    continuous: t("controls.continuous"),
    repeat: t("controls.repeat"),
  };

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
        title={playModeTitle[playMode]}
      >
        {PLAY_MODE_ICON[playMode]}
        <span className="text-xs">{playModeLabel[playMode]}</span>
      </Button>
      <Button
        variant={autoPlay ? "secondary" : "ghost"}
        size="lg"
        className="px-3 gap-1"
        onClick={onToggleAutoPlay}
        title={t("controls.autoPlayDescription")}
      >
        {autoPlay ? <SquareCheck className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        <span className="text-xs">{t("controls.autoPlay")}</span>
      </Button>
    </div>
  );
}
