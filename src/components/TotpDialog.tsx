'use client';

import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (code: string) => Promise<void>;
  onClose: () => void;
}

// Dialog kode 2FA (TOTP) untuk aksi sensitif. Kode baru dibutuhkan setiap kali; kode lama ditolak server.
export function TotpDialog({ open, title, description, confirmLabel, danger = false, onSubmit, onClose }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCode('');
      setError(null);
      setBusy(false);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(code);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
      setCode('');
      input.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="totp-title"
        className="w-full max-w-sm rounded-t-sheet bg-panel p-6 shadow-xl sm:rounded-sheet"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <h2 id="totp-title" className="text-xl font-semibold">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-soft">{description}</p>}
        <label htmlFor="totp-code" className="mt-5 block text-sm font-medium">
          Kode 2FA (6 digit)
        </label>
        <input
          id="totp-code"
          ref={input}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          className="field mt-1 text-center text-2xl tracking-[0.4em]"
          placeholder="••••••"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn-quiet flex-1">
            Batal
          </button>
          <button type="submit" disabled={code.length !== 6 || busy} className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1`}>
            {busy ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
