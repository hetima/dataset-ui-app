import { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AudioControls } from "./AudioControls";
import { SearchField } from "./SearchField";
import { formatDuration } from "@/lib/audio";
import { PlayMode } from "@/types";
import { Volume2, PanelLeft, PanelRight } from "lucide-react";

type Props = {
  searchRef: RefObject<HTMLInputElement | null>;
  isPlaying: boolean;
  playMode: PlayMode;
  currentTime: number;
  duration: number;
  nowPlayingName: string | null;
  nowPlayingFolder: string | null;
  dirtyCount: number;
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
  onToggleDetailPanel: () => void;
  onSaveDirty: () => void;
};

export function Header(props: Props) {
  const { t } = useTranslation();
  const hasTrack = props.duration > 0;

  return (
    <header className="h-20 flex flex-col justify-start gap-1 px-4 border-b bg-background shrink-0">
      {/* 1段目: ボタン群 + フォルダ情報 + ボリューム */}
      <div className="relative flex items-center gap-2">
        <AudioControls
          isPlaying={props.isPlaying}
          playMode={props.playMode}
          onPlayPause={props.onPlayPause}
          onPrev={props.onPrev}
          onNext={props.onNext}
          onCyclePlayMode={props.onCyclePlayMode}
        />
        <div className="absolute left-1/2 -translate-x-1/2 max-w-[40%] flex items-center gap-2 pointer-events-auto">
          <span className="text-sm text-foreground truncate text-center">
            {props.nowPlayingFolder ?? ""}
          </span>
          {props.dirtyCount > 0 && (
            <Button variant="secondary" size="sm" className="h-6 px-2 text-xs shrink-0" onClick={props.onSaveDirty}>
              {t("player.unsavedChanges")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 w-56 shrink-0 ml-auto">
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
      {/* 2段目: サイドバートリガー + シークバー + ファイル名（絶対中央）+ 検索 */}
      <div className="relative flex items-center gap-2 px-1">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={props.onToggleSidebar}>
          <PanelLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-1 shrink-0 w-60">
          <span className="text-xs text-muted-foreground w-10 text-right">
            {hasTrack ? formatDuration(props.currentTime) : "　"}
          </span>
          <Slider
            min={0}
            max={hasTrack ? props.duration : 1}
            step={1}
            value={[hasTrack ? props.currentTime : 0]}
            disabled={!hasTrack}
            onValueChange={(v) => props.onSeek(Array.isArray(v) ? v[0] : (v as number))}
          />
          <span className="text-xs text-muted-foreground w-10">
            {hasTrack ? formatDuration(props.duration) : "　"}
          </span>
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-foreground truncate max-w-[40%] text-center pointer-events-none">
          {props.nowPlayingName ?? t("player.stopped")}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <SearchField ref={props.searchRef} value={props.searchQuery} onChange={props.onSearchChange} onEscapeToTable={props.onSearchEscapeToTable} />
          <Button variant="ghost" size="icon" className="shrink-0" onClick={props.onToggleDetailPanel}>
            <PanelRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
