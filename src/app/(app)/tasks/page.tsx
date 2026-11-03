'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Empty, ErrorNote, Label, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, intervalText, untilText } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Task, ToolInfo } from '@/lib/types';
import { useApi } from '@/lib/useApi';

const LAST_STATUS: Record<string, string> = {
  ok: 'Berhasil',
  error: 'Gagal',
  running: 'Sedang berjalan',
  killed: 'Dihentikan kill switch',
  pending_approval: 'Menunggu approval',
};

function scheduleText(t: Task): string {
  if (t.daily_at) return `Setiap hari jam ${t.daily_at.replace(':', '.')} WIB`;
  return intervalText(t.interval_seconds).replace(/^tiap/, 'Setiap');
}

function TaskForm({ tools, onDone, onCancel }: { tools: ToolInfo[]; onDone: () => void; onCancel: () => void }) {
  const { push } = useToast();
  const schedulable = tools.filter((t) => t.schedulable);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'tool' | 'prompt'>('tool');
  const [toolName, setToolName] = useState(schedulable[0]?.name || '');
  const [inputText, setInputText] = useState('{}');
  const [prompt, setPrompt] = useState('');
  const [sched, setSched] = useState<'interval' | 'daily'>('interval');
  const [minutes, setMinutes] = useState(60);
  const [dailyAt, setDailyAt] = useState('08:00');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const tool = schedulable.find((t) => t.name === toolName);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let input: Record<string, unknown> = {};
    if (kind === 'tool') {
      try {
        const parsed: unknown = JSON.parse(inputText || '{}');
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('bukan objek');
        input = parsed as Record<string, unknown>;
      } catch {
        push('Input tool harus berupa objek JSON, contoh: {}', 'bad');
        return;
      }
    }
    setBusy(true);
    try {
      await api('/api/tasks', {
        method: 'POST',
        body: {
          name: name.trim(),
          kind,
          ...(kind === 'tool' ? { tool_name: toolName, input } : { prompt: prompt.trim() }),
          ...(sched === 'interval' ? { interval_seconds: Math.max(1, minutes) * 60 } : { daily_at: dailyAt }),
          notify_telegram: notify,
        },
      });
      push('Tugas dibuat.', 'ok');
      onDone();
    } catch (err) {
      push(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-8 space-y-4 rounded-sheet border border-rule bg-panel p-5">
      <h2 className="text-xl font-semibold">Tugas baru</h2>
      <div>
        <Label htmlFor="t-name">Nama tugas</Label>
        <input id="t-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Jenis</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2"><input type="radio" checked={kind === 'tool'} onChange={() => setKind('tool')} /> Jalankan tool</label>
          <label className="flex items-center gap-2"><input type="radio" checked={kind === 'prompt'} onChange={() => setKind('prompt')} /> Tanya AI</label>
        </div>
      </fieldset>
      {kind === 'tool' ? (
        <>
          <div>
            <Label htmlFor="t-tool">Tool</Label>
            <select id="t-tool" className="field" value={toolName} onChange={(e) => setToolName(e.target.value)}>
              {schedulable.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
            {tool && <p className="mt-1 text-sm text-soft">{tool.description}</p>}
          </div>
          <div>
            <Label htmlFor="t-input">Input (JSON)</Label>
            <textarea id="t-input" className="field font-mono text-sm" rows={3} value={inputText} onChange={(e) => setInputText(e.target.value)} />
            {tool && Object.keys(tool.parameters.properties || {}).length > 0 && <p className="mt-1 text-sm text-soft">Parameter: {Object.keys(tool.parameters.properties || {}).join(', ')}</p>}
          </div>
        </>
      ) : (
        <div>
          <Label htmlFor="t-prompt">Perintah untuk agent</Label>
          <textarea id="t-prompt" className="field" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} placeholder="Contoh: Ringkas kondisi ketiga website dan sebutkan yang perlu perhatian." required />
          <p className="mt-1 text-sm text-soft">Memakai kuota AI harian.</p>
        </div>
      )}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Jadwal</legend>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Jenis jadwal" className="field w-auto" value={sched} onChange={(e) => setSched(e.target.value as 'interval' | 'daily')}>
            <option value="interval">Setiap beberapa menit</option>
            <option value="daily">Setiap hari (WIB)</option>
          </select>
          {sched === 'interval' ? (
            <label className="flex items-center gap-2">
              <input aria-label="Menit" type="number" min={1} max={10080} className="field w-28" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /> menit
            </label>
          ) : (
            <input aria-label="Jam" type="time" className="field w-auto" value={dailyAt} onChange={(e) => setDailyAt(e.target.value)} required />
          )}
        </div>
      </fieldset>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Kirim hasilnya ke Telegram
      </label>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-quiet flex-1">Batal</button>
        <button className="btn-primary flex-1" disabled={busy || (kind === 'tool' && !toolName)}>{busy ? 'Menyimpan…' : 'Simpan tugas'}</button>
      </div>
    </form>
  );
}

export default function TasksPage() {
  const { push } = useToast();
  const tasks = useApi<Task[]>('/api/tasks');
  const tools = useApi<ToolInfo[]>('/api/system/tools');
  const [form, setForm] = useState(false);

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    try {
      await fn();
      push(okText, 'ok');
      await tasks.reload();
    } catch (e) {
      push(errorMessage(e), 'bad');
    }
  };

  return (
    <>
      <PageHeader
        title="Tugas terjadwal"
        subtitle="Jalankan tool atau tanya AI secara berkala. Tool berbahaya tidak bisa dijadwalkan."
        right={!form && tools.data ? <button className="btn-primary" onClick={() => setForm(true)}><Icon name="plus" />Tugas baru</button> : undefined}
      />
      {form && tools.data && <TaskForm tools={tools.data} onCancel={() => setForm(false)} onDone={() => { setForm(false); void tasks.reload(); }} />}
      {tasks.loading && <Spinner />}
      {tasks.error && <ErrorNote message={tasks.error} onRetry={tasks.reload} />}
      {tasks.data && tasks.data.length === 0 && !form && <Empty title="Belum ada tugas" hint="Contoh: ringkasan pagi tiap hari jam 07.00 WIB yang dikirim ke Telegram." />}
      {tasks.data && tasks.data.length > 0 && (
        <ul className="rule-y">
          {tasks.data.map((t) => (
            <li key={t.id} className="py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-semibold">{t.name}</h2>
                  <p className="text-sm text-soft">
                    {t.kind === 'tool' ? `Tool ${t.tool_name}` : 'Tanya AI'}, {scheduleText(t)}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input type="checkbox" checked={t.enabled} onChange={(e) => void act(() => api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { enabled: e.target.checked } }), e.target.checked ? 'Tugas diaktifkan.' : 'Tugas dinonaktifkan.')} />
                  Aktif
                </label>
              </div>
              {t.kind === 'prompt' && t.prompt && <p className="mt-2 break-words text-sm">{t.prompt}</p>}
              <p className="mt-2 text-sm text-soft">
                {t.enabled && t.next_run_at ? `Berikutnya ${untilText(t.next_run_at)} (${fmtDateTime(t.next_run_at)})` : 'Tidak dijadwalkan'}
                {t.last_run_at && `. Terakhir ${fmtDateTime(t.last_run_at)}: ${LAST_STATUS[t.last_status || ''] || t.last_status || '-'}`}
              </p>
              {t.last_error && <p className="mt-1 text-sm text-bad">{t.last_error}</p>}
              <div className="mt-3 flex gap-3">
                <button className="btn-quiet min-h-[40px] px-3 py-1.5 text-sm" onClick={() => void act(() => api(`/api/tasks/${t.id}/run`, { method: 'POST' }), 'Tugas dijalankan di latar belakang.')}>Jalankan sekarang</button>
                <button className="btn-quiet min-h-[40px] px-3 py-1.5 text-sm text-bad" onClick={() => window.confirm(`Hapus tugas "${t.name}"?`) && void act(() => api(`/api/tasks/${t.id}`, { method: 'DELETE' }), 'Tugas dihapus.')}>Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
