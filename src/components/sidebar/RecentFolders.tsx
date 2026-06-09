import { Folder } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  folders: string[];
  onLoad: (folder: string) => void;
};

function folderName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

export function RecentFolders({ folders, onLoad }: Props) {
  const { t } = useTranslation();

  if (folders.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-2 py-4 text-center">
        {t("sidebar.noHistory")}
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {folders.map((f) => (
        <li
          key={f}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer text-sm truncate"
          onClick={() => onLoad(f)}
        >
          <Folder className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{folderName(f)}</span>
        </li>
      ))}
    </ul>
  );
}
