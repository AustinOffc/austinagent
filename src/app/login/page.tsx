'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from '@/lib/config';
import { ApiError, errorMessage, loginEnable2fa, loginSetup2fa, loginStep1, loginVerify2fa } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Label } from '@/components/ui';

type Step =
  | { kind: 'credentials' }
  | { kind: 'code'; challenge: string }
  | { kind: 'setup'; challenge: string; secret: string; uri: string };

export default function LoginPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === 'authed') router.replace('/dashboard');
  }, [state.status, router]);

  const fail = (e: unknown) => {
    // Sesi login sementara (5 menit) habis: mulai dari awal.
    if (e instanceof ApiError && (e.code === 'CHALLENGE_EXPIRED' || e.code === 'TOKEN_INVALID')) {
      setStep({ kind: 'credentials' });
      setPassword('');
      setCode('');
    }
    setError(errorMessage(e));
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await loginStep1(username.trim(), password);
      setPassword('');
      if (r.next === '2fa') setStep({ kind: 'code', challenge: r.challenge_token });
      else {
        const s = await loginSetup2fa(r.challenge_token);
        setStep({ kind: 'setup', challenge: r.challenge_token, secret: s.secret, uri: s.otpauth_uri });
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind === 'credentials') return;
    setBusy(true);
    setError(null);
    try {
      if (step.kind === 'code') await loginVerify2fa(step.challenge, code);
      else await loginEnable2fa(step.challenge, code);
      // Redirect dilakukan efek di atas begitu state menjadi authed.
    } catch (err) {
      setCode('');
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-5xl font-semibold leading-none">Austin Agent</h1>
      <p className="mt-3 text-soft">Papan jaga untuk AustinPay, Marketplace, dan Lucibook.</p>

      {!API_URL && (
        <p role="alert" className="mt-6 rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm">
          NEXT_PUBLIC_API_URL belum diisi. Isi di environment Vercel (atau .env.local) lalu build ulang.
        </p>
      )}

      {step.kind === 'credentials' && (
        <form onSubmit={submitCredentials} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="u">Username</Label>
            <input id="u" className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
          </div>
          <div>
            <Label htmlFor="p">Password</Label>
            <input id="p" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || !API_URL}>
            {busy ? 'Memeriksa…' : 'Lanjut ke kode 2FA'}
          </button>
        </form>
      )}

      {step.kind !== 'credentials' && (
        <form onSubmit={submitCode} className="mt-8 space-y-4">
          {step.kind === 'setup' && (
            <div className="space-y-3 rounded-lg border border-rule bg-panel p-4">
              <p className="font-medium">Daftarkan 2FA terlebih dahulu</p>
              <p className="text-sm text-soft">Pindai kode QR dengan aplikasi authenticator (Google Authenticator, Authy, atau 1Password), lalu masukkan kode 6 digit yang muncul.</p>
              <div className="inline-block rounded-lg bg-white p-3">
                <QRCodeSVG value={step.uri} size={176} level="M" bgColor="#ffffff" fgColor="#000000" />
              </div>
              <p className="break-all text-sm">
                <span className="text-soft">Tidak bisa memindai? Ketik kunci ini: </span>
                <span className="font-medium">{step.secret}</span>
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="c">Kode 2FA (6 digit)</Label>
            <input
              id="c"
              className="field text-center text-2xl tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              autoFocus
              required
            />
          </div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
            {busy ? 'Memeriksa…' : step.kind === 'setup' ? 'Aktifkan 2FA dan masuk' : 'Masuk'}
          </button>
          <button type="button" className="w-full text-sm text-soft underline underline-offset-2" onClick={() => { setStep({ kind: 'credentials' }); setCode(''); setError(null); }}>
            Kembali
          </button>
        </form>
      )}
    </main>
  );
}
