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
  searchQuery: string;
  onSelect: (index: number) => void;
  onVisibleIndicesChange: (indices: number[]) => void;
};

const columnHelper = createColumnHelper<Track>();

const columns = [
  columnHelper.display({
    id: "status",
    header: "",
    size: 32,
    cell: (info) => {
      const { good, bad } = info.row.original;
      if (good) return <ThumbsUp className="w-3.5 h-3.5 shrink-0" />;
      if (bad)  return <ThumbsDown className="w-3.5 h-3.5 shrink-0" />;
      return null;
    },
  }),
  columnHelper.accessor("name", {
    header: "ファイル名",
    size: 260,
    cell: (info) => <span className="truncate block max-w-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor("duration", {
    header: "時間",
    cell: (info) => formatDuration(info.getValue()),
    size: 80,
  }),
  columnHelper.accessor("transcript", {
    header: "テキスト",
    size: 420,
    cell: (info) => {
      const v = info.getValue();
      return v ? <span className="truncate block w-full text-muted-foreground">{v}</span> : null;
    },
  }),
];

function getColumnStyle(columnId: string, size: number) {
  return {
    width: size,
    flex: columnId === "transcript" ? `1 1 ${size}px` : `0 0 ${size}px`,
  };
}

export const PlaylistTable = forwardRef<HTMLDivElement, Props>(function PlaylistTable({
  tracks,
  currentIndex,
  searchQuery,
  onSelect,
  onVisibleIndicesChange,
}, ref) {
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
    if (currentIndex === null) return;
    const rowIndex = rows.findIndex((row) => originalIndexMap.get(row.original) === currentIndex);
    if (rowIndex >= 0) {
      rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });
    }
  }, [currentIndex, originalIndexMap, rowVirtualizer, rows]);

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
            return (
              <TableRow
                key={row.id}
                data-index={originalIndex}
                className={`absolute flex w-full cursor-pointer ${isCurrent ? "bg-primary/20" : ""} ${row.original.bad ? "text-red-700" : ""}`}
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
