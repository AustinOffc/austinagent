# CLAUDE.md — agent-frontend (Austin Agent)

Panduan untuk AI coding assistant. Baca seluruhnya sebelum mengubah apa pun.

## Ringkasan project
Dashboard Austin Agent: status 3 website (AustinPay, Marketplace, Lucibook), grafik uptime/latency, chat dengan agent, timeline aktivitas realtime, approval, tugas terjadwal, catatan, audit, pengaturan, kill switch. Project TERPISAH dari `agent-backend` dan dari tiga website; tidak ada import kode lintas project. Semua data lewat API backend.

## Stack
Next.js 14 (App Router) + TypeScript (strict) + Tailwind 3 + recharts + socket.io-client + qrcode.react. Hanya halaman klien (`'use client'`); tidak ada API route Next.js. **Jangan menambah dependency tanpa alasan kuat.**

## Perintah penting
```
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit (jalankan sebelum menyerahkan perubahan)
npm run build       # build produksi (juga memeriksa tipe)
```

## Struktur
`src/app/(app)/*` = halaman di balik login; `src/app/login` = login/2FA; `src/components` = komponen bersama; `src/lib` = klien API, auth, socket, state global, format, tipe. Aturan: halaman memanggil `api()` / `useApi()` dari `lib`, tidak memakai `fetch` langsung. Tipe respons backend ada di `lib/types.ts` dan harus mengikuti README backend.

## Konvensi kode
- Komentar dan teks UI Bahasa Indonesia (kalimat biasa, bukan HURUF BESAR); nama variabel/fungsi/komponen Bahasa Inggris.
- Teks UI: kata kerja aktif, spesifik ("Simpan pengaturan", bukan "Submit"); nama aksi sama di tombol dan toast. Pesan error menjelaskan apa yang salah dan cara memperbaikinya, tanpa permintaan maaf.
- Gaya visual: token warna lewat CSS variable di `globals.css` (terang/gelap), kelas Tailwind `paper/panel/ink/soft/rule/accent/ok/warn/bad`. Jangan hardcode hex di komponen (kecuali QR code). Elemen khas: pita riwayat (`Ribbon`). Pertahankan: daftar bergaya buku catatan (`rule-y`) bukan kartu seragam, target sentuh >= 44px, fokus terlihat, `prefers-reduced-motion` dihormati.
- Status tidak boleh hanya warna: selalu ada teks (`HealthDot`, `RunStatusMark`).
- Mobile-first: uji di lebar ~375px. Bottom nav dan tombol kirim chat sudah memperhitungkan safe area.

## Aturan keamanan (TIDAK BOLEH DILONGGARKAN)
1. Access token hanya di memori (`lib/api.ts`). Jangan menulisnya ke localStorage/sessionStorage/cookie/log. Hanya refresh token di localStorage (`aa.rt`).
2. Jangan memakai `dangerouslySetInnerHTML`, `innerHTML`, atau merender markdown/HTML dari API. Teks dari backend (chat, nama produk, tiket, hasil tool) dirender sebagai teks biasa. Ini pertahanan XSS tersimpan dan prompt injection di sisi tampilan.
3. Jangan menambah skrip pihak ketiga (analytics, widget, CDN). CSP mengunci `connect-src` ke domain API dan skrip ke `'self'` (+ inline Next.js).
4. Tidak ada secret di frontend. Semua variabel `NEXT_PUBLIC_*` terlihat publik. Jangan hardcode URL produksi; satu-satunya sumber adalah `NEXT_PUBLIC_API_URL` via `lib/config.ts`.
5. Aksi sensitif memakai `TotpDialog` (kode 2FA baru): approve, rotasi/aktivasi/cabut kredensial, lepas kill switch, ganti password. Jangan menyimpan atau mengulang kode TOTP.
6. Kill switch aktif = chat dinonaktifkan di UI; jangan membuat jalur UI yang menjalankan aksi agent saat `kill.active`.
7. Rahasia kredensial baru (token/HMAC) hanya ditampilkan sekali di state React; jangan disimpan atau dicatat.
8. Gerbang login di `(app)/layout.tsx` hanyalah kenyamanan UI. Keamanan sebenarnya ada di backend; jangan menganggap halaman "terlindungi" karena redirect klien.

## Aturan level risiko tool
Level (READ / WRITE / DANGER) ditegakkan sepenuhnya di backend. Frontend hanya menampilkan (`RiskPill`) dan menyediakan alur approval + 2FA. Jangan menyembunyikan label risiko, jangan membuat tombol "setujui otomatis", dan jangan menampilkan tool DANGER di form tugas terjadwal (backend juga menolak).

## Menambah tool / halaman
- Tool baru: tidak perlu ubah frontend (daftar dari `/api/system/tools`). Label metrik opsional di `lib/format.ts`.
- Halaman baru: taruh di `src/app/(app)/<nama>/page.tsx`, tambahkan ke `MAIN`/`MORE` di `components/Shell.tsx`. Gunakan `useApi` untuk data, `useLive` untuk realtime, `useToast().push` (destructure `push` agar stabil di dependency hook).

## Larangan mengubah di luar permintaan
- Jangan mengubah kontrak API atau tipe respons tanpa memeriksa backend.
- Jangan merombak desain, mengganti font/palet, atau memformat ulang file yang tidak terkait permintaan.
- Jangan menghapus penanganan error/empty/loading state atau atribut aksesibilitas (aria-*, label) agar kode lebih singkat.
- Jangan menurunkan `strict` TypeScript atau memakai `ignoreBuildErrors`.

## Cara testing
Belum ada unit test otomatis. Sebelum menyerahkan: `npm run typecheck` dan `npm run build` harus bersih. Uji manual: login + 2FA, refresh token (tunggu >15 menit atau ubah `ACCESS_TOKEN_TTL_MINUTES` di backend), Socket.IO tersambung (indikator "Langsung"), kill switch aktif/lepas, alur approval, tampilan 375px dan mode gelap.

## Catatan deploy
Vercel: set `NEXT_PUBLIC_API_URL` lalu **redeploy** (dibaca saat build). Domain A harus ada di `ALLOWED_ORIGINS` backend. Font Google diunduh saat build (butuh internet).

## Jebakan umum
- **CORS**: 403 "Origin tidak diizinkan" = domain A belum di `ALLOWED_ORIGINS`; URL preview Vercel tidak otomatis diizinkan.
- **Tunnel**: Socket.IO butuh WebSocket lewat Cloudflare; bila terblokir akan jatuh ke polling (indikator "Menyambung").
- **Token**: Socket.IO memakai `auth` sebagai fungsi agar tiap reconnect memakai token terbaru. Jangan diganti dengan nilai statis. Refresh diserialisasi (`navigator.locks`) agar rotasi refresh token antar-tab tidak memicu deteksi reuse.
- **Event chat**: backend mengirim langkah tool sebagai `type: 'tool_start' | 'tool_end'` (bukan 'status').
- **Port Pterodactyl / IP database**: urusan backend; lihat CLAUDE.md backend.
- **Variabel NEXT_PUBLIC_***: berubah hanya setelah build ulang.
