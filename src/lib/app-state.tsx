'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useLive } from './socket';
import { useToast } from './toast';
import type { Approval, KillState } from './types';

interface AppStateValue {
  kill: KillState | null;
  setKill: (k: KillState) => void;
  pendingApprovals: number;
  refreshApprovals: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue>({
  kill: null,
  setKill: () => {},
  pendingApprovals: 0,
  refreshApprovals: async () => {},
});

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [kill, setKill] = useState<KillState | null>(null);
  const [pendingApprovals, setPending] = useState(0);
  const toast = useToast();

  const refreshApprovals = useCallback(async () => {
    try {
      const list = await api<Approval[]>('/api/approvals?status=pending');
      setPending(list.length);
    } catch {
      /* indikator saja; abaikan */
    }
  }, []);

  useEffect(() => {
    void api<KillState>('/api/system/kill-switch').then(setKill).catch(() => {});
    void refreshApprovals();
  }, [refreshApprovals]);

  useLive<KillState>('killswitch', (k) => setKill(k));
  useLive<{ type: string; approval: Approval }>('approval', (e) => {
    void refreshApprovals();
    if (e.type === 'new') toast.push(`Menunggu persetujuan: ${e.approval.tool_name}`, 'info');
  });
  useLive<{ title: string }>('reminder', (r) => toast.push(`Pengingat: ${r.title}`, 'info'));

  return <AppStateContext.Provider value={{ kill, setKill, pendingApprovals, refreshApprovals }}>{children}</AppStateContext.Provider>;
}

export const useAppState = () => useContext(AppStateContext);
