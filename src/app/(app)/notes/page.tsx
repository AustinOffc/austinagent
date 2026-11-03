'use client';

import { useState } from 'react';
import { Empty, ErrorNote, Label, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useLive } from '@/lib/socket';
import { useToast } from '@/lib/toast';
import type { Item } from '@/lib/types';
import { useApi } from '@/lib/useApi';

type Kind = Item['kind'];
const KINDS: { id: Kind; label: string; singular: string }[] = [
  { id: 'note', label: 'Catatan', singular: 'catatan' },
  { id: 'reminder', label: 'Pengingat', singular: 'pengingat' },
  { id: 'todo', label: 'Tugas', singular: 'tugas' },
];

export default function NotesPage() {
  const { push } = useToast();
  const [kind, setKind] = useState<Kind>('note');
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const items = useApi<Item[]>(`/api/items?kind=${kind}&status=${status}`);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const label = KINDS.find((k) => k.id === kind)!;
  const reload = items.reload;

  useLive('reminder', () => void reload());

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'reminder' && !due) {
      push('Pengingat butuh waktu.', 'bad');
      return;
    }
    setBusy(true);
    try {
      await api('/api/items', {
        method: 'POST',
        body: { kind, title: title.trim(), ...(body.trim() ? { body: body.trim() } : {}), ...(due ? { due_at: new Date(due).toISOString() } : {}) },
      });
      setTitle('');
      setBody('');
      setDue('');
      await reload();
    } catch (err) {
      push(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    try {
      await api(`/api/items/${id}`, { method: 'PATCH', body: data });
      await reload();
    } catch (e) {
      push(errorMessage(e), 'bad');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Hapus item ini?')) return;
    try {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      push(errorMessage(e), 'bad');
    }
  };

  return (
    <>
      <PageHeader title="Catatan dan pengingat" subtitle="Dibuat oleh Anda atau oleh agent atas permintaan Anda. Pengingat dikirim ke dashboard dan Telegram." />
      <div role="tablist" aria-label="Jenis" className="mb-4 flex gap-2">
        {KINDS.map((k) => (
          <button key={k.id} role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)} className={`rounded-full border px-4 py-1.5 text-sm ${kind === k.id ? 'border-accent bg-accent text-accent-ink' : 'border-rule'}`}>
            {k.label}
          </button>
        ))}
      </div>

      <form onSubmit={add} className="mb-6 space-y-3 rounded-sheet border border-rule bg-panel p-4">
        <div>
          <Label htmlFor="n-title">Judul {label.singular}</Label>
          <input id="n-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>
        <div>
          <Label htmlFor="n-body">Isi (opsional)</Label>
          <textarea id="n-body" className="field" rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
        </div>
        {kind !== 'note' && (
          <div>
            <Label htmlFor="n-due">{kind === 'reminder' ? 'Ingatkan pada' : 'Tenggat (opsional)'}</Label>
            <input id="n-due" type="datetime-local" className="field w-auto" value={due} onChange={(e) => setDue(e.target.value)} required={kind === 'reminder'} />
          </div>
        )}
        <button className="btn-primary" disabled={busy || !title.trim()}>{busy ? 'Menyimpan…' : `Simpan ${label.singular}`}</button>
      </form>

      <div role="group" aria-label="Status" className="mb-3 flex gap-4 text-sm">
        <button aria-pressed={status === 'open'} onClick={() => setStatus('open')} className={status === 'open' ? 'font-semibold text-accent underline underline-offset-4' : 'text-soft'}>Terbuka</button>
        <button aria-pressed={status === 'done'} onClick={() => setStatus('done')} className={status === 'done' ? 'font-semibold text-accent underline underline-offset-4' : 'text-soft'}>Selesai</button>
      </div>

      {items.loading && <Spinner />}
      {items.error && <ErrorNote message={items.error} onRetry={items.reload} />}
      {items.data && items.data.length === 0 && <Empty title={`Belum ada ${label.singular}`} hint="Anda juga bisa meminta agent di Chat: &quot;Catat ...&quot; atau &quot;Ingatkan saya ...&quot;." />}
      {items.data && items.data.length > 0 && (
        <ul className="rule-y">
          {items.data.map((it) => {
            const overdue = it.status === 'open' && it.due_at && new Date(it.due_at).getTime() < Date.now();
            return (
              <li key={it.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-display text-lg font-semibold">{it.title}</p>
                    {it.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{it.body}</p>}
                    <p className={`mt-1 text-sm ${overdue ? 'font-medium text-bad' : 'text-soft'}`}>
                      {it.due_at ? `${overdue ? 'Lewat tenggat: ' : 'Pada '}${fmtDateTime(it.due_at)}` : `Dibuat ${fmtDateTime(it.created_at)}`}
                      {it.created_by === 'agent' && ', dibuat agent'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {it.status === 'open' ? (
                      <button className="btn-quiet min-h-[40px] px-3 py-1.5 text-sm" onClick={() => void patch(it.id, { status: 'done' })}>Selesai</button>
                    ) : (
                      <button className="btn-quiet min-h-[40px] px-3 py-1.5 text-sm" onClick={() => void patch(it.id, { status: 'open' })}>Buka lagi</button>
                    )}
                    <button className="btn-quiet min-h-[40px] px-3 py-1.5 text-sm text-bad" onClick={() => void remove(it.id)} aria-label={`Hapus ${it.title}`}>Hapus</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
