import type { SiteSummary, TargetStatus } from './types';
import { errorClassText, incidentLabel } from './format';

export type Health = 'ok' | 'warn' | 'bad' | 'config' | 'unknown';

// Kegagalan karena konfigurasi (bukan website mati). Sama dengan CONFIG_CLASSES di backend.
const CONFIG_CLASSES = new Set(['no_credential', 'not_found', 'auth', 'disabled']);

export function targetHealth(t: TargetStatus | null): Health {
  if (!t) return 'unknown';
  if (t.ok) return 'ok';
  if (t.error_class && CONFIG_CLASSES.has(t.error_class)) return 'config';
  return 'bad';
}

export function siteHealth(s: SiteSummary): { health: Health; headline: string } {
  const fe = targetHealth(s.targets.frontend);
  const be = targetHealth(s.targets.backend);
  if (!s.enabled) return { health: 'unknown', headline: 'Belum diaktifkan. Isi URL website di pengaturan backend.' };
  if (fe === 'unknown' && be === 'unknown') return { health: 'unknown', headline: 'Belum ada data pemantauan.' };
  if (be === 'bad') return { health: 'bad', headline: `Backend ${errorClassText(s.targets.backend?.error_class) || 'bermasalah'}` };
  if (fe === 'bad') return { health: 'bad', headline: `Halaman depan ${errorClassText(s.targets.frontend?.error_class) || 'bermasalah'}` };
  if (be === 'config') return { health: 'config', headline: `Belum bisa dipantau: ${errorClassText(s.targets.backend?.error_class)}` };
  if (s.open_incidents.length) {
    const first = s.open_incidents[0];
    const more = s.open_incidents.length > 1 ? ` dan ${s.open_incidents.length - 1} lainnya` : '';
    return { health: 'warn', headline: `${incidentLabel(first.kind)}${more}` };
  }
  return { health: 'ok', headline: 'Semua lancar' };
}

export const HEALTH_LABEL: Record<Health, string> = {
  ok: 'Sehat',
  warn: 'Perlu dicek',
  bad: 'Bermasalah',
  config: 'Perlu konfigurasi',
  unknown: 'Belum ada data',
};

export const HEALTH_CLASS: Record<Health, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  config: 'bg-warn',
  unknown: 'bg-soft/50',
};
