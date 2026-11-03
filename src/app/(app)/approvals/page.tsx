'use client';

import { useEffect, useState } from 'react';
import { TotpDialog } from '@/components/TotpDialog';
import { Empty, ErrorNote, JsonBlock, PageHeader, RiskPill, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAppState } from '@/lib/app-state';
import { fmtDateTime } from '@/lib/format';
import { useLive } from '@/lib/socket';
import { useToast } from '@/lib/toast';
import type { Approval } from '@/lib/types';
import { useApi } from '@/lib/useApi';

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const STATUS_TEXT: Record<Approval['status'], string> = {
  pending: 'Menunggu',
  executing: 'Dijalankan',
  executed: 'Disetujui dan dijalankan',
  failed: 'Disetujui, tetapi gagal dijalankan',
  rejected: 'Ditolak',
  expired: 'Kedaluwarsa',
};

function countdown(expiresAt: string, now: number): string | null {
  const s = Math.floor((new Date(expiresAt).getTime() - now) / 1000);
  if (s <= 0) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ApprovalsPage() {
  const { push } = useToast();
  const { refreshApprovals } = useAppState();
  const pending = useApi<Approval[]>('/api/approvals?status=pending');
  const all = useApi<Approval[]>('/api/approvals?limit=30');
  const [target, setTarget] = useState<Approval | null>(null);
  const now = useNow();
  const reloadPending = pending.reload;
  const reloadAll = all.reload;

  useLive('approval', () => {
    void reloadPending();
    void reloadAll();
  });

  const refreshAll = async () => {
    await Promise.all([reloadPending(), reloadAll(), refreshApprovals()]);
  };

  const approve = async (code: string) => {
    if (!target) return;
    const a = await api<Approval>(`/api/approvals/${target.id}/approve`, { method: 'POST', body: { code } });
    push(a.status === 'executed' ? 'Disetujui dan dijalankan.' : 'Disetujui, tetapi eksekusi gagal. Lihat Aktivitas.', a.status === 'executed' ? 'ok' : 'bad');
    await refreshAll();
  };

  const reject = async (a: Approval) => {
    try {
      await api(`/api/approvals/${a.id}/reject`, { method: 'POST' });
      push('Aksi ditolak.', 'ok');
      await refreshAll();
    } catch (e) {
      push(errorMessage(e), 'bad');
    }
  };

  const history = (all.data || []).filter((a) => a.status !== 'pending');

  return (
    <>
      <PageHeader title="Approval" subtitle="Aksi berisiko menunggu keputusan Anda. Menyetujui butuh kode 2FA baru; permintaan berlaku 10 menit." />
      {pending.loading && <Spinner />}
      {pending.error && <ErrorNote message={pending.error} onRetry={pending.reload} />}
      {pending.data && pending.data.length === 0 && <Empty title="Tidak ada yang menunggu" hint="Aksi yang menyangkut uang, kunci API, atau perubahan data setelah membaca teks pengguna akan muncul di sini." />}

      <ul className="space-y-4">
        {(pending.data || []).map((a) => {
          const left = countdown(a.expires_at, now);
          return (
            <li key={a.id} className="rounded-sheet border border-rule bg-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="break-all text-2xl font-semibold">{a.tool_name}</h2>
                <RiskPill risk={a.risk} />
              </div>
              <p className="mt-1 text-sm text-soft">
                {a.site_id || 'internal'}, diminta {fmtDateTime(a.created_at)}
                {left ? `, sisa waktu ${left}` : ''}
              </p>
              {a.reason && <p className="mt-3 text-sm">Alasan: {a.reason}</p>}
              <p className="mt-3 break-words">{a.input_preview}</p>
              <div className="mt-3">
                <JsonBlock value={a.input} />
              </div>
              {left ? (
                <div className="mt-4 flex gap-3">
                  <button className="btn-quiet flex-1" onClick={() => void reject(a)}>Tolak</button>
                  <button className={`${a.risk === 'DANGER' ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={() => setTarget(a)}>Setujui dengan 2FA</button>
                </div>
              ) : (
                <p className="mt-4 text-sm font-medium text-bad">Kedaluwarsa. Minta agent mengulang permintaan ini.</p>
              )}
            </li>
          );
        })}
      </ul>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-xl font-semibold">Riwayat</h2>
          <ul className="rule-y">
            {history.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-all font-medium">{a.tool_name}</p>
                  <p className="text-sm text-soft">{fmtDateTime(a.created_at)}</p>
                </div>
                <span className={`shrink-0 text-sm ${a.status === 'executed' ? 'text-ok' : a.status === 'failed' ? 'text-bad' : 'text-soft'}`}>{STATUS_TEXT[a.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TotpDialog
        open={!!target}
        title={`Setujui ${target?.tool_name ?? ''}`}
        description="Yang dijalankan persis sama dengan yang ditampilkan. Kode 2FA hanya berlaku sekali."
        confirmLabel="Setujui"
        danger={target?.risk === 'DANGER'}
        onSubmit={approve}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
