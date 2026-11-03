'use client';

import { useCallback, useEffect, useState } from 'react';
import { Empty, ErrorNote, JsonBlock, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { AuditEntry } from '@/lib/types';

const ACTION_TEXT: Record<string, string> = {
  'auth.login': 'Login berhasil',
  'auth.login_failed': 'Login gagal',
  'auth.logout': 'Logout',
  'auth.totp_failed': 'Kode 2FA salah',
  'auth.2fa_enabled': '2FA diaktifkan',
  'auth.password_changed': 'Password diubah',
  'auth.refresh_reuse_detected': 'Token lama dipakai ulang, sesi dicabut',
  'approval.approve': 'Approval disetujui',
  'approval.reject': 'Approval ditolak',
  'killswitch.engage': 'Kill switch diaktifkan',
  'killswitch.release': 'Kill switch dilepas',
  'credential.rotate': 'Kunci agent baru dibuat',
  'credential.activate': 'Kunci agent diaktifkan',
  'credential.revoke': 'Kunci agent dicabut',
  'settings.update': 'Pengaturan diubah',
  'site.check_now': 'Pengecekan manual',
  'task.create': 'Tugas dibuat',
  'task.update': 'Tugas diubah',
  'task.delete': 'Tugas dihapus',
  'task.run_now': 'Tugas dijalankan manual',
};

export default function AuditPage() {
  const { push } = useToast();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async (before: number | null) => {
    setLoading(true);
    try {
      const r = await api<{ items: AuditEntry[]; next_before: number | null }>(`/api/system/audit?limit=50${before ? `&before=${before}` : ''}`);
      setItems((cur) => (before ? [...cur, ...r.items] : r.items));
      setNext(r.next_before);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await api<{ ok: boolean; checked: number; brokenAt: number | null }>('/api/system/audit/verify');
      push(r.ok ? `Rantai audit utuh (${r.checked} entri diperiksa).` : `Rantai audit RUSAK pada entri #${r.brokenAt}. Selidiki segera.`, r.ok ? 'ok' : 'bad');
    } catch (e) {
      push(errorMessage(e), 'bad');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Jejak audit"
        subtitle="Semua login dan aksi penting. Entri tidak bisa diubah atau dihapus, dan saling terkait lewat hash."
        right={<button className="btn-quiet" onClick={verify} disabled={verifying}>{verifying ? 'Memeriksa…' : 'Verifikasi rantai'}</button>}
      />
      {error && <ErrorNote message={error} onRetry={() => void load(null)} />}
      {!loading && items.length === 0 && !error && <Empty title="Belum ada entri" />}
      {items.length > 0 && (
        <ol className="rule-y">
          {items.map((a) => (
            <li key={a.id}>
              <button onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id} className="block w-full py-3 text-left hover:bg-ink/[0.03]">
                <p className="font-medium">{ACTION_TEXT[a.action] || a.action}</p>
                <p className="text-sm text-soft">
                  {fmtDateTime(a.at)}, oleh {a.actor}
                  {a.target ? `, ${a.target}` : ''}
                  {a.ip ? `, IP ${a.ip}` : ''}
                </p>
              </button>
              {open === a.id && <div className="pb-3"><JsonBlock value={{ aksi: a.action, detail: a.detail }} /></div>}
            </li>
          ))}
        </ol>
      )}
      {loading && <Spinner />}
      {next && !loading && (
        <div className="mt-4 flex justify-center">
          <button className="btn-quiet" onClick={() => void load(next)}>Muat lebih lama</button>
        </div>
      )}
    </>
  );
}
