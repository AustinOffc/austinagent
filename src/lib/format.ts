// Format tampilan (Bahasa Indonesia). Semua fungsi aman terhadap nilai kosong.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '-';
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export function untilText(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '-';
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  if (s <= 0) return 'sekarang';
  if (s < 60) return `${s} detik lagi`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lagi`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lagi`;
  return `${Math.floor(s / 86400)} hari lagi`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}.${mm}`;
}

export function fmtClock(iso: string | number): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} dtk`;
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return new Intl.NumberFormat('id-ID').format(n);
}

export function fmtUptimeSeconds(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d} hari ${h} jam` : `${h} jam ${Math.floor((sec % 3600) / 60)} menit`;
}

export function intervalText(seconds: number | null): string {
  if (!seconds) return '-';
  if (seconds % 86400 === 0) return `tiap ${seconds / 86400} hari`;
  if (seconds % 3600 === 0) return `tiap ${seconds / 3600} jam`;
  return `tiap ${Math.round(seconds / 60)} menit`;
}

const METRIC_LABELS: Record<string, string> = {
  'summary.pending_deposits.count': 'Deposit pending',
  'summary.pending_withdraws.count': 'Withdraw pending',
  'summary.pending_instant_withdraws.count': 'Withdraw instan pending',
  'summary.stuck.deposits': 'Deposit tertahan',
  'summary.stuck.withdraws': 'Withdraw tertahan',
  'summary.stuck.instant_withdraws': 'Withdraw instan tertahan',
  'reconcile.queue.count': 'Antrean reconcile',
  'reconcile.orphans.count': 'Mutasi orphan',
  'summary.orders.count': 'Order pending',
  'summary.complaints.count': 'Komplain terbuka',
  'summary.deposits.count': 'Deposit pending',
  'summary.withdraws.count': 'Withdraw pending',
  'summary.cs.open_rooms': 'Chat CS terbuka',
  'summary.cs.unanswered': 'CS belum dibalas',
  'stats.users': 'Pengguna',
  'stats.books': 'Buku',
  'stats.notes': 'Catatan',
  'stats.new_users_24h': 'Pengguna baru 24 jam',
  'stats.new_notes_24h': 'Catatan baru 24 jam',
};

export function metricLabel(name: string): string {
  if (METRIC_LABELS[name]) return METRIC_LABELS[name];
  const parts = name.split('.');
  return parts.slice(-2).join(' ').replace(/_/g, ' ');
}

export const HEADLINE_METRICS: Record<string, string[]> = {
  austinpay: ['summary.pending_deposits.count', 'summary.pending_withdraws.count', 'summary.stuck.deposits', 'reconcile.orphans.count'],
  marketplace: ['summary.orders.count', 'summary.deposits.count', 'summary.complaints.count', 'summary.cs.unanswered'],
  lucibook: ['stats.users', 'stats.notes', 'stats.new_users_24h'],
};

export function incidentLabel(kind: string): string {
  const prefix = kind.split(':')[0];
  return (
    ({ down: 'Tidak merespons', slow: 'Lambat', ssl: 'SSL hampir habis', queue: 'Antrean tertahan', config: 'Perlu konfigurasi' } as Record<string, string>)[prefix] || kind
  );
}

export function errorClassText(c: string | null | undefined): string {
  if (!c) return '';
  const map: Record<string, string> = {
    timeout: 'tidak merespons tepat waktu',
    dns: 'domain tidak ditemukan',
    tls: 'masalah sertifikat TLS',
    network: 'koneksi gagal',
    http_5xx: 'error server (5xx)',
    http_4xx: 'ditolak (4xx)',
    degraded: 'status degraded',
    no_credential: 'kredensial agent belum aktif',
    not_found: 'modul /api/agent belum terpasang',
    auth: 'kredensial agent ditolak',
    disabled: 'URL belum diisi',
  };
  return map[c] || c;
}
