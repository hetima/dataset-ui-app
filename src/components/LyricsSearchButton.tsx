import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";

type Props = {
  disabled: boolean;
  geniusDisabled: boolean;
  useGenius: boolean;
  useLrclib: boolean;
  useYtmusic: boolean;
  defaultTitle: string;
  defaultArtist: string;
  onSearch: (title: string, artist: string) => void;
  onUseGeniusChange: (v: boolean) => void;
  onUseLrclibChange: (v: boolean) => void;
  onUseYtmusicChange: (v: boolean) => void;
  size?: "default" | "sm";
};

/** 歌詞検索の本体ボタンと検索ソース選択メニュー */
export function LyricsSearchButton({
  disabled,
  geniusDisabled,
  useGenius,
  useLrclib,
  useYtmusic,
  defaultTitle,
  defaultArtist,
  onSearch,
  onUseGeniusChange,
  onUseLrclibChange,
  onUseYtmusicChange,
  size = "default",
}: Props) {
  const { t } = useTranslation();
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const buttonClass = size === "sm" ? "h-6 px-2 text-xs" : "text-sm";
  const triggerClass = size === "sm" ? "h-6 px-1.5" : "px-2 text-sm";

  const handleOpenCustom = () => {
    setCustomTitle(defaultTitle);
    setCustomArtist(defaultArtist);
    setCustomOpen(true);
  };

  const handleCustomSubmit = () => {
    setCustomOpen(false);
    onSearch(customTitle, customArtist);
  };

  return (
    <>
      <div className="flex items-stretch">
        <Button
          variant="outline"
          className={`rounded-r-none border-r-0 ${buttonClass}`}
          disabled={disabled}
          onClick={() => onSearch(defaultTitle, defaultArtist)}
        >
          {t("songInfo.searchLyrics")}
        </Button>
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="outline"
                className={`rounded-l-none ${triggerClass}`}
                title={t("songInfo.searchSources")}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            }
          />
          <MenuContent align="end" className="min-w-44">
            <MenuItem closeOnClick={false} onClick={() => onUseYtmusicChange(!useYtmusic)}>
              <Checkbox checked={useYtmusic} />
              <span className="flex-1">YTMusic</span>
            </MenuItem>
            <MenuItem
              closeOnClick={false}
              disabled={geniusDisabled}
              onClick={() => !geniusDisabled && onUseGeniusChange(!useGenius)}
            >
              <Checkbox checked={useGenius} disabled={geniusDisabled} />
              <span className="flex-1">Genius</span>
              {geniusDisabled && (
                <span className="text-[10px] text-muted-foreground">
                  {t("songInfo.sourceGeniusHint")}
                </span>
              )}
            </MenuItem>
            <MenuItem closeOnClick={false} onClick={() => onUseLrclibChange(!useLrclib)}>
              <Checkbox checked={useLrclib} />
              <span className="flex-1">LRCLIB</span>
            </MenuItem>
            <MenuSeparator />
            <MenuItem disabled={disabled} onClick={handleOpenCustom}>
              {t("songInfo.customSearch")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="min-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("songInfo.customSearch")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">{t("songInfo.searchArtist")}</label>
              <Input
                className="!text-sm rounded-xs"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">{t("songInfo.searchTitle")}</label>
              <Input
                className="!text-sm rounded-xs"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="text-sm" variant="outline" onClick={() => setCustomOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button className="text-sm" onClick={handleCustomSubmit} disabled={!customTitle.trim() && !customArtist.trim()}>
              {t("common.search")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
