'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';
import { getAccessToken, refreshSession } from './api';
import { useAuth } from './auth';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (state.status !== 'authed' || !API_URL) return;
    // `auth` sebagai fungsi: setiap (re)connect memakai access token TERBARU.
    const s = io(`${API_URL}/live`, {
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', (reason) => {
      setConnected(false);
      // Server memutus koneksi (token habis): socket.io tidak menyambung ulang sendiri.
      if (reason === 'io server disconnect') void refreshSession().then((ok) => ok && s.connect());
    });
    s.on('connect_error', (err) => {
      if (err.message === 'unauthorized') void refreshSession().then((ok) => ok && s.connect());
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [state.status]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Berlangganan satu event realtime selama komponen aktif. */
export function useLive<T = unknown>(event: string, handler: (payload: T) => void) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (p: T) => ref.current(p);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}
