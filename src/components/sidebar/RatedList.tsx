import { FolderInput } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Track } from "@/types";

type Props = {
  tracks: Track[];
  currentIndex: number | null;
  allTracks: Track[];
  subFolderName: string;
  onSelect: (index: number) => void;
  onMove: () => void;
};

export function RatedList({ tracks, currentIndex, allTracks, subFolderName, onSelect, onMove }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      {/* ヘッダ */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-muted-foreground">{t("sidebar.count", { count: tracks.length })}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          disabled={tracks.length === 0}
          onClick={onMove}
          title={t("sidebar.moveToFolder", { folder: subFolderName })}
        >
          <FolderInput className="w-3.5 h-3.5" />
          {t("sidebar.move")}
        </Button>
      </div>

      {tracks.length === 0 ? (
        <p className="text-xs text-muted-foreground px-2 py-2 text-center">{t("common.none")}</p>
      ) : (
        <ul className="space-y-0.5">
          {tracks.map((t) => {
            const originalIndex = allTracks.indexOf(t);
            const isCurrent = originalIndex === currentIndex;
            return (
              <li
                key={t.path}
                className={`px-2 py-1.5 cursor-pointer text-sm truncate hover:bg-accent ${isCurrent ? "bg-primary/20 font-semibold" : ""}`}
                onClick={() => onSelect(originalIndex)}
              >
                {t.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
