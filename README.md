# Austin Agent — Frontend (Dashboard)

Dashboard web untuk **Austin Agent**: memantau AustinPay, Marketplace, dan Lucibook; chat dengan agent; melihat semua aktivitas agent secara realtime; menyetujui aksi berisiko; dan mengatur semuanya dari ponsel maupun desktop. Project ini terpisah dari `agent-backend` (tidak ada kode yang di-import dari sana) dan hanya bicara lewat API.

- Next.js 14 (App Router) + TypeScript + Tailwind CSS, deploy di **Vercel** (domain A)
- Auth Bearer: access token pendek **hanya di memori**, refresh token di `localStorage` (rotasi + deteksi reuse di server). Tidak memakai cookie pihak ketiga
- Realtime: Socket.IO (`/live`) dengan cadangan polling
- Dependency seminimal mungkin: `recharts` (grafik), `socket.io-client`, `qrcode.react` (pendaftaran 2FA)

## Arsitektur

```
 Ponsel / Desktop (Austin)
      │  HTTPS
      ▼
 Vercel (domain A)  ── Next.js: halaman klien, token di memori
      │  fetch + Authorization: Bearer ...      wss: Socket.IO /live (token di handshake)
      ▼
 agent-backend (domain B, Cloudflare Tunnel → Pterodactyl)
```

Halaman: Login (+ pendaftaran 2FA), Beranda (status 3 website), Detail website (grafik uptime/latency, insiden, metrik), Chat, Aktivitas, Approval, Tugas terjadwal, Catatan dan pengingat, Jejak audit, Pengaturan (interval cek, ambang alert, AI, Telegram, kredensial agent, keamanan). Kill switch ada di bilah atas semua halaman.

## Struktur folder

```
agent-frontend/
├── package.json  tsconfig.json  next.config.mjs  tailwind.config.ts  postcss.config.js
├── .env.example  .gitignore  README.md  CLAUDE.md
└── src/
    ├── app/
    │   ├── layout.tsx  globals.css  page.tsx       # root, font, token warna (terang/gelap)
    │   ├── login/page.tsx                          # login + 2FA + pendaftaran 2FA
    │   └── (app)/                                  # semua halaman di balik login
    │       ├── layout.tsx                          # gerbang login + Socket + status global
    │       ├── dashboard/  sites/[id]/  chat/  activity/
    │       └── approvals/  tasks/  notes/  audit/  settings/
    ├── components/   Shell, TotpDialog, Ribbon, SeriesChart, Icon, ui
    └── lib/          api (Bearer + refresh), auth, socket, app-state, toast, format, status, types, useApi, config
```

## Requirement

- Node.js >= 18.18 (disarankan 20 LTS)
- `agent-backend` yang sudah jalan (lihat README backend) dan domain A masuk di `ALLOWED_ORIGINS` backend

## Jalan lokal

```bash
cd agent-frontend
npm install
cp .env.example .env.local     # isi NEXT_PUBLIC_API_URL
npm run dev                    # http://localhost:3000
npm run typecheck              # cek tipe TypeScript
npm run build                  # uji build produksi
```

Untuk lokal, tambahkan `http://localhost:3000` ke `ALLOWED_ORIGINS` di backend.

## Environment variable

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ya | URL backend (domain B) lewat tunnel, tanpa slash akhir. Dibaca saat **build**; mengubahnya butuh build ulang. Ikut terkirim ke browser, jadi jangan isi rahasia |

Tidak ada secret di project frontend. Semua rahasia (JWT, kunci enkripsi, API key AI, token Telegram) hanya ada di backend.

## Deploy backend (Pterodactyl + tunnel)

Bukan bagian project ini. Ikuti README `agent-backend`. Dari sisi frontend yang perlu dipastikan: `https://<domain-B>/api/health` mengembalikan `ok`, dan WebSocket lewat tunnel aktif (default Cloudflare).

## Deploy frontend (Vercel)

1. Push folder `agent-frontend` ke repo Git sendiri (jangan campur dengan project lain).
2. Vercel → *Add New Project* → pilih repo. Framework otomatis terdeteksi sebagai Next.js; build command dan output default.
3. *Settings → Environment Variables*: `NEXT_PUBLIC_API_URL=https://<domain-B>` untuk Production (dan Preview bila dipakai).
4. Deploy. Pasang domain A di *Settings → Domains*.
5. Di backend, isi `ALLOWED_ORIGINS` dengan domain A final (https, tanpa slash akhir), lalu restart backend.
6. Buka domain A, login. Login pertama meminta pendaftaran 2FA: pindai QR dengan aplikasi authenticator.

