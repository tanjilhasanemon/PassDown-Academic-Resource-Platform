import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog that prevents accidental destructive actions
 * and provides an explicit Cancel / Escape exit (Nielsen H3 & H5).
 */
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDanger = true,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            color: "var(--text-secondary)",
            fontSize: "0.92rem",
            lineHeight: 1.55,
          }}
        >
          {isDanger && (
            <AlertTriangle
              size={20}
              style={{ color: "var(--danger, #b91c1c)", flexShrink: 0, marginTop: "2px" }}
              aria-hidden="true"
            />
          )}
          <p style={{ margin: 0 }}>{message}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDanger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
