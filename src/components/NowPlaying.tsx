import { useTranslation } from "react-i18next";

type Props = {
  fileName: string | null;
};

export function NowPlaying({ fileName }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center min-w-0 flex-1 px-4">
      <span className="text-sm text-muted-foreground truncate">
        {fileName ?? t("player.stopped")}
      </span>
    </div>
  );
}
