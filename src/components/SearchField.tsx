import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onEscapeToTable?: () => void;
};

export const SearchField = forwardRef<HTMLInputElement, Props>(function SearchField({ value, onChange, onEscapeToTable }, ref) {
  const { t } = useTranslation();
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
        placeholder={t("search.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
});
