import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { t, type DisplayLanguage } from "../i18n/ui";

export function ConfirmDeleteModal({
  title = "确认删除",
  message,
  onClose,
  onConfirm,
  confirmLabel = "确认删除",
  disabled = false,
  displayLanguage = "zh-CN",
}: {
  title?: string;
  message: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  disabled?: boolean;
  displayLanguage?: DisplayLanguage;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirm = async () => {
    if (disabled || isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} layer="confirmation">
      <p className="modal-copy">{message}</p>
      <p className="modal-copy danger-copy">删除后无法恢复。</p>
      <div className="form-actions">
        <button className="cancel-button" type="button" disabled={isConfirming} onClick={onClose}>{t(displayLanguage, "cancel")}</button>
        <button className="primary-button danger-button" type="button" disabled={disabled || isConfirming} onClick={() => void confirm()}>{isConfirming ? "正在删除…" : confirmLabel}</button>
      </div>
    </Modal>
  );
}