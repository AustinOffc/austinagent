'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'info' | 'ok' | 'bad';
interface ToastItem {
  id: number;
  text: string;
  kind: Kind;
}

const ToastContext = createContext<{ push: (text: string, kind?: Kind) => void }>({ push: () => {} });
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: Kind = 'info') => {
    const id = ++counter;
    setItems((cur) => [...cur.slice(-3), { id, text, kind }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), kind === 'bad' ? 7000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${
              t.kind === 'bad' ? 'bg-bad text-white' : t.kind === 'ok' ? 'bg-ok text-white' : 'bg-ink text-paper'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
