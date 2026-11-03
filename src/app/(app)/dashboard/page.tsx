'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Ribbon } from '@/components/Ribbon';
import { Empty, ErrorNote, HealthDot, PageHeader, RunStatusMark, Spinner } from '@/components/ui';
import { useAppState } from '@/lib/app-state';
import { fmtDuration, fmtNumber, HEADLINE_METRICS, metricLabel, timeAgo } from '@/lib/format';
import { useLive } from '@/lib/socket';
import { siteHealth, targetHealth } from '@/lib/status';
import type { AiUsage, ChecksResponse, SiteSummary, TargetStatus, ToolRun } from '@/lib/types';
import { useApi } from '@/lib/useApi';

interface StatusEvent {
  site_id: string;
  target: 'frontend' | 'backend';
  ok: boolean;
  latency_ms: number | null;
  error_class: string | null;
  at: string;
}

function SiteRow({ site }: { site: SiteSummary }) {
  const target: 'frontend' | 'backend' = site.backend_url ? 'backend' : 'frontend';
  const checks = useApi<ChecksResponse>(`/api/sites/${site.id}/checks?range=24h&target=${target}`);
  const { reload } = checks;
  useEffect(() => {
    const t = setInterval(() => void reload(), 60000);
    return () => clearInterval(t);
  }, [reload]);

  const { health, headline } = siteHealth(site);
  const t = site.targets[target];
  const metrics = (HEADLINE_METRICS[site.id] || []).filter((k) => site.metrics[k] !== undefined).slice(0, 4);

  return (
    <li>
      <Link href={`/sites/${site.id}`} className="block py-6 hover:bg-ink/[0.03]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-3xl font-semibold">{site.name}</h2>
          <HealthDot health={health} withLabel />
        </div>
        <p className="mt-1 text-soft">{headline}</p>
        <div className="mt-4">
          {checks.loading ? <div className="h-[3.75rem]" /> : <Ribbon points={checks.data?.points || []} />}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-soft">Respons {target === 'backend' ? 'backend' : 'halaman'}</dt>
            <dd className="font-display text-xl">{fmtDuration(t?.latency_ms)}</dd>
          </div>
          <div>
            <dt className="text-sm text-soft">Sehat 24 jam</dt>
            <dd className="font-display text-xl">{t?.uptime_24h_pct != null ? `${t.uptime_24h_pct}%` : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-soft">Sertifikat SSL</dt>
            <dd className="font-display text-xl">{t?.ssl_days_left != null ? `${t.ssl_days_left} hari` : '-'}</dd>
          </div>
          {metrics.map((k) => (
            <div key={k}>
              <dt className="text-sm text-soft">{metricLabel(k)}</dt>
              <dd className="font-display text-xl">{fmtNumber(site.metrics[k].value)}</dd>
            </div>
          ))}
        </dl>
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const { data: sites, error, loading, reload, setData } = useApi<SiteSummary[]>('/api/sites');
  const ai = useApi<AiUsage>('/api/settings/ai-usage?days=1');
  const act = useApi<{ items: ToolRun[] }>('/api/activity?limit=8');
  const { kill, pendingApprovals } = useAppState();

  useLive<StatusEvent>('site:status', (e) => {
    setData((cur) =>
      cur
        ? cur.map((s) => {
            if (s.id !== e.site_id) return s;
            const prev: TargetStatus = s.targets[e.target] ?? { ok: e.ok, status_code: null, latency_ms: null, error_class: null, ssl_days_left: null, checked_at: e.at, uptime_24h_pct: null, avg_latency_24h_ms: null };
            return { ...s, targets: { ...s.targets, [e.target]: { ...prev, ok: e.ok, latency_ms: e.latency_ms, error_class: e.error_class, checked_at: e.at } } };
          })
        : cur
    );
  });
  useLive('incident', () => void reload());
  useLive<{ type: string; run: ToolRun }>('activity', (e) => {
    act.setData((cur) => {
      const items = cur?.items ?? [];
      const exists = items.some((r) => r.id === e.run.id);
      return { items: exists ? items.map((r) => (r.id === e.run.id ? { ...r, ...e.run } : r)) : [e.run, ...items].slice(0, 8) };
    });
  });

  const problems = (sites || []).filter((s) => ['bad', 'warn', 'config'].includes(siteHealth(s).health)).length;
  const monitored = (sites || []).filter((s) => s.enabled && (targetHealth(s.targets.backend) !== 'unknown' || targetHealth(s.targets.frontend) !== 'unknown')).length;
  const title = !sites ? 'Beranda' : problems === 0 && monitored > 0 ? 'Semua website lancar' : problems > 0 ? `${problems} dari ${sites.length} website perlu dicek` : 'Belum ada data pemantauan';

  const aiPct = ai.data ? Math.min(100, Math.round((ai.data.today.tokens / Math.max(ai.data.limits.tokenLimit, 1)) * 100)) : 0;

  return (
    <>
      <PageHeader title={title} subtitle="Kondisi 24 jam terakhir. Ketuk satu website untuk melihat grafik dan insiden." />
      {loading && <Spinner label="Memuat status website" />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {sites && sites.length === 0 && <Empty title="Belum ada website" hint="Isi URL website di environment backend lalu jalankan npm run seed." />}
      {sites && sites.length > 0 && <ul className="rule-y">{sites.map((s) => <SiteRow key={s.id} site={s} />)}</ul>}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="needs">
          <h2 id="needs" className="mb-3 text-xl font-semibold">Perlu tindakan</h2>
          <ul className="rule-y rounded-lg border border-rule bg-panel">
            <li>
              <Link href="/approvals" className="flex items-center justify-between px-4 py-3 hover:bg-ink/5">
                <span>Persetujuan menunggu</span>
                <span className={`font-display text-xl ${pendingApprovals ? 'text-bad' : 'text-soft'}`}>{pendingApprovals}</span>
              </Link>
            </li>
            <li className="flex items-center justify-between px-4 py-3">
              <span>Kill switch</span>
              <span className={kill?.active ? 'font-medium text-bad' : 'text-soft'}>{kill === null ? '-' : kill.active ? 'Aktif, agent berhenti' : 'Mati, agent berjalan'}</span>
            </li>
            <li className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span>Pemakaian AI hari ini</span>
                <span className="text-soft">{ai.data ? `${fmtNumber(Math.round(ai.data.today.tokens))} dari ${fmtNumber(ai.data.limits.tokenLimit)} token` : '-'}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={aiPct} aria-valuemin={0} aria-valuemax={100} aria-label="Pemakaian token AI hari ini">
                <div className={`h-full ${aiPct >= 90 ? 'bg-bad' : aiPct >= 70 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${aiPct}%` }} />
              </div>
            </li>
          </ul>
        </section>

        <section aria-labelledby="recent">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="recent" className="text-xl font-semibold">Aktivitas terbaru</h2>
            <Link href="/activity" className="text-sm font-medium text-accent underline underline-offset-2">Lihat semua</Link>
          </div>
          {act.data && act.data.items.length === 0 && <Empty title="Belum ada aktivitas" hint="Aktivitas muncul saat agent atau tugas terjadwal menjalankan tool." />}
          {act.data && act.data.items.length > 0 && (
            <ul className="rule-y rounded-lg border border-rule bg-panel">
              {act.data.items.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.tool_name}</p>
                    <p className="text-sm text-soft">{timeAgo(r.started_at)}</p>
                  </div>
                  <RunStatusMark status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
