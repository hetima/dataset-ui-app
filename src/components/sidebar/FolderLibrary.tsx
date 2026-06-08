import { FolderOpen, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type Props = {
  folders: string[];
  onLoad: (folder: string) => void;
  onRemove: (folder: string) => void;
};

/** フォルダ名のみ取り出す */
function folderName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

export function FolderLibrary({ folders, onLoad, onRemove }: Props) {
  if (folders.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-2 py-4 text-center">
        フォルダをドロップして追加
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {folders.map((f) => (
        <ContextMenu key={f}>
          <ContextMenuTrigger asChild>
            <li
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm truncate"
              onClick={() => onLoad(f)}
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{folderName(f)}</span>
            </li>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              className="text-destructive"
              onClick={() => onRemove(f)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </ul>
  );
}
