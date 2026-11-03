'use client';

import { useMemo } from 'react';
import type { CheckPoint } from '@/lib/types';
import { fmtClock } from '@/lib/format';

type Cell = 'none' | 'ok' | 'slow' | 'bad';
const CELL_CLASS: Record<Cell, string> = { none: 'bg-rule/60', ok: 'bg-ok', slow: 'bg-warn', bad: 'bg-bad' };
const CELL_TEXT: Record<Cell, string> = { none: 'tidak ada data', ok: 'sehat', slow: 'lambat', bad: 'gagal' };

// Pita riwayat: tiap kotak = satu jendela waktu. Ini elemen utama dashboard: kondisi 24 jam terakhir
// terbaca sekilas di layar ponsel (hijau = sehat, kuning = lambat, merah = ada kegagalan).
export function Ribbon({ points, hours = 24, buckets = 48, slowMs = 3000 }: { points: CheckPoint[]; hours?: number; buckets?: number; slowMs?: number }) {
  const { cells, healthyPct } = useMemo(() => {
    const now = Date.now();
    const span = hours * 3600e3;
    const size = span / buckets;
    const start = now - span;
    const out: { state: Cell; from: number }[] = Array.from({ length: buckets }, (_, i) => ({ state: 'none' as Cell, from: start + i * size }));
    let total = 0;
    let good = 0;
    for (const p of points) {
      const t = new Date(p.checked_at).getTime();
      const idx = Math.floor((t - start) / size);
      if (idx < 0 || idx >= buckets) continue;
      const failed = p.ok === false || (p.failures ?? 0) > 0;
      const lat = p.latency_ms ?? p.avg_latency_ms ?? 0;
      const state: Cell = failed ? 'bad' : lat > slowMs ? 'slow' : 'ok';
      const cur = out[idx].state;
      if (cur === 'bad' || (cur === 'slow' && state === 'ok')) {
        /* keadaan terburuk di jendela itu menang */
      } else out[idx].state = state;
      total += 1;
      if (state !== 'bad') good += 1;
    }
    return { cells: out, healthyPct: total ? Math.round((good / total) * 1000) / 10 : null };
  }, [points, hours, buckets, slowMs]);

  return (
    <div>
      <div role="img" aria-label={`Riwayat ${hours} jam terakhir${healthyPct !== null ? `, ${healthyPct}% pengecekan sehat` : ', belum ada data'}`} className="flex h-10 items-stretch gap-[2px]">
        {cells.map((c, i) => (
          <span key={i} title={`${fmtClock(c.from)}: ${CELL_TEXT[c.state]}`} className={`flex-1 rounded-[2px] ${CELL_CLASS[c.state]}`} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-soft">
        <span>{hours} jam lalu</span>
        <span>sekarang</span>
      </div>
    </div>
  );
}
