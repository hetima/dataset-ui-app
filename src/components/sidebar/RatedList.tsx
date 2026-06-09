import { useState } from "react";
import { ChevronDown, FolderInput, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Track } from "@/types";

type Props = {
  tracks: Track[];
  currentIndex: number | null;
  allTracks: Track[];
  subFolderName: string;
  onSelect: (index: number) => void;
  onMove: () => void;
  onClearRatings: () => void;
};

type ConfirmAction = "move" | "clear";

export function RatedList({ tracks, currentIndex, allTracks, subFolderName, onSelect, onMove, onClearRatings }: Props) {
  const { t } = useTranslation();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleConfirm = () => {
    if (confirmAction === "move") onMove();
    else if (confirmAction === "clear") onClearRatings();
    setConfirmAction(null);
  };

  const confirmMessage = confirmAction === "move"
    ? t("sidebar.confirmMove", { folder: subFolderName, count: tracks.length })
    : t("sidebar.confirmClear", { count: tracks.length });

  return (
    <div className="flex flex-col gap-1">
      {/* ヘッダ */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-muted-foreground">{t("sidebar.count", { count: tracks.length })}</span>
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                disabled={tracks.length === 0}
              />
            }
          >
            <ChevronDown className="w-3.5 h-3.5" />
            {t("sidebar.actions")}
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onClick={() => setConfirmAction("move")}>
              <FolderInput />
              {t("sidebar.moveToFolder", { folder: subFolderName })}
            </MenuItem>
            <MenuSeparator />
            <MenuItem variant="destructive" onClick={() => setConfirmAction("clear")}>
              <X />
              {t("sidebar.clearFlags")}
            </MenuItem>
          </MenuContent>
        </Menu>
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

      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sidebar.confirm")}</DialogTitle>
            <DialogDescription>{confirmMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleConfirm}>{t("common.ok")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
