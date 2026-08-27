import type { PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type FloatingWindowSize = "default" | "wide";

type DragState = {
  pointerX: number;
  pointerY: number;
  left: number;
  top: number;
};

export function FloatingWindow({
  title,
  onClose,
  children,
  size = "default",
  closeLabel = "关闭",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: FloatingWindowSize;
  closeLabel?: string;
}) {
  const windowRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  useEffect(() => {
    const clampPosition = () => {
      const element = windowRef.current;
      if (!element) return;
      setPosition((current) => {
        if (!current) return current;
        const bounds = element.getBoundingClientRect();
        const margin = 12;
        const maxLeft = Math.max(margin, window.innerWidth - bounds.width - margin);
        const maxTop = Math.max(margin, window.innerHeight - bounds.height - margin);
        return {
          left: Math.min(maxLeft, Math.max(margin, current.left)),
          top: Math.min(maxTop, Math.max(margin, current.top)),
        };
      });
    };
    window.addEventListener("resize", clampPosition);
    window.visualViewport?.addEventListener("resize", clampPosition);
    return () => {
      window.removeEventListener("resize", clampPosition);
      window.visualViewport?.removeEventListener("resize", clampPosition);
    };
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent | globalThis.PointerEvent) => {
      const drag = dragRef.current;
      const element = windowRef.current;
      if (!drag || !element) return;

      const bounds = element.getBoundingClientRect();
      const margin = 12;
      const maxLeft = Math.max(margin, window.innerWidth - bounds.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - bounds.height - margin);
      setPosition({
        left: Math.min(maxLeft, Math.max(margin, drag.left + event.clientX - drag.pointerX)),
        top: Math.min(maxTop, Math.max(margin, drag.top + event.clientY - drag.pointerY)),
      });
    };
    const stop = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, []);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const bounds = windowRef.current?.getBoundingClientRect();
    if (!bounds) return;
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: bounds.left,
      top: bounds.top,
    };
  };

  return createPortal(
    <section
      ref={windowRef}
      className={`floating-window floating-window--${size}`}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      style={position ? { left: position.left, top: position.top, right: "auto" } : undefined}
    >
      <div className="floating-window-head" onPointerDown={startDrag}>
        <h2>{title}</h2>
        <div className="floating-window-head-actions">
          <span aria-hidden="true">拖动查看原文</span>
          <button className="icon-button" type="button" onClick={onClose} aria-label={closeLabel}>
            <X />
          </button>
        </div>
      </div>
      {children}
    </section>,
    document.body,
  );
}

