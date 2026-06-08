import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";
import { useState, forwardRef } from "react";
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
  columnHelper.accessor("name", {
    header: "ファイル名",
    cell: (info) => <span className="truncate block max-w-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor("duration", {
    header: "時間",
    cell: (info) => formatDuration(info.getValue()),
    size: 80,
  }),
];

export const PlaylistTable = forwardRef<HTMLDivElement, Props>(function PlaylistTable({
  tracks,
  currentIndex,
  searchQuery,
  onSelect,
}, ref) {
  const [sorting, setSorting] = useState<SortingState>([]);

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
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
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
                className={`cursor-pointer ${isCurrent ? "bg-primary/20 font-semibold" : ""}`}
                onClick={() => onSelect(originalIndex)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
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
