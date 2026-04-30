import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function CursorLoader() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isLoading = isFetching > 0 || isMutating > 0;

  const pos = useRef({ x: -200, y: -200 });
  const raf = useRef<number>(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    let current = { x: pos.current.x, y: pos.current.y };

    const loop = () => {
      const target = pos.current;
      current = {
        x: current.x + (target.x - current.x) * 0.18,
        y: current.y + (target.y - current.y) * 0.18,
      };
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${current.x}px, ${current.y}px)`;
      }
      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      className="cursor-loader-ring"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform",
      }}
    >
      <div
        className="cursor-loader-spinner"
        style={{
          width: 32,
          height: 32,
          marginLeft: -16,
          marginTop: -16,
          borderRadius: "50%",
          border: "2.5px solid transparent",
          borderTopColor: "hsl(var(--primary))",
          borderRightColor: "hsl(var(--primary) / 0.4)",
          animation: "cursor-spin 0.7s linear infinite",
          opacity: isLoading ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />
    </div>
  );
}