`next.config.mjs` memasang header keamanan (CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`) dan mengunci `connect-src` ke domain API. Catatan: CSP memakai `'unsafe-inline'` pada `script-src` karena Next.js App Router menyisipkan skrip inline; mitigasinya ada di checklist keamanan di bawah.

## CORS

Browser memanggil backend lintas domain (A → B). Backend hanya mengizinkan origin persis di `ALLOWED_ORIGINS` dan menolak origin lain dengan 403. URL preview Vercel (`*.vercel.app`) **tidak** diizinkan secara default; jika ingin menguji di preview, tambahkan URL preview itu secara eksplisit di backend, lalu hapus setelah selesai. Karena memakai Bearer (bukan cookie), tidak ada masalah cookie pihak ketiga.

## Integrasi ke tiap website

Frontend tidak terhubung langsung ke AustinPay, Marketplace, atau Lucibook. Semua data datang dari `agent-backend`, yang memanggil modul `/api/agent/*` di tiap website. Cara memasang modul itu ada di README backend (bagian "Integrasi ke tiap website"). Di dashboard, status kredensial tiap website terlihat di *Pengaturan → Kredensial agent*; website yang modulnya belum terpasang tampil sebagai "Perlu konfigurasi", bukan "Bermasalah".

## Menambah tool baru

Tool didefinisikan di backend (README backend, "Menambah tool baru"). Di frontend:

- Tool otomatis muncul di form *Tugas terjadwal* (daftar diambil dari `GET /api/system/tools`); tool berbahaya tidak ditampilkan.
- Aktivitas dan approval tampil otomatis tanpa perubahan kode.
- Opsional: beri label ramah untuk metrik baru di `src/lib/format.ts` (`METRIC_LABELS`) dan tampilkan di kartu beranda lewat `HEADLINE_METRICS`.

## Mengganti provider AI

Dilakukan di backend (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TOOL_MODE`). Di dashboard hanya **model** dan batas token/biaya yang bisa diubah (*Pengaturan → Asisten AI*), dan hanya ke nilai yang lebih rendah dari batas keras di backend. URL dan API key sengaja tidak bisa diubah dari dashboard.

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Login: "NEXT_PUBLIC_API_URL belum diisi" | Isi variabel di Vercel lalu **redeploy** (variabel dibaca saat build) |
| "Tidak bisa terhubung ke server" | Backend mati / tunnel putus / domain B salah. Cek `/api/health` |
| Error CORS di console, atau 403 "Origin tidak diizinkan" | Domain A belum ada di `ALLOWED_ORIGINS` backend (cek https dan tanpa slash akhir) |
| Indikator "Menyambung" terus | WebSocket terblokir; Socket.IO jatuh ke polling. Pastikan path `/socket.io` ikut lewat tunnel |
| Sering diminta login ulang | Refresh token dicabut (ganti password, atau token lama terdeteksi dipakai ulang di dua tempat). Login lagi |
| "Kode 2FA salah atau sudah dipakai" | Kode TOTP sekali pakai; tunggu kode berikutnya. Periksa jam ponsel |
| Akun terkunci | Terlalu banyak percobaan gagal; kunci bertahap (mulai 15 menit) |
| Website "Perlu konfigurasi" | Modul `/api/agent` belum terpasang atau kredensial belum diaktifkan |
| Chat tidak aktif | Provider AI belum dikonfigurasi di backend, atau kill switch aktif |
| Build gagal soal font | Next.js mengunduh font Google saat build; pastikan build punya akses internet |

## Checklist keamanan

- [ ] `NEXT_PUBLIC_API_URL` memakai https; tidak ada rahasia di environment frontend
- [ ] `ALLOWED_ORIGINS` backend hanya berisi domain A final
- [ ] Tidak ada `dangerouslySetInnerHTML`; teks dari API (chat, tiket, nama produk) selalu dirender sebagai teks
- [ ] Access token tidak pernah ditulis ke storage (hanya memori); hanya refresh token di `localStorage`
- [ ] CSP dan header keamanan di `next.config.mjs` tetap aktif; `connect-src` hanya domain API
- [ ] Jangan menambah skrip pihak ketiga (analytics, widget) karena mereka akan bisa membaca `localStorage`
- [ ] Aksi sensitif (approval, rotasi kredensial, lepas kill switch) tetap lewat dialog 2FA
- [ ] Login dari perangkat baru dicek di *Jejak audit*
