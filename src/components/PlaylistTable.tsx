import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { useState, forwardRef, useEffect, useRef } from "react";
import { Star, ThumbsDown } from "lucide-react";
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
};

const columnHelper = createColumnHelper<Track>();

const columns = [
  columnHelper.display({
    id: "status",
    header: "",
    size: 32,
    cell: (info) => {
      const { good, bad } = info.row.original;
      if (good) return <Star className="w-3.5 h-3.5 shrink-0" />;
      if (bad)  return <ThumbsDown className="w-3.5 h-3.5 shrink-0" />;
      return null;
    },
  }),
  columnHelper.accessor("name", {
    header: "ファイル名",
    cell: (info) => <span className="truncate block max-w-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor("duration", {
    header: "時間",
    cell: (info) => formatDuration(info.getValue()),
    size: 80,
  }),
  columnHelper.accessor("transcript", {
    header: "テキスト",
    cell: (info) => {
      const v = info.getValue();
      return v ? <span className="truncate block max-w-sm text-muted-foreground">{v}</span> : null;
    },
  }),
];

export const PlaylistTable = forwardRef<HTMLDivElement, Props>(function PlaylistTable({
  tracks,
  currentIndex,
  searchQuery,
  onSelect,
}, ref) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentIndex === null) return;
    const container = (ref as React.RefObject<HTMLDivElement>)?.current ?? containerRef.current;
    const row = container?.querySelector<HTMLElement>(`[data-index="${currentIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [currentIndex]);

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting, globalFilter: searchQuery },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div ref={ref} tabIndex={-1} className="flex-1 overflow-auto outline-none">
      <Table className="text-sm">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={`select-none ${header.column.id === "status" ? "w-6 p-0" : "cursor-pointer"}`}
                  onClick={header.column.id !== "status" ? header.column.getToggleSortingHandler() : undefined}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const originalIndex = tracks.indexOf(row.original);
            const isCurrent = originalIndex === currentIndex;
            return (
              <TableRow
                key={row.id}
                data-index={originalIndex}
                className={`cursor-pointer ${isCurrent ? "bg-primary/20" : ""} ${row.original.bad ? "text-red-700" : ""}`}
                onClick={() => onSelect(originalIndex)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cell.column.id === "status" ? "w-6 p-0" : ""}
                    style={cell.column.id === "status" ? { paddingLeft: "6px" } : {}}
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
  );
});
