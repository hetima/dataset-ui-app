type Props = {
  fileName: string | null;
};

export function NowPlaying({ fileName }: Props) {
  return (
    <div className="flex items-center min-w-0 flex-1 px-4">
      <span className="text-sm text-muted-foreground truncate">
        {fileName ?? "再生停止中"}
      </span>
    </div>
  );
}
