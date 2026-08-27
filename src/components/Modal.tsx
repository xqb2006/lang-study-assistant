import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalLayer = "standard" | "confirmation" | "priority";

const modalLayerZIndex: Record<ModalLayer, number> = {
  standard: 1200,
  confirmation: 4200,
  priority: 3200,
};

export function Modal({
  title,
  onClose,
  children,
  layer = "standard",
  closeLabel = "关闭",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  layer?: ModalLayer;
  closeLabel?: string;
}) {
  const isCreateContent = title === "新建书籍";
  const displayTitle = isCreateContent ? "创建阅读内容" : title;
  const resolvedLayer =
    layer === "standard" && (title.includes("智能文件") || title.includes("识图"))
      ? "priority"
      : layer;

  return createPortal(
    <div className="backdrop" style={{ zIndex: modalLayerZIndex[resolvedLayer] }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={displayTitle}>
        <div className="modal-head">
          <h2>{displayTitle}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label={closeLabel}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}