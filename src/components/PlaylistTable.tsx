import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useState, forwardRef, useEffect, useRef, useMemo, useCallback, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Track } from "@/types";
import { formatDuration } from "@/lib/audio";

type Props = {
  tracks: Track[];
  currentIndex: number | null;
  selectedIndex: number | null;
  searchQuery: string;
  onSelect: (index: number) => void;
  onVisibleIndicesChange: (indices: number[]) => void;
};

const columnHelper = createColumnHelper<Track>();

function getColumnStyle(columnId: string, size: number) {
  return {
    width: size,
    flex: columnId === "transcript" ? `1 1 ${size}px` : `0 0 ${size}px`,
  };
}

export const PlaylistTable = forwardRef<HTMLDivElement, Props>(function PlaylistTable({
  tracks,
  currentIndex,
  selectedIndex,
  searchQuery,
  onSelect,
  onVisibleIndicesChange,
}, ref) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const containerRef = useRef<HTMLDivElement>(null);
  const originalIndexMap = useMemo(() => new Map(tracks.map((track, index) => [track, index])), [tracks]);
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);
  const columns = useMemo(() => [
    columnHelper.display({
      id: "status",
      header: "",
      size: 32,
      cell: (info) => {
        const { good, bad } = info.row.original;
        if (good) return <ThumbsUp className="w-3.5 h-3.5 shrink-0" />;
        if (bad) return <ThumbsDown className="w-3.5 h-3.5 shrink-0" />;
        return null;
      },
    }),
    columnHelper.accessor("name", {
      header: t("playlist.fileName"),
      size: 260,
      cell: (info) => <span className="truncate block max-w-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor("duration", {
      header: t("playlist.duration"),
      cell: (info) => formatDuration(info.getValue()),
      size: 80,
    }),
    columnHelper.accessor("transcript", {
      header: t("playlist.transcript"),
      size: 40,
      cell: (info) => {
        const v = info.getValue();
        return v ? <span className="truncate block w-full text-muted-foreground">{v}</span> : null;
      },
    }),
  ], [t]);

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting, globalFilter: deferredSearchQuery },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const selectedRowIndex = useMemo(() => {
    if (selectedIndex === null) return -1;
    return rows.findIndex((row) => originalIndexMap.get(row.original) === selectedIndex);
  }, [selectedIndex, originalIndexMap, rows]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 37,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    onVisibleIndicesChange(rows.map((row) => originalIndexMap.get(row.original) ?? -1).filter((index) => index >= 0));
  }, [onVisibleIndicesChange, originalIndexMap, rows]);

  useEffect(() => {
    if (selectedRowIndex >= 0) {
      rowVirtualizer.scrollToIndex(selectedRowIndex, { align: "auto" });
    }
  }, [selectedIndex, selectedRowIndex, rowVirtualizer]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden outline-none">
      <table className="grid shrink-0 text-sm">
        <TableHeader className="grid bg-background">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="flex w-full">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={`flex items-center select-none ${header.column.id === "status" ? "w-6 p-0" : "cursor-pointer"}`}
                  onClick={header.column.id !== "status" ? header.column.getToggleSortingHandler() : undefined}
                  style={getColumnStyle(header.column.id, header.getSize())}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
      </table>
      <div ref={setContainerRef} tabIndex={-1} className="flex-1 overflow-auto outline-none">
        <Table className="grid text-sm">
        <TableBody
          className="grid relative"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            const originalIndex = originalIndexMap.get(row.original) ?? -1;
            const isCurrent = originalIndex === currentIndex;
            const isSelected = originalIndex === selectedIndex;
            return (
              <TableRow
                key={row.id}
                data-index={originalIndex}
                className={`absolute flex w-full cursor-pointer ${isSelected ? "bg-primary/20" : ""} ${isCurrent ? "font-semibold" : ""} ${row.original.bad ? "text-red-700" : ""}`}
                onClick={() => onSelect(originalIndex)}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={`flex h-[37px] items-center ${cell.column.id === "status" ? "w-6 p-0 justify-center" : ""}`}
                    style={getColumnStyle(cell.column.id, cell.column.getSize())}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
});
