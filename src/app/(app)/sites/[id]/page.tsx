'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Ribbon } from '@/components/Ribbon';
import { SeriesChart, type SeriesPoint } from '@/components/SeriesChart';
import { Empty, ErrorNote, HealthDot, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { errorClassText, fmtDateTime, fmtDuration, fmtNumber, incidentLabel, metricLabel, timeAgo } from '@/lib/format';
import { useLive } from '@/lib/socket';
import { siteHealth } from '@/lib/status';
import { useToast } from '@/lib/toast';
import type { ChecksResponse, SiteDetail } from '@/lib/types';
import { useApi } from '@/lib/useApi';

const RANGES = ['1h', '6h', '24h', '7d', '30d'] as const;
type Range = (typeof RANGES)[number];
const RANGE_LABEL: Record<Range, string> = { '1h': '1 jam', '6h': '6 jam', '24h': '24 jam', '7d': '7 hari', '30d': '30 hari' };
const RANGE_HOURS: Record<Range, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 };

function toSeries(res: ChecksResponse | null): SeriesPoint[] {
  if (!res) return [];
  return res.points.map((p) => ({
    t: new Date(p.checked_at).getTime(),
    v: res.kind === 'raw' ? (p.ok === false ? null : p.latency_ms ?? null) : p.avg_latency_ms ?? null,
    down: res.kind === 'raw' ? p.ok === false : (p.failures ?? 0) > 0,
  }));
}

function TargetPanel({ siteId, target, title, range }: { siteId: string; target: 'frontend' | 'backend'; title: string; range: Range }) {
  const res = useApi<ChecksResponse>(`/api/sites/${siteId}/checks?range=${range}&target=${target}`);
  const series = useMemo(() => toSeries(res.data), [res.data]);
  const failures = series.filter((s) => s.down).length;
  return (
    <section className="py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-soft">{failures > 0 ? `${failures} kegagalan dalam ${RANGE_LABEL[range]}` : `Tanpa kegagalan dalam ${RANGE_LABEL[range]}`}</p>
      </div>
      {res.loading && <Spinner />}
      {res.error && <ErrorNote message={res.error} onRetry={res.reload} />}
      {res.data && (
        <>
          <div className="mt-3">
            <Ribbon points={res.data.points} hours={RANGE_HOURS[range]} />
          </div>
          {series.length > 1 ? (
            <div className="mt-4">
              <p className="mb-1 text-sm text-soft">Waktu respons (ms)</p>
              <SeriesChart data={series} unit="ms" long={RANGE_HOURS[range] > 24} label={`Grafik waktu respons ${title}`} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-soft">Belum cukup data untuk grafik.</p>
          )}
        </>
      )}
    </section>
  );
}

function MetricChart({ siteId, names }: { siteId: string; names: string[] }) {
  const [name, setName] = useState(names[0]);
  const [range, setRange] = useState<Range>('24h');
  const res = useApi<{ name: string; points: { collected_at: string; value: number }[] }>(`/api/sites/${siteId}/metrics?name=${encodeURIComponent(name)}&range=${range}`);
  const series: SeriesPoint[] = (res.data?.points || []).map((p) => ({ t: new Date(p.collected_at).getTime(), v: p.value }));
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-3">
        <select aria-label="Metrik" className="field max-w-xs" value={name} onChange={(e) => setName(e.target.value)}>
          {names.map((n) => (
            <option key={n} value={n}>{metricLabel(n)}</option>
          ))}
        </select>
        <select aria-label="Rentang waktu" className="field max-w-[8rem]" value={range} onChange={(e) => setRange(e.target.value as Range)}>
          {RANGES.map((r) => (
            <option key={r} value={r}>{RANGE_LABEL[r]}</option>
          ))}
        </select>
      </div>
      <div className="mt-3">
        {series.length > 1 ? <SeriesChart data={series} unit="" long={RANGE_HOURS[range] > 24} label={`Grafik ${metricLabel(name)}`} /> : <p className="text-sm text-soft">Belum cukup data untuk grafik.</p>}
      </div>
    </div>
  );
}

