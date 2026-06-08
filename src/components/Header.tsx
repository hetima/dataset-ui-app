import { RefObject } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AudioControls } from "./AudioControls";
import { SearchField } from "./SearchField";
import { formatDuration } from "@/lib/audio";
import { PlayMode } from "@/types";
import { Volume2, PanelLeft } from "lucide-react";

type Props = {
  searchRef: RefObject<HTMLInputElement | null>;
  isPlaying: boolean;
  playMode: PlayMode;
  currentTime: number;
  duration: number;
  nowPlayingName: string | null;
  searchQuery: string;
  volume: number;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCyclePlayMode: () => void;
  onSeek: (time: number) => void;
  onSearchChange: (query: string) => void;
  onSearchEscapeToTable: () => void;
  onVolumeChange: (v: number) => void;
  onToggleSidebar: () => void;
};

export function Header(props: Props) {
  const hasTrack = props.duration > 0;

  return (
    <header className="h-24 flex flex-col justify-center gap-1 px-4 border-b bg-background shrink-0">
      {/* 1段目: ボタン群 + ファイル名（中央）+ ボリューム */}
      <div className="flex items-center gap-2">
        <AudioControls
          isPlaying={props.isPlaying}
          playMode={props.playMode}
          onPlayPause={props.onPlayPause}
          onPrev={props.onPrev}
          onNext={props.onNext}
          onCyclePlayMode={props.onCyclePlayMode}
        />
        <span className="flex-1 text-sm text-foreground truncate text-center px-2">
          {props.nowPlayingName ?? "再生停止中"}
        </span>
        <div className="flex items-center gap-2 w-48 shrink-0">
          <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[props.volume]}
            onValueChange={(v) => props.onVolumeChange(Array.isArray(v) ? v[0] : (v as number))}
          />
        </div>
      </div>
      {/* 2段目: サイドバートリガー + シークバー + 検索 */}
      <div className="flex items-center gap-2 px-1">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={props.onToggleSidebar}>
          <PanelLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
          {hasTrack ? formatDuration(props.currentTime) : "　"}
        </span>
        <Slider
          className="flex-1"
          min={0}
          max={hasTrack ? props.duration : 1}
          step={1}
          value={[hasTrack ? props.currentTime : 0]}
          disabled={!hasTrack}
          onValueChange={(v) => props.onSeek(Array.isArray(v) ? v[0] : (v as number))}
        />
        <span className="text-xs text-muted-foreground w-10 shrink-0">
          {hasTrack ? formatDuration(props.duration) : "　"}
        </span>
        <SearchField ref={props.searchRef} value={props.searchQuery} onChange={props.onSearchChange} onEscapeToTable={props.onSearchEscapeToTable} />
      </div>
    </header>
  );
}
