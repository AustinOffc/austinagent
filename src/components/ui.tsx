import type { ReactNode } from 'react';
import type { Risk, RunStatus } from '@/lib/types';
import { HEALTH_CLASS, HEALTH_LABEL, type Health } from '@/lib/status';

export function Spinner({ label = 'Memuat' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-accent" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-ink">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium text-accent underline underline-offset-2">
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-rule px-5 py-8 text-center">
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-soft">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-prose text-soft">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function HealthDot({ health, withLabel = false }: { health: Health; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_CLASS[health]}`} aria-hidden="true" />
      {withLabel ? <span className="text-sm font-medium">{HEALTH_LABEL[health]}</span> : <span className="sr-only">{HEALTH_LABEL[health]}</span>}
    </span>
  );
}

const RISK_STYLE: Record<Risk, string> = {
  READ: 'border-rule text-soft',
  WRITE: 'border-warn/60 text-warn',
  DANGER: 'border-bad/70 bg-bad/10 text-bad',
};
const RISK_TEXT: Record<Risk, string> = { READ: 'Baca', WRITE: 'Ubah data', DANGER: 'Berbahaya' };

export function RiskPill({ risk }: { risk: Risk }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_STYLE[risk]}`}>{RISK_TEXT[risk]}</span>;
}

const STATUS_TEXT: Record<RunStatus, string> = {
  running: 'Berjalan',
  ok: 'Selesai',
  error: 'Gagal',
  denied: 'Ditolak',
  killed: 'Dihentikan',
  pending_approval: 'Menunggu approval',
};
const STATUS_DOT: Record<RunStatus, string> = {
  running: 'bg-accent animate-pulse',
  ok: 'bg-ok',
  error: 'bg-bad',
  denied: 'bg-soft',
  killed: 'bg-bad',
  pending_approval: 'bg-warn',
};

export function RunStatusMark({ status }: { status: RunStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {STATUS_TEXT[status]}
    </span>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  let text = '';
  try {
    text = JSON.stringify(value, null, 2) ?? '';
  } catch {
    text = String(value);
  }
  if (text.length > 6000) text = `${text.slice(0, 6000)}\n… (dipotong)`;
  return <pre className="max-h-72 overflow-auto rounded-lg border border-rule bg-paper p-3 text-xs leading-relaxed">{text}</pre>;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {children}
    </label>
  );
}
