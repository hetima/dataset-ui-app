import { useState, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { FolderBookmark, Clock8, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Track } from "@/types";
import { FolderLibrary } from "./sidebar/FolderLibrary";
import { RecentFolders } from "./sidebar/RecentFolders";
import { RatedList } from "./sidebar/RatedList";

type TabId = "library" | "recent" | "good" | "bad";
type SidebarMode = "icon" | "open";

const TABS: { id: TabId; icon: React.ReactNode; titleKey: string }[] = [
  { id: "library",  icon: <FolderBookmark className="w-4 h-4" />,  titleKey: "sidebar.folderLibrary" },
  { id: "recent",   icon: <Clock8 className="w-4 h-4" />,          titleKey: "sidebar.recentFolders" },
  { id: "good",     icon: <ThumbsUp className="w-4 h-4" />,        titleKey: "common.good" },
  { id: "bad",      icon: <ThumbsDown className="w-4 h-4" />,      titleKey: "common.bad" },
];

type Props = {
  tracks: Track[];
  currentIndex: number | null;
  folderLibrary: string[];
  recentFolders: string[];
  mode: SidebarMode;
  openWidth: number;
  goodFolderName: string;
  badFolderName: string;
  onModeChange: (mode: SidebarMode) => void;
  onLoadFolder: (folder: string, silent?: boolean) => Promise<boolean>;
  onRemoveLibrary: (folder: string) => void;
  onSelect: (index: number) => void;
  onMoveGood: () => void;
  onMoveBad: () => void;
  onClearGoodRatings: () => void;
  onClearBadRatings: () => void;
};

export const PlayerSidebar = forwardRef<HTMLDivElement, Props>(function PlayerSidebar({
  tracks,
  currentIndex,
  folderLibrary,
  recentFolders,
  mode,
  openWidth,
  goodFolderName,
  badFolderName,
  onModeChange,
  onLoadFolder,
  onRemoveLibrary,
  onSelect,
  onMoveGood,
  onMoveBad,
  onClearGoodRatings,
  onClearBadRatings,
}: Props, ref: React.ForwardedRef<HTMLDivElement>) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("library");
  const isOpen = mode === "open";

  const handleTabClick = (id: TabId) => {
    if (!isOpen) {
      onModeChange("open");
      setActiveTab(id);
    } else if (activeTab === id) {
      onModeChange("icon");
    } else {
      setActiveTab(id);
    }
  };

  const goodTracks = tracks.filter((t) => t.good);
  const badTracks = tracks.filter((t) => t.bad);

  return (
    <div
      ref={ref}
      className="flex shrink-0 bg-background overflow-hidden"
      style={{ width: isOpen ? `${openWidth}px` : "2.5rem" }}
    >
      {/* タブボタン縦列 */}
      <div
        className={`flex flex-col items-center gap-0.5 py-1 shrink-0 ${isOpen ? "border-r" : ""}`}
        style={{ width: "2.5rem" }}
      >
        {TABS.map(({ id, icon, titleKey }) => (
          <Button
            key={id}
            variant={isOpen && activeTab === id ? "secondary" : "ghost"}
            size="icon"
            className="w-8 h-8"
            title={t(titleKey)}
            onClick={() => handleTabClick(id)}
          >
            {icon}
          </Button>
        ))}
      </div>

      {/* コンテンツ */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto py-2 min-w-0">
          <div className={activeTab === "library" ? "block" : "hidden"}>
            <FolderLibrary
              folders={folderLibrary}
              onLoad={onLoadFolder}
              onRemove={onRemoveLibrary}
            />
          </div>
          <div className={activeTab === "recent" ? "block" : "hidden"}>
            <RecentFolders folders={recentFolders} onLoad={onLoadFolder} />
          </div>
          <div className={activeTab === "good" ? "block" : "hidden"}>
            <RatedList
              tracks={goodTracks}
              currentIndex={currentIndex}
              allTracks={tracks}
              subFolderName={goodFolderName}
              onSelect={onSelect}
              onMove={onMoveGood}
              onClearRatings={onClearGoodRatings}
            />
          </div>
          <div className={activeTab === "bad" ? "block" : "hidden"}>
            <RatedList
              tracks={badTracks}
              currentIndex={currentIndex}
              allTracks={tracks}
              subFolderName={badFolderName}
              onSelect={onSelect}
              onMove={onMoveBad}
              onClearRatings={onClearBadRatings}
            />
          </div>
        </div>
      )}
    </div>
  );
});
