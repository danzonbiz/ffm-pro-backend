# FFM Pro Backend - Verifikasi Kode Unik

Backend kecil untuk generate & verifikasi kode pembelian Pro (Opsi B yang dipilih). Terpisah dari PWA utama, di-deploy sebagai project Vercel sendiri.

## Cara Deploy

1. Push folder ini ke repo GitHub baru (atau upload langsung via Vercel CLI: `vercel deploy` dari dalam folder ini).
2. Di dashboard Vercel project ini:
   - Buka tab **Storage** > **Create Database** > pilih **KV** (Upstash Redis). Setelah dibuat, Vercel otomatis mengisi env var `KV_REST_API_URL` dan `KV_REST_API_TOKEN` ke project ini.
   - Buka tab **Settings > Environment Variables**, tambahkan `ADMIN_SECRET` = password admin pilihanmu sendiri (ini yang dipakai untuk generate kode, bukan password login app).
3. Deploy. Kamu akan dapat URL seperti `https://ffm-pro-api.vercel.app`.

## Setelah Deploy

1. Buka `https://<url-project-kamu>/admin.html`, masukkan `ADMIN_SECRET`, klik **Generate Kode Baru** setiap ada pesanan Pro masuk di formulir.com. Kirim kode yang muncul ke buyer via WA/email.
2. Buka file `js/app.js` di app FFM Toolkit, cari baris:
   ```
   var PRO_VERIFY_URL = "https://ffm-pro-api.vercel.app/api/verify-code";
   ```
   Ganti dengan URL project Vercel kamu yang sebenarnya + `/api/verify-code`, lalu redeploy app.

## Cara Kerja

- `POST /api/generate-code` (perlu header `X-Admin-Secret`): bikin 1 kode baru berstatus `unused` di database KV.
- `POST /api/verify-code` (dipanggil otomatis dari app saat buyer memasukkan kode): kalau kode belum pernah dipakai, ditandai `redeemed` dan terkunci ke device itu. Kalau device yang sama verifikasi ulang (misal re-install app), tetap dianggap valid. Kalau device lain coba pakai kode yang sama, ditolak.

## Keterbatasan yang Perlu Kamu Tahu

- Kode terkunci per-device berdasarkan ID acak yang disimpan di localStorage app, bukan hardware ID sungguhan. Kalau buyer clear data browser total, device ID-nya berubah dan kode lama tidak akan otomatis ke-redeem lagi ke device itu (tapi kode yang SAMA yang sudah redeemed tidak bisa dipakai ulang di device baru - buyer perlu hubungi kamu untuk reset manual via dashboard KV kalau ini terjadi).
- Endpoint verify-code publik (tanpa auth) supaya app bisa memanggilnya langsung - ini wajar untuk mekanisme seperti ini, tapi berarti siapa pun yang tahu URL bisa mencoba menebak kode (kode 8 karakter acak dari 32 karakter unik = sangat sulit ditebak, tapi bukan mustahil di teori).
