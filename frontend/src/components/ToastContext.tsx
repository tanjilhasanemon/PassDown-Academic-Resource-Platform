import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (text: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, variant: ToastVariant = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, text, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3800);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-item">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem" }}>
              {toast.variant === "success" && (
                <CheckCircle2 size={18} color="var(--success)" />
              )}
              {toast.variant === "error" && (
                <AlertCircle size={18} color="var(--danger)" />
              )}
              {toast.variant === "info" && <Info size={18} color="var(--info)" />}
              <span>{toast.text}</span>
            </span>
            <button
              type="button"
              className="btn-icon"
              onClick={() => dismiss(toast.id)}
              aria-label="Close notification"
              style={{ padding: "0.25rem", border: "none" }}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}