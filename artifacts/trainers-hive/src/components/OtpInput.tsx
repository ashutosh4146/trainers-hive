import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const digits = 6;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, char: string) => {
    const only = char.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(digits, " ").split("");
    arr[index] = only || " ";
    const next = arr.join("").trimEnd();
    onChange(next.slice(0, digits));

    if (only && index < digits - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        inputs.current[index - 1]?.focus();
      }
      const arr = value.padEnd(digits, " ").split("");
      arr[index] = " ";
      onChange(arr.join("").trimEnd());
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < digits - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, digits);
    onChange(pasted);
    const nextFocus = Math.min(pasted.length, digits - 1);
    inputs.current[nextFocus]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: digits }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            "w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg transition-all outline-none",
            "focus:border-primary focus:ring-2 focus:ring-primary/20",
            value[i] ? "border-primary bg-primary/5" : "border-border bg-background",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}
