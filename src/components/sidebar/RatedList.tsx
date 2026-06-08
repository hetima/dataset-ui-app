import { Track } from "@/types";

type Props = {
  tracks: Track[];
  currentIndex: number | null;
  allTracks: Track[];
  onSelect: (index: number) => void;
};

export function RatedList({ tracks, currentIndex, allTracks, onSelect }: Props) {
  if (tracks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-2 py-4 text-center">
        該当なし
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {tracks.map((t) => {
        const originalIndex = allTracks.indexOf(t);
        const isCurrent = originalIndex === currentIndex;
        return (
          <li
            key={t.path}
            className={`px-2 py-1.5 rounded-md cursor-pointer text-sm truncate hover:bg-accent ${isCurrent ? "bg-primary/20 font-semibold" : ""}`}
            onClick={() => onSelect(originalIndex)}
          >
            {t.name}
          </li>
        );
      })}
    </ul>
  );
}