export default function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [range, setRange] = useState<Range>('24h');
  const [checking, setChecking] = useState(false);
  const { data: site, error, loading, reload } = useApi<SiteDetail>(`/api/sites/${id}`);

  useLive('incident', () => void reload());

  const checkNow = async () => {
    setChecking(true);
    try {
      await api(`/api/sites/${id}/check-now`, { method: 'POST' });
      await reload();
      toast.push('Pengecekan selesai.', 'ok');
    } catch (e) {
      toast.push(errorMessage(e), 'bad');
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <Spinner label="Memuat website" />;
  if (error || !site) return <ErrorNote message={error || 'Website tidak ditemukan.'} onRetry={reload} />;

  const { health, headline } = siteHealth(site);
  const metricNames = Object.keys(site.metrics).sort();
  const open = site.recent_incidents.filter((i) => !i.closed_at);
  const past = site.recent_incidents.filter((i) => i.closed_at);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/dashboard" className="text-accent underline underline-offset-2">Beranda</Link>
      </p>
      <PageHeader
        title={site.name}
        subtitle={headline}
        right={
          <button onClick={checkNow} disabled={checking} className="btn-quiet">
            {checking ? 'Memeriksa…' : 'Periksa sekarang'}
          </button>
        }
      />
      <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <HealthDot health={health} withLabel />
        {site.targets.backend && <span className="text-sm text-soft">Backend {fmtDuration(site.targets.backend.latency_ms)}, dicek {timeAgo(site.targets.backend.checked_at)}</span>}
        {site.targets.backend?.error_class && <span className="text-sm text-bad">{errorClassText(site.targets.backend.error_class)}</span>}
      </div>

      <div role="group" aria-label="Rentang waktu" className="my-4 flex gap-2 overflow-x-auto">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`rounded-full border px-4 py-1.5 text-sm ${range === r ? 'border-accent bg-accent text-accent-ink' : 'border-rule'}`}>
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="rule-y">
        {site.backend_url && <TargetPanel siteId={site.id} target="backend" title="Backend (API)" range={range} />}
        {site.frontend_url && <TargetPanel siteId={site.id} target="frontend" title="Halaman depan" range={range} />}
      </div>

      <section className="border-t border-rule py-6">
        <h2 className="text-xl font-semibold">Insiden</h2>
        {site.recent_incidents.length === 0 && <p className="mt-2 text-soft">Tidak ada insiden tercatat.</p>}
        {open.length > 0 && (
          <ul className="mt-3 space-y-2">
            {open.map((i) => (
              <li key={i.id} className="rounded-lg border border-bad/40 bg-bad/10 px-4 py-3">
                <p className="font-medium">{incidentLabel(i.kind)} <span className="font-normal text-soft">sejak {timeAgo(i.opened_at)}</span></p>
                {i.detail && <p className="text-sm">{i.detail}</p>}
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <ul className="rule-y mt-3">
            {past.map((i) => (
              <li key={i.id} className="py-2 text-sm">
                <span className="font-medium">{incidentLabel(i.kind)}</span> <span className="text-soft">{fmtDateTime(i.opened_at)} sampai {fmtDateTime(i.closed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-rule py-6">
        <h2 className="text-xl font-semibold">Data dari website</h2>
        {metricNames.length === 0 ? (
          <div className="mt-3">
            <Empty
              title="Belum ada metrik"
              hint={site.agent_credential === 'active' ? 'Metrik dikumpulkan berkala. Jika tetap kosong, periksa modul /api/agent di website.' : 'Pasang modul /api/agent di website lalu aktifkan kredensial di Pengaturan.'}
              action={<Link href="/settings" className="btn-quiet">Buka pengaturan</Link>}
            />
          </div>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {metricNames.map((n) => (
                <div key={n}>
                  <dt className="text-sm text-soft">{metricLabel(n)}</dt>
                  <dd className="font-display text-xl">{fmtNumber(site.metrics[n].value)}</dd>
                </div>
              ))}
            </dl>
            <MetricChart siteId={site.id} names={metricNames} />
          </>
        )}
      </section>
    </>
  );
}
