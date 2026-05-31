import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SkillCategory {
  id: number | string;
  name: string;
  skills: string[];
}

interface SkillComboboxProps {
  value: string;
  onChange: (val: string) => void;
  categories?: SkillCategory[];
  placeholder?: string;
}

export function SkillCombobox({
  value,
  onChange,
  categories = [],
  placeholder = "Search or select a skill…",
}: SkillComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? categories
        .map((cat) => ({
          ...cat,
          skills: cat.skills.filter((s) =>
            s.toLowerCase().includes(query.toLowerCase()),
          ),
        }))
        .filter((cat) => cat.skills.length > 0)
    : categories;

  function select(skill: string) {
    onChange(skill);
    setOpen(false);
    setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <span
              role="button"
              onClick={clear}
              className="rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-center text-muted-foreground">
                No skills match "{query}"
              </p>
            ) : (
              filtered.map((cat) => (
                <div key={cat.id}>
                  <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {cat.name}
                  </p>
                  {cat.skills.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left",
                        value === skill && "bg-primary/10 text-primary font-medium",
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        select(skill);
                      }}
                    >
                      {skill}
                      {value === skill && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
