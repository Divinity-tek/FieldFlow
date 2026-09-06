import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  UNIT_DICTIONARY,
  getRecentUnits,
  normalizeUnit,
  rememberUnit,
} from "@/lib/units";

interface UnitInputProps {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

interface Suggestion {
  value: string;
  source: "recent" | "dictionary";
}

const MAX_SUGGESTIONS = 8;

export function UnitInput({
  value,
  onChange,
  invalid,
  placeholder = "hour",
  className,
  ariaLabel,
}: UnitInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRecents(getRecentUnits());
  }, [open]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = normalizeUnit(value);
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    const push = (v: string, source: Suggestion["source"]) => {
      const n = normalizeUnit(v);
      if (!n || seen.has(n)) return;
      if (q && !n.includes(q)) return;
      seen.add(n);
      out.push({ value: n, source });
    };
    for (const r of recents) push(r, "recent");
    for (const d of UNIT_DICTIONARY) push(d, "dictionary");
    return out.slice(0, MAX_SUGGESTIONS);
  }, [recents, value]);

  useEffect(() => {
    setActiveIdx(0);
  }, [value, open]);

  const commit = (v: string) => {
    const n = normalizeUnit(v);
    onChange(n);
    if (n) rememberUnit(n);
    setOpen(false);
  };

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            const n = normalizeUnit(e.target.value);
            if (n !== value) onChange(n);
            if (n) rememberUnit(n);
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              setOpen(true);
              return;
            }
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              if (suggestions[activeIdx]) {
                e.preventDefault();
                commit(suggestions[activeIdx].value);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Tab") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          maxLength={50}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-autocomplete="list"
          aria-expanded={open}
          className={cn(invalid && "border-destructive", className)}
          role="combobox"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-1 w-[220px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={() => setOpen(false)}
      >
        <ul className="max-h-64 overflow-auto" role="listbox">
          {suggestions.map((s, idx) => (
            <li
              key={s.value}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s.value);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer",
                idx === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
            >
              <span className="truncate">{s.value}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {s.source === "recent" ? "recent" : "dict"}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
