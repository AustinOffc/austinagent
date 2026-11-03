'use client';

import { useCallback, useEffect, useState } from 'react';
import { Empty, ErrorNote, JsonBlock, PageHeader, RiskPill, RunStatusMark, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtDuration, timeAgo } from '@/lib/format';
import { useLive } from '@/lib/socket';
import type { ToolRun } from '@/lib/types';

interface Filters {
  status: string;
  actor: string;
  site: string;
}

const ACTOR_TEXT: Record<string, string> = { agent: 'Agent', owner: 'Anda', scheduler: 'Penjadwal', system: 'Sistem' };

const matches = (r: ToolRun, f: Filters) => (!f.status || r.status === f.status) && (!f.actor || r.actor === f.actor) && (!f.site || r.site_id === f.site);

export default function ActivityPage() {
  const [filters, setFilters] = useState<Filters>({ status: '', actor: '', site: '' });
  const [items, setItems] = useState<ToolRun[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, ToolRun>>({});

  const load = useCallback(
    async (before: string | null) => {
      setLoading(true);
      const q = new URLSearchParams({ limit: '30' });
      if (filters.status) q.set('status', filters.status);
      if (filters.actor) q.set('actor', filters.actor);
      if (filters.site) q.set('site', filters.site);
      if (before) q.set('before', before);
      try {
        const r = await api<{ items: ToolRun[]; next_before: string | null }>(`/api/activity?${q.toString()}`);
        setItems((cur) => (before ? [...cur, ...r.items] : r.items));
        setNext(r.next_before);
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  useLive<{ type: string; run: ToolRun }>('activity', (e) => {
    setItems((cur) => {
      const exists = cur.some((r) => r.id === e.run.id);
      if (exists) {
        const merged = cur.map((r) => (r.id === e.run.id ? { ...r, ...e.run } : r));
        return merged.filter((r) => matches(r, filters));
      }
      return matches(e.run, filters) ? [e.run, ...cur] : cur;
    });
  });

  const toggle = async (id: string) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    if (!detail[id]) {
      try {
        const d = await api<ToolRun>(`/api/activity/${id}`);
        setDetail((cur) => ({ ...cur, [id]: d }));
      } catch (e) {
        setError(errorMessage(e));
      }
    }
  };

  const sel = (key: keyof Filters, label: string, options: [string, string][]) => (
    <select aria-label={label} className="field min-w-0 flex-1 sm:flex-none sm:w-44" value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}>
      <option value="">{label}: semua</option>
      {options.map(([v, t]) => (
        <option key={v} value={v}>{t}</option>
      ))}
    </select>
  );

  return (
    <>
      <PageHeader title="Aktivitas agent" subtitle="Setiap tool yang dijalankan: apa, kapan, oleh siapa, dan hasilnya. Diperbarui langsung." />
      <div className="mb-4 flex flex-wrap gap-2">
        {sel('status', 'Status', [['ok', 'Selesai'], ['error', 'Gagal'], ['pending_approval', 'Menunggu approval'], ['denied', 'Ditolak'], ['killed', 'Dihentikan'], ['running', 'Berjalan']])}
        {sel('actor', 'Pelaku', [['agent', 'Agent'], ['scheduler', 'Penjadwal'], ['owner', 'Anda']])}
        {sel('site', 'Website', [['austinpay', 'AustinPay'], ['marketplace', 'Marketplace'], ['lucibook', 'Lucibook']])}
      </div>

      {error && <ErrorNote message={error} onRetry={() => void load(null)} />}
      {!loading && items.length === 0 && !error && <Empty title="Belum ada aktivitas" hint="Aktivitas muncul saat agent menjawab di chat atau tugas terjadwal berjalan." />}

      {items.length > 0 && (
        <ol className="rule-y">
          {items.map((r) => (
            <li key={r.id}>
              <button onClick={() => void toggle(r.id)} aria-expanded={open === r.id} className="block w-full py-4 text-left hover:bg-ink/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-display text-lg font-semibold">{r.tool_name}</p>
                    <p className="mt-0.5 text-sm text-soft">
                      {r.site_id || 'internal'} oleh {ACTOR_TEXT[r.actor] || r.actor}, {timeAgo(r.started_at)}
                      {r.duration_ms !== null && `, ${fmtDuration(r.duration_ms)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <RunStatusMark status={r.status} />
                    <RiskPill risk={r.risk} />
                  </div>
                </div>
                {r.error && <p className="mt-2 text-sm text-bad">{r.error}</p>}
              </button>
              {open === r.id && (
                <div className="space-y-3 pb-4">
                  <p className="text-sm text-soft">Mulai {fmtDateTime(r.started_at)}{r.finished_at ? `, selesai ${fmtDateTime(r.finished_at)}` : ''}</p>
                  {!detail[r.id] ? (
                    <Spinner />
                  ) : (
                    <>
                      <div>
                        <p className="mb-1 text-sm font-medium">Input</p>
                        <JsonBlock value={detail[r.id].input ?? {}} />
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-medium">Hasil</p>
                        <JsonBlock value={detail[r.id].output_summary ?? null} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {loading && <Spinner />}
      {next && !loading && (
        <div className="mt-4 flex justify-center">
          <button onClick={() => void load(next)} className="btn-quiet">Muat lebih lama</button>
        </div>
      )}
    </>
  );
}
