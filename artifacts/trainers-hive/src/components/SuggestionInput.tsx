import React, { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SuggestionInputProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  suggestions: string[];
  placeholder?: string;
  minChars?: number;
  className?: string;
}

export function SuggestionInput({
  value,
  onChange,
  onBlur,
  suggestions,
  placeholder,
  minChars = 2,
  className,
}: SuggestionInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered =
    value.length >= minChars
      ? suggestions.filter((s) =>
          s.toLowerCase().startsWith(value.toLowerCase())
        ).slice(0, 8)
      : [];

  useEffect(() => {
    setHighlighted(0);
    setOpen(filtered.length > 0);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filtered[highlighted]) {
        e.preventDefault();
        onChange(filtered[highlighted]);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md text-sm">
          {filtered.map((s, i) => (
            <li
              key={s}
              className={cn(
                "cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground",
                i === highlighted && "bg-accent text-accent-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
