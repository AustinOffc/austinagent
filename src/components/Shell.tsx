'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAppState } from '@/lib/app-state';
import { useSocket } from '@/lib/socket';
import { useToast } from '@/lib/toast';
import type { KillState } from '@/lib/types';
import { Icon, type IconName } from './Icon';
import { TotpDialog } from './TotpDialog';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Beranda', icon: 'home' },
  { href: '/chat', label: 'Chat', icon: 'chat' },
  { href: '/activity', label: 'Aktivitas', icon: 'pulse' },
  { href: '/approvals', label: 'Approval', icon: 'check' },
];
const MORE: NavItem[] = [
  { href: '/tasks', label: 'Tugas terjadwal', icon: 'clock' },
  { href: '/notes', label: 'Catatan dan pengingat', icon: 'note' },
  { href: '/audit', label: 'Jejak audit', icon: 'shield' },
  { href: '/settings', label: 'Pengaturan', icon: 'gear' },
];

function KillSwitchButton() {
  const { kill, setKill } = useAppState();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);

  const engage = async () => {
    setBusy(true);
    try {
      const k = await api<KillState>('/api/system/kill-switch', { method: 'POST', body: { active: true, reason: 'Dihentikan dari dashboard' } });
      setKill(k);
      toast.push('Agent dihentikan. Semua aksi berhenti.', 'bad');
    } catch (e) {
      toast.push(errorMessage(e), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const release = async (code: string) => {
    const k = await api<KillState>('/api/system/kill-switch', { method: 'POST', body: { active: false, code } });
    setKill(k);
    toast.push('Kill switch dilepas. Agent aktif kembali.', 'ok');
  };

  return (
    <>
      {kill?.active ? (
        <button onClick={() => setDialog(true)} className="btn-quiet min-h-[40px] border-bad px-3 py-1.5 text-sm text-bad">
          Lepas kill switch
        </button>
      ) : (
        <button onClick={engage} disabled={busy || kill === null} className="btn min-h-[40px] gap-1.5 border border-bad/70 px-3 py-1.5 text-sm text-bad hover:bg-bad/10">
          <Icon name="power" className="h-4 w-4" />
          Hentikan agent
        </button>
      )}
      <TotpDialog
        open={dialog}
        title="Lepas kill switch"
        description="Agent akan aktif kembali: chat, tool, tugas terjadwal, dan pengumpulan metrik berjalan lagi."
        confirmLabel="Lepas kill switch"
        onSubmit={release}
        onClose={() => setDialog(false)}
      />
    </>
  );
}

function NavLink({ item, badge, compact = false }: { item: NavItem; badge?: number; compact?: boolean }) {
  const path = usePathname();
  const active = path === item.href || path.startsWith(`${item.href}/`) || (item.href === '/dashboard' && path.startsWith('/sites'));
  if (compact) {
    return (
      <Link href={item.href} aria-current={active ? 'page' : undefined} className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? 'font-semibold text-accent' : 'text-soft'}`}>
        <Icon name={item.icon} />
        {item.label}
        {!!badge && <span className="absolute right-[22%] top-1 min-w-[1.1rem] rounded-full bg-bad px-1 text-center text-[11px] font-semibold leading-[1.1rem] text-white">{badge}</span>}
      </Link>
    );
  }
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${active ? 'bg-accent/10 font-semibold text-accent' : 'text-ink hover:bg-ink/5'}`}>
      <Icon name={item.icon} />
      <span className="flex-1">{item.label}</span>
      {!!badge && <span className="rounded-full bg-bad px-2 text-xs font-semibold leading-5 text-white">{badge}</span>}
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { state, logout } = useAuth();
  const { connected } = useSocket();
  const { kill, pendingApprovals } = useAppState();
  const [more, setMore] = useState(false);
  const path = usePathname();
  const moreActive = MORE.some((m) => path.startsWith(m.href));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-rule px-4 py-6 md:flex">
        <Link href="/dashboard" className="mb-8 px-3 font-display text-2xl font-semibold">
          Austin Agent
        </Link>
        <nav aria-label="Menu utama" className="flex flex-1 flex-col gap-1">
          {MAIN.map((n) => (
            <NavLink key={n.href} item={n} badge={n.href === '/approvals' ? pendingApprovals : undefined} />
          ))}
          <div className="my-3 border-t border-rule" />
          {MORE.map((n) => (
            <NavLink key={n.href} item={n} />
          ))}
        </nav>
        <div className="border-t border-rule px-3 pt-4 text-sm">
          <p className="text-soft">Masuk sebagai {state.username}</p>
          <button onClick={() => void logout()} className="mt-1 font-medium text-accent underline underline-offset-2">
            Keluar
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        {kill?.active && (
          <div role="alert" className="bg-bad px-4 py-2 text-center text-sm font-medium text-white">
            Kill switch aktif: semua aksi agent berhenti. Pemantauan uptime tetap berjalan.
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:justify-end md:px-8">
          <Link href="/dashboard" className="font-display text-xl font-semibold md:hidden">
            Austin Agent
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-soft" title={connected ? 'Pembaruan langsung aktif' : 'Menyambung ulang…'}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-ok' : 'bg-warn animate-pulse'}`} aria-hidden="true" />
              {connected ? 'Langsung' : 'Menyambung'}
            </span>
            <KillSwitchButton />
          </div>
        </div>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-2 md:px-8 md:pb-12">{children}</main>
      </div>

      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-rule bg-panel md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {MAIN.map((n) => (
          <NavLink key={n.href} item={n} compact badge={n.href === '/approvals' ? pendingApprovals : undefined} />
        ))}
        <button onClick={() => setMore(true)} aria-haspopup="dialog" className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${moreActive ? 'font-semibold text-accent' : 'text-soft'}`}>
          <Icon name="more" />
          Lainnya
        </button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/50 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && setMore(false)}>
          <div role="dialog" aria-modal="true" aria-label="Menu lainnya" className="w-full rounded-t-sheet bg-panel p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-display text-lg">Lainnya</p>
              <button onClick={() => setMore(false)} aria-label="Tutup" className="p-2 text-soft">
                <Icon name="close" />
              </button>
            </div>
            <div onClick={() => setMore(false)} className="flex flex-col">
              {MORE.map((n) => (
                <NavLink key={n.href} item={n} />
              ))}
              <button onClick={() => void logout()} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-ink hover:bg-ink/5">
                <Icon name="logout" />
                Keluar ({state.username})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
