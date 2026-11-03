'use client';

import { useEffect, useState } from 'react';
import { TotpDialog } from '@/components/TotpDialog';
import { ErrorNote, Label, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, fmtNumber } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { AiUsage, CredentialRow, SettingsResponse, SettingsValues } from '@/lib/types';
import { useApi } from '@/lib/useApi';

const SITES: { id: string; name: string }[] = [
  { id: 'austinpay', name: 'AustinPay' },
  { id: 'marketplace', name: 'Marketplace' },
  { id: 'lucibook', name: 'Lucibook' },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule py-8">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {hint && <p className="mt-1 max-w-prose text-soft">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function NumberField({ id, label, hint, value, min, max, step = 1, onChange }: { id: string; label: string; hint?: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input id={id} type="number" inputMode="decimal" className="field" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="mt-1 text-sm text-soft">{hint}</p>}
    </div>
  );
}

function SettingsForm({ data, onSaved }: { data: SettingsResponse; onSaved: () => void }) {
  const { push } = useToast();
  const [v, setV] = useState<SettingsValues>(data.settings);
  const [busy, setBusy] = useState(false);
  const usage = useApi<AiUsage>('/api/settings/ai-usage?days=14');
  const set = <K extends keyof SettingsValues>(k: K, val: SettingsValues[K]) => setV((cur) => ({ ...cur, [k]: val }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: Partial<SettingsValues> = {};
    (Object.keys(v) as (keyof SettingsValues)[]).forEach((k) => {
      if (v[k] !== data.settings[k]) (patch as Record<string, unknown>)[k] = v[k];
    });
    if (Object.keys(patch).length === 0) {
      push('Tidak ada perubahan.', 'info');
      return;
    }
    setBusy(true);
    try {
      await api('/api/settings', { method: 'PUT', body: patch });
      push('Pengaturan disimpan.', 'ok');
      onSaved();
    } catch (err) {
      push(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const testTelegram = async () => {
    try {
      const r = await api<{ sent: boolean }>('/api/settings/telegram/test', { method: 'POST' });
      push(r.sent ? 'Pesan tes terkirim ke Telegram.' : 'Pesan tidak terkirim. Periksa token/chat id dan pastikan notifikasi diaktifkan.', r.sent ? 'ok' : 'bad');
    } catch (err) {
      push(errorMessage(err), 'bad');
    }
  };

  const maxTokens = Math.max(1, ...(usage.data?.days || []).map((d) => d.tokens_in + d.tokens_out));

  return (
    <form onSubmit={save}>
      <Section title="Pemantauan" hint="Seberapa sering website dicek dan kapan sebuah masalah dianggap insiden.">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="s1" label="Interval cek uptime (detik)" value={v.monitor_interval_seconds} min={15} max={3600} onChange={(n) => set('monitor_interval_seconds', n)} />
          <NumberField id="s2" label="Interval ambil data website (detik)" value={v.metrics_interval_seconds} min={60} max={3600} onChange={(n) => set('metrics_interval_seconds', n)} />
          <NumberField id="s3" label="Anggap mati setelah gagal berturut-turut" hint="Jumlah pengecekan." value={v.down_after_failures} min={1} max={20} onChange={(n) => set('down_after_failures', n)} />
          <NumberField id="s4" label="Batas lambat (ms)" value={v.slow_latency_ms} min={200} max={60000} step={100} onChange={(n) => set('slow_latency_ms', n)} />
          <NumberField id="s5" label="Peringatan lambat setelah (cek)" value={v.slow_after_checks} min={1} max={60} onChange={(n) => set('slow_after_checks', n)} />
          <NumberField id="s6" label="Peringatan SSL (hari sebelum habis)" value={v.ssl_warn_days} min={1} max={90} onChange={(n) => set('ssl_warn_days', n)} />
          <NumberField id="s7" label="Antrean dianggap tertahan setelah (menit)" hint="Berlaku untuk deposit, withdraw, order, dan antrean lain yang pending." value={v.pending_age_minutes} min={1} max={1440} onChange={(n) => set('pending_age_minutes', n)} />
        </div>
      </Section>

      <Section title="Asisten AI" hint="Batas harian dihitung per hari kalender WIB. Nilai di sini hanya bisa lebih rendah dari batas keras di environment backend.">
        <p className="mb-4 text-sm">
          Status: <span className={data.ai.enabled ? 'font-medium text-ok' : 'font-medium text-bad'}>{data.ai.enabled ? 'terhubung' : 'belum dikonfigurasi (isi AI_BASE_URL, AI_API_KEY, AI_MODEL di backend)'}</span>
          {data.ai.enabled && <span className="text-soft">, provider {data.ai.base_url_host}, mode tool {data.ai.tool_mode}</span>}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="a1">Model</Label>
            <input id="a1" className="field" value={v.ai_model} onChange={(e) => set('ai_model', e.target.value)} maxLength={100} />
          </div>
          <NumberField id="a2" label="Maks token per jawaban" hint={`Batas keras: ${fmtNumber(data.ai.env_ceiling.max_output_tokens)}`} value={v.ai_max_output_tokens} min={64} max={8192} onChange={(n) => set('ai_max_output_tokens', n)} />
          <NumberField id="a3" label="Batas token per hari" hint={`Batas keras: ${fmtNumber(data.ai.env_ceiling.daily_token_limit)}. Efektif: ${fmtNumber(data.ai.effective.tokenLimit)}`} value={v.ai_daily_token_limit} min={1000} max={100000000} step={1000} onChange={(n) => set('ai_daily_token_limit', n)} />
          <NumberField id="a4" label="Batas biaya per hari (USD, 0 = mati)" hint={usage.data && !usage.data.priced ? 'Tarif belum diisi di backend, jadi batas biaya belum efektif.' : `Efektif: ${data.ai.effective.budgetUsd || 'tidak ada'}`} value={v.ai_daily_budget_usd} min={0} max={100000} step={0.5} onChange={(n) => set('ai_daily_budget_usd', n)} />
        </div>
        {usage.data && usage.data.days.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Token per hari (14 hari terakhir)</p>
            <div className="flex h-24 items-end gap-1" role="img" aria-label="Grafik pemakaian token per hari">
              {usage.data.days.map((d) => (
                <div key={d.day} title={`${d.day}: ${fmtNumber(Math.round(d.tokens_in + d.tokens_out))} token`} className="flex-1 rounded-t-sm bg-accent" style={{ height: `${Math.max(4, ((d.tokens_in + d.tokens_out) / maxTokens) * 100)}%` }} />
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Notifikasi Telegram" hint="Insiden, persetujuan, pengingat, dan kill switch dikirim ke Telegram. Token bot dan chat id diatur di environment backend.">
        <p className="mb-4 text-sm">
          Status: <span className={data.telegram.configured ? 'font-medium text-ok' : 'font-medium text-bad'}>{data.telegram.configured ? 'token dan chat id terisi' : 'belum dikonfigurasi'}</span>
        </p>
        <label className="mb-4 flex items-center gap-2">
          <input type="checkbox" checked={v.telegram_enabled} onChange={(e) => set('telegram_enabled', e.target.checked)} /> Kirim notifikasi Telegram
        </label>
        <div>
          <button type="button" className="btn-quiet" onClick={testTelegram} disabled={!data.telegram.configured}>Kirim pesan tes</button>
        </div>
      </Section>

      <div className="sticky bottom-[4.75rem] z-10 border-t border-rule bg-paper py-3 md:bottom-0">
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
      </div>
    </form>
  );
}

type Dialog = { action: 'rotate' | 'activate' | 'revoke'; site: string; keyId?: string } | null;
interface FreshKey {
  site: string;
  key_id: string;
  token: string;
  hmac_secret: string;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { push } = useToast();
  return (
    <div>
      <p className="text-sm text-soft">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-paper px-2 py-1.5 text-sm">{value}</code>
        <button type="button" className="btn-quiet min-h-[36px] px-3 py-1 text-sm" onClick={() => navigator.clipboard.writeText(value).then(() => push('Disalin.', 'ok'), () => push('Gagal menyalin. Salin manual.', 'bad'))}>Salin</button>
      </div>
    </div>
  );
}

const CRED_STATUS: Record<CredentialRow['status'], string> = { active: 'Aktif', pending: 'Menunggu diaktifkan', retired: 'Lama (pensiun)', revoked: 'Dicabut' };

function Credentials() {
  const creds = useApi<CredentialRow[]>('/api/settings/credentials');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [fresh, setFresh] = useState<FreshKey | null>(null);
  const { push } = useToast();

  const run = async (code: string) => {
    if (!dialog) return;
    if (dialog.action === 'rotate') {
      const r = await api<FreshKey>(`/api/settings/credentials/${dialog.site}/rotate`, { method: 'POST', body: { code } });
      setFresh(r);
      push('Kunci baru dibuat. Salin sekarang.', 'ok');
    } else if (dialog.action === 'activate') {
      await api(`/api/settings/credentials/${dialog.site}/activate`, { method: 'POST', body: { code, key_id: dialog.keyId } });
      push('Kunci diaktifkan. Agent kini memakai kunci baru.', 'ok');
    } else {
      await api(`/api/settings/credentials/${dialog.site}/revoke`, { method: 'POST', body: { code } });
      push('Kredensial dicabut. Agent berhenti memanggil website ini.', 'ok');
    }
    await creds.reload();
  };

  const titles = { rotate: 'Buat kunci baru', activate: 'Aktifkan kunci', revoke: 'Cabut kredensial' } as const;

  return (
    <Section title="Kredensial agent ke website" hint="Setiap website punya kunci sendiri (token + HMAC). Rotasi: buat kunci baru, pasang di pengaturan agent website, lalu aktifkan. Tanpa deploy ulang.">
      {creds.loading && <Spinner />}
      {creds.error && <ErrorNote message={creds.error} onRetry={creds.reload} />}
      {fresh && (
        <div role="alert" className="mb-6 space-y-3 rounded-sheet border border-warn/60 bg-warn/10 p-4">
          <p className="font-medium">Kunci baru untuk {SITES.find((s) => s.id === fresh.site)?.name}. Rahasia ini hanya ditampilkan sekali.</p>
          <CopyRow label="Key ID" value={fresh.key_id} />
          <CopyRow label="Token" value={fresh.token} />
          <CopyRow label="HMAC secret" value={fresh.hmac_secret} />
          <p className="text-sm">Pasang ketiganya di pengaturan agent website, lalu tekan Aktifkan di bawah.</p>
          <button className="btn-quiet" onClick={() => setFresh(null)}>Sudah saya simpan</button>
        </div>
      )}
      {creds.data && (
        <ul className="rule-y">
          {SITES.map((s) => {
            const rows = creds.data!.filter((c) => c.site_id === s.id && c.status !== 'revoked');
            const pendingRow = rows.find((c) => c.status === 'pending');
            return (
              <li key={s.id} className="py-5">
                <h3 className="text-xl font-semibold">{s.name}</h3>
                {rows.length === 0 ? <p className="text-sm text-soft">Belum ada kunci.</p> : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {rows.map((c) => (
                      <li key={c.key_id}><span className="font-medium">{CRED_STATUS[c.status]}</span> <span className="text-soft">{c.key_id}, dibuat {fmtDateTime(c.created_at)}</span></li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-quiet min-h-[40px] px-3 py-1.5 text-sm" onClick={() => setDialog({ action: 'rotate', site: s.id })}>Buat kunci baru</button>
                  {pendingRow && <button className="btn-primary min-h-[40px] px-3 py-1.5 text-sm" onClick={() => setDialog({ action: 'activate', site: s.id, keyId: pendingRow.key_id })}>Aktifkan kunci baru</button>}
                  {rows.length > 0 && <button className="btn-quiet min-h-[40px] px-3 py-1.5 text-sm text-bad" onClick={() => setDialog({ action: 'revoke', site: s.id })}>Cabut semua</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TotpDialog
        open={!!dialog}
        title={dialog ? `${titles[dialog.action]}: ${SITES.find((s) => s.id === dialog.site)?.name}` : ''}
        description={dialog?.action === 'revoke' ? 'Agent langsung berhenti memanggil website ini. Hapus juga kunci di pengaturan agent website.' : 'Aksi ini mengubah akses agent ke website dan butuh kode 2FA baru.'}
        confirmLabel={dialog ? titles[dialog.action] : 'Lanjut'}
        danger={dialog?.action === 'revoke'}
        onSubmit={run}
        onClose={() => setDialog(null)}
      />
    </Section>
  );
}

function Security() {
  const { logout, state } = useAuth();
  const { push } = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { current_password: cur, new_password: next, code } });
      push('Password diubah. Silakan login ulang.', 'ok');
      await logout();
    } catch (err) {
      push(errorMessage(err), 'bad');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Keamanan akun" hint={`Masuk sebagai ${state.username}. Mengganti password mencabut semua sesi di semua perangkat.`}>
      <form onSubmit={submit} className="max-w-sm space-y-4">
        <div>
          <Label htmlFor="pw1">Password saat ini</Label>
          <input id="pw1" type="password" className="field" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
        </div>
        <div>
          <Label htmlFor="pw2">Password baru (minimal 12 karakter)</Label>
          <input id="pw2" type="password" className="field" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={12} required />
        </div>
        <div>
          <Label htmlFor="pw3">Kode 2FA</Label>
          <input id="pw3" className="field" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        </div>
        <button className="btn-primary" disabled={busy || code.length !== 6 || next.length < 12 || !cur}>{busy ? 'Menyimpan…' : 'Ganti password'}</button>
      </form>
      <div className="mt-6">
        <button className="btn-quiet" onClick={() => void logout()}>Keluar dari perangkat ini</button>
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<SettingsResponse>('/api/settings');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (data) setVersion((n) => n + 1);
  }, [data]);

  return (
    <>
      <PageHeader title="Pengaturan" />
      {loading && <Spinner />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && <SettingsForm key={version} data={data} onSaved={() => void reload()} />}
      <Credentials />
      <Security />
    </>
  );
}
