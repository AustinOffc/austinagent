'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Empty, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAppState } from '@/lib/app-state';
import { useLive } from '@/lib/socket';
import { useToast } from '@/lib/toast';
import type { ChatMessage, ChatSession } from '@/lib/types';
import { useApi } from '@/lib/useApi';

// Event 'chat' dari backend. Untuk langkah tool, backend mengirim type 'tool_start' / 'tool_end'.
interface ChatEvent {
  type: 'start' | 'tool_start' | 'tool_end' | 'status' | 'done' | 'error';
  session_id: string;
  name?: string;
  message?: string | { role: string; content: string };
}

export default function ChatPage() {
  const { kill, pendingApprovals } = useAppState();
  const { push } = useToast();
  const sessions = useApi<ChatSession[]>('/api/chat/sessions');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const justCreated = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const reloadSessions = sessions.reload;

  useEffect(() => {
    if (!activeId && sessions.data && sessions.data.length) setActiveId(sessions.data[0].id);
  }, [sessions.data, activeId]);

  const loadMessages = useCallback(
    async (id: string) => {
      try {
        const m = await api<ChatMessage[]>(`/api/chat/sessions/${id}/messages`);
        setMessages(m);
        return m;
      } catch (e) {
        push(errorMessage(e), 'bad');
        return [] as ChatMessage[];
      }
    },
    [push]
  );

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (justCreated.current === activeId) {
      justCreated.current = null;
      return;
    }
    setBusy(false);
    setStatus(null);
    setLoadingMsgs(true);
    void loadMessages(activeId).finally(() => setLoadingMsgs(false));
  }, [activeId, loadMessages]);

  // Cadangan bila Socket.IO terputus: cek pesan baru tiap 3 detik selama agent bekerja.
  useEffect(() => {
    if (!busy || !activeId) return;
    const t = setInterval(async () => {
      const m = await loadMessages(activeId);
      if (m.length && m[m.length - 1].role === 'assistant') {
        setBusy(false);
        setStatus(null);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [busy, activeId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, status]);

  useLive<ChatEvent>('chat', (e) => {
    if (e.session_id !== activeId) return;
    if (e.type === 'tool_start') setStatus(`Memanggil ${e.name}…`);
    else if (e.type === 'tool_end') setStatus(null);
    else if (e.type === 'done' || e.type === 'error') {
      setBusy(false);
      setStatus(null);
      if (e.type === 'error' && typeof e.message === 'string') push(e.message, 'bad');
      if (activeId) void loadMessages(activeId);
      void reloadSessions();
    }
  });

  const newChat = async () => {
    try {
      const s = await api<ChatSession>('/api/chat/sessions', { method: 'POST', body: {} });
      setActiveId(s.id);
      void reloadSessions();
    } catch (e) {
      push(errorMessage(e), 'bad');
    }
  };

  const removeChat = async () => {
    if (!activeId || !window.confirm('Hapus percakapan ini beserta isinya?')) return;
    try {
      await api(`/api/chat/sessions/${activeId}`, { method: 'DELETE' });
      setActiveId(null);
      await reloadSessions();
    } catch (e) {
      push(errorMessage(e), 'bad');
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || kill?.active) return;
    setInput('');
    setBusy(true);
    setStatus(null);
    try {
      let id = activeId;
      if (!id) {
        const s = await api<ChatSession>('/api/chat/sessions', { method: 'POST', body: {} });
        id = s.id;
        justCreated.current = id;
        setActiveId(id);
      }
      setMessages((m) => [...m, { id: -Date.now(), role: 'user', content: text, tool_name: null, created_at: new Date().toISOString() }]);
      await api(`/api/chat/sessions/${id}/messages`, { method: 'POST', body: { text } });
      void reloadSessions();
    } catch (e) {
      setBusy(false);
      setInput(text);
      push(errorMessage(e), 'bad');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Di desktop Enter mengirim (Shift+Enter baris baru). Di layar sentuh Enter = baris baru.
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      <PageHeader title="Chat" subtitle="Tanya status website, ringkas masalah, atau minta catatan dan pengingat." />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Pilih percakapan" className="field min-w-0 flex-1" value={activeId || ''} onChange={(e) => setActiveId(e.target.value || null)}>
          {(sessions.data || []).length === 0 && <option value="">Percakapan baru</option>}
          {(sessions.data || []).map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <button onClick={newChat} className="btn-quiet" aria-label="Percakapan baru">
          <Icon name="plus" />
          <span className="hidden sm:inline">Baru</span>
        </button>
        <button onClick={removeChat} disabled={!activeId} className="btn-quiet" aria-label="Hapus percakapan">
          <Icon name="trash" />
        </button>
      </div>

      <div className="mt-4 min-h-[40vh] space-y-3" aria-live="polite">
        {loadingMsgs && <Spinner label="Memuat pesan" />}
        {!loadingMsgs && messages.length === 0 && (
          <Empty title="Mulai bertanya" hint={'Contoh: "Bagaimana status AustinPay sekarang?" atau "Ingatkan saya besok jam 9 cek withdraw pending."'} />
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 ${m.role === 'user' ? 'bg-accent text-accent-ink' : 'border border-rule bg-panel'}`}>
              {/* Teks apa adanya (bukan HTML/markdown): aman dari XSS tersimpan. */}
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-soft">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-rule border-t-accent" />
            {status || 'Agent sedang bekerja…'}
          </p>
        )}
        {pendingApprovals > 0 && (
          <p className="text-sm">
            Ada {pendingApprovals} aksi menunggu persetujuan. <Link href="/approvals" className="font-medium text-accent underline underline-offset-2">Tinjau di Approval</Link>
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="sticky bottom-[4.75rem] mt-4 flex items-end gap-2 bg-paper pb-2 pt-2 md:bottom-4"
      >
        <label htmlFor="chat-input" className="sr-only">Pesan untuk agent</label>
        <textarea
          id="chat-input"
          className="field max-h-40 min-h-[48px] flex-1 resize-none"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={kill?.active ? 'Kill switch aktif. Chat dinonaktifkan.' : 'Tulis pesan…'}
          maxLength={4000}
          disabled={!!kill?.active}
        />
        <button type="submit" className="btn-primary h-12 w-12 shrink-0 px-0" disabled={busy || !input.trim() || !!kill?.active} aria-label="Kirim">
          <Icon name="send" />
        </button>
      </form>
    </>
  );
}
