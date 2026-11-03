'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { SocketProvider } from '@/lib/socket';
import { AppStateProvider } from '@/lib/app-state';
import { Shell } from '@/components/Shell';
import { Spinner } from '@/components/ui';

// Gerbang login. Token tidak terlihat di server (Bearer di memori), jadi pemeriksaan dilakukan di klien;
// keamanan sebenarnya ada di backend: setiap endpoint memverifikasi token.
export default function AppLayout({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'anon') router.replace('/login');
  }, [state.status, router]);

  if (state.status !== 'authed') {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm items-center justify-center">
        <Spinner label="Menyiapkan sesi" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <AppStateProvider>
        <Shell>{children}</Shell>
      </AppStateProvider>
    </SocketProvider>
  );
}
