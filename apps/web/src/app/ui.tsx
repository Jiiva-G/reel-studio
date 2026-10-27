import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const PATHS: Record<string, React.ReactNode> = {
  back: <path d="M10 3 5 8l5 5" />,
  grid: <><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></>,
  palette: <><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2" /></>,
  doc: <><path d="M3 2h7l3 3v9H3z" /><path d="M10 2v3h3" /></>,
  download: <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />,
  upload: <path d="M8 11V3M4.5 6.5 8 3l3.5 3.5M3 13h10" />,
  undo: <><path d="M4 6h6a3 3 0 0 1 0 6H7" /><path d="M6.5 3.5 4 6l2.5 2.5" /></>,
  redo: <><path d="M12 6H6a3 3 0 0 0 0 6h3" /><path d="M9.5 3.5 12 6 9.5 8.5" /></>,
  play: <path d="M5 3.5v9l7-4.5z" />,
  pause: <><path d="M5.5 3.5v9M10.5 3.5v9" /></>,
  copy: <><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></>,
  more: <><circle cx="3" cy="8" r=".8" /><circle cx="8" cy="8" r=".8" /><circle cx="13" cy="8" r=".8" /></>,
  check: <path d="m3 8.5 3 3 7-7" />,
  alert: <><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5M8 11h.01" /></>,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  up: <path d="M4 10l4-4 4 4" />,
  down: <path d="M4 6l4 4 4-4" />,
  plus: <path d="M8 3v10M3 8h10" />,
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
};

export const Icon: React.FC<{ name: keyof typeof PATHS | string; style?: React.CSSProperties; className?: string }> = ({ name, style, className }) => (
  <svg className={`i ${className ?? ""}`} viewBox="0 0 16 16" aria-hidden="true" style={style}>{PATHS[name]}</svg>
);

type Toast = { id: number; text: string; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export const ToastHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = next.current++;
    setToasts((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.action ? 8000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.text}</span>
            {t.action ? <button className="btn" onClick={() => { t.action!.run(); setToasts((xs) => xs.filter((x) => x.id !== t.id)); }}>{t.action.label}</button> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

/** A native <dialog>: focus is trapped and Escape closes it. */
export const Dialog: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; labelledBy?: string }> = ({ open, onClose, title, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title">
      <h2 id="dlg-title">{title}</h2>
      {children}
    </dialog>
  );
};

export const Pill: React.FC<{ kind: "ok" | "bad" | "warn" | "neutral"; children: React.ReactNode; title?: string }> = ({ kind, children, title }) => (
  <span className={`pill ${kind}`} title={title}>{children}</span>
);

export function useCopy() {
  const toast = useToast();
  return (text: string) => navigator.clipboard?.writeText(text).then(() => toast({ text: "Copied" }), () => toast({ text: "Copy failed: select the text and copy it" }));
}
