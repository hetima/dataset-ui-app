import { useCallback, useEffect, useState } from "react";
import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { ChevronDown, ChevronRight, Folder, FolderClosed, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { isAudioFile } from "@/lib/audio";

type Props = {
  folders: string[];
  /** フォルダをロード。silent=true でトースト抑制。オーディオが無ければ false を返す */
  onLoad: (folder: string, silent?: boolean) => Promise<boolean>;
  onRemove: (folder: string) => void;
};

type FolderNodeProps = {
  path: string;
  depth: number;
  isRoot: boolean;
  onLoad: (folder: string, silent?: boolean) => Promise<boolean>;
  onRemove: (folder: string) => void;
};

/** フォルダ名のみ取り出す */
function folderName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

function FolderNode({ path, depth, isRoot, onLoad, onRemove }: FolderNodeProps) {
  const { t } = useTranslation();
  const [children, setChildren] = useState<string[] | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = children !== null && children.length > 0;

  /** 子フォルダ一覧と音声ファイル有無を再スキャンする */
  const scanNode = useCallback(async () => {
    const entries = await readDir(path);
    const childPaths = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => join(path, entry.name))
    );
    setChildren(childPaths.sort((a, b) => folderName(a).localeCompare(folderName(b))));
    setHasAudio(entries.some((entry) => entry.isFile && isAudioFile(entry.name)));
  }, [path]);

  // 行クリック: オーディオを含めばロード（トースト抑制）。
  // 含まなければ、サブフォルダがあれば展開/格納のみ行い、無ければ何もしない。
  const handleRowClick = () => {
    if (hasAudio) {
      onLoad(path, true);
      return;
    }
    if (hasChildren) {
      setIsOpen((v) => !v);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadChildren() {
      try {
        const entries = await readDir(path);
        const childPaths = await Promise.all(
          entries
            .filter((entry) => entry.isDirectory)
            .map((entry) => join(path, entry.name))
        );
        if (!cancelled) {
          setChildren(childPaths.sort((a, b) => folderName(a).localeCompare(folderName(b))));
          setHasAudio(entries.some((entry) => entry.isFile && isAudioFile(entry.name)));
        }
      } catch {
        if (!cancelled) {
          setChildren([]);
          setHasAudio(false);
        }
      }
    }
    loadChildren();
    return () => { cancelled = true; };
  }, [path]);

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger render={<div />}>
          <div
            className="flex items-center gap-1 px-2 py-1.5 hover:bg-accent cursor-pointer text-sm truncate w-full"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onClick={handleRowClick}
          >
            {hasChildren ? (
              <button
                type="button"
                className="w-4 h-4 shrink-0 flex items-center justify-center rounded-sm hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen((v) => !v);
                }}
                aria-label={isOpen ? t("sidebar.collapse") : t("sidebar.expand")}
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4 h-4 shrink-0" />
            )}
            {hasAudio ? (
              <Folder className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <FolderClosed className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{folderName(path)}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => scanNode().catch(() => {
            setChildren([]);
            setHasAudio(false);
          })}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("sidebar.reload")}
          </ContextMenuItem>
          {isRoot && (
            <ContextMenuItem
              className="text-destructive"
              onClick={() => onRemove(path)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("sidebar.removeFromList")}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {isOpen && hasChildren && (
        <ul className="space-y-0.5">
          {children.map((child) => (
            <FolderNode
              key={child}
              path={child}
              depth={depth + 1}
              isRoot={false}
              onLoad={onLoad}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderLibrary({ folders, onLoad, onRemove }: Props) {
  const { t } = useTranslation();

  if (folders.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-2 py-4 text-center">
        {t("sidebar.addByDrop")}
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {folders.map((f) => (
        <FolderNode
          key={f}
          path={f}
          depth={0}
          isRoot
          onLoad={onLoad}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}
