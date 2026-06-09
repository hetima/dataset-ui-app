import { useState, forwardRef } from "react";
import { FolderOpen, Clock8, ThumbsUp, ThumbsDown, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Track } from "@/types";
import { FolderLibrary } from "./sidebar/FolderLibrary";
import { RecentFolders } from "./sidebar/RecentFolders";
import { RatedList } from "./sidebar/RatedList";
import { SettingsTab } from "./sidebar/SettingsTab";

type TabId = "library" | "recent" | "good" | "bad" | "settings";
type SidebarMode = "icon" | "open";

const TABS: { id: TabId; icon: React.ReactNode; title: string }[] = [
  { id: "library",  icon: <FolderOpen className="w-4 h-4" />,  title: "フォルダライブラリ" },
  { id: "recent",   icon: <Clock8 className="w-4 h-4" />,      title: "最近使ったフォルダ" },
  { id: "good",     icon: <ThumbsUp className="w-4 h-4" />,        title: "Good" },
  { id: "bad",      icon: <ThumbsDown className="w-4 h-4" />,  title: "Bad" },
  { id: "settings", icon: <Settings className="w-4 h-4" />,    title: "設定" },
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
  onLoadFolder: (folder: string) => void;
  onRemoveLibrary: (folder: string) => void;
  onSelect: (index: number) => void;
  onMoveGood: () => void;
  onMoveBad: () => void;
  onGoodFolderNameChange: (name: string) => void;
  onBadFolderNameChange: (name: string) => void;
  syncToggle: boolean;
  onSyncToggleChange: (v: boolean) => void;
};

export const AppSidebar = forwardRef<HTMLDivElement, Props>(function AppSidebar({
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
  onGoodFolderNameChange,
  onBadFolderNameChange,
  syncToggle,
  onSyncToggleChange,
}: Props, ref: React.ForwardedRef<HTMLDivElement>) {
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
      className="flex shrink-0 border-r bg-background overflow-hidden"
      style={{ width: isOpen ? `${openWidth}px` : "2.5rem" }}
    >
      {/* タブボタン縦列 */}
      <div className="flex flex-col items-center gap-0.5 py-1 shrink-0" style={{ width: "2.5rem" }}>
        {TABS.map(({ id, icon, title }) => (
          <Button
            key={id}
            variant={isOpen && activeTab === id ? "secondary" : "ghost"}
            size="icon"
            className="w-8 h-8"
            title={title}
            onClick={() => handleTabClick(id)}
          >
            {icon}
          </Button>
        ))}
      </div>

      {/* コンテンツ */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto py-2 min-w-0">
          {activeTab === "library" && (
            <FolderLibrary
              folders={folderLibrary}
              onLoad={onLoadFolder}
              onRemove={onRemoveLibrary}
            />
          )}
          {activeTab === "recent" && (
            <RecentFolders folders={recentFolders} onLoad={onLoadFolder} />
          )}
          {activeTab === "good" && (
            <RatedList
              tracks={goodTracks}
              currentIndex={currentIndex}
              allTracks={tracks}
              subFolderName={goodFolderName}
              onSelect={onSelect}
              onMove={onMoveGood}
            />
          )}
          {activeTab === "bad" && (
            <RatedList
              tracks={badTracks}
              currentIndex={currentIndex}
              allTracks={tracks}
              subFolderName={badFolderName}
              onSelect={onSelect}
              onMove={onMoveBad}
            />
          )}
          {activeTab === "settings" && (
            <SettingsTab
              goodFolderName={goodFolderName}
              badFolderName={badFolderName}
              syncToggle={syncToggle}
              onGoodFolderNameChange={onGoodFolderNameChange}
              onBadFolderNameChange={onBadFolderNameChange}
              onSyncToggleChange={onSyncToggleChange}
            />
          )}
        </div>
      )}
    </div>
  );
});
