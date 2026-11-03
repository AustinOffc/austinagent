'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtClock, fmtDateTime } from '@/lib/format';

export interface SeriesPoint {
  t: number;
  v: number | null;
  down?: boolean;
}

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (n: string) => `rgb(${cs.getPropertyValue(`--${n}`).trim().split(/\s+/).join(' ')})`;
  return { accent: rgb('accent'), bad: rgb('bad'), rule: rgb('rule'), soft: rgb('soft'), panel: rgb('panel'), ink: rgb('ink') };
}

// recharts butuh warna string nyata (bukan var CSS); dibaca dari token tema dan diperbarui saat tema berganti.
function useColors() {
  const [c, setC] = useState<ReturnType<typeof readColors> | null>(null);
  useEffect(() => {
    setC(readColors());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setC(readColors());
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return c;
}

export function SeriesChart({ data, unit, long = false, label }: { data: SeriesPoint[]; unit: string; long?: boolean; label: string }) {
  const colors = useColors();
  if (!colors) return <div className="h-52" />;
  const rows = data.map((d) => ({ ...d, mark: d.down ? 0 : null }));
  const tick = (t: number) => (long ? fmtDateTime(new Date(t).toISOString()).split(' ').slice(0, 2).join(' ') : fmtClock(t));
  return (
    <div role="img" aria-label={label} className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={colors.rule} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} stroke={colors.soft} fontSize={12} tickLine={false} minTickGap={32} />
          <YAxis stroke={colors.soft} fontSize={12} width={44} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: colors.panel, border: `1px solid ${colors.rule}`, borderRadius: 8, color: colors.ink }}
            labelFormatter={(t) => fmtDateTime(new Date(Number(t)).toISOString())}
            formatter={(value, name) => (name === 'mark' ? ['gagal', 'Status'] : [`${value} ${unit}`, 'Nilai'])}
          />
          <Line type="monotone" dataKey="v" stroke={colors.accent} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          <Line dataKey="mark" stroke="none" dot={{ r: 3.5, fill: colors.bad, stroke: colors.bad }} activeDot={false} isAnimationActive={false} legendType="none" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
