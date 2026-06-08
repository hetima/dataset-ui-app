import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onEscapeToTable?: () => void;
};

export const SearchField = forwardRef<HTMLInputElement, Props>(function SearchField({ value, onChange, onEscapeToTable }, ref) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (value !== "") {
        onChange("");
      } else {
        onEscapeToTable?.();
      }
    }
  };

  return (
    <div className="w-48">
      <Input
        ref={ref}
        type="search"
        placeholder="検索..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
});
