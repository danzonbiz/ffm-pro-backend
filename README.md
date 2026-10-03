# FFM Pro Backend v2

Backend aktivasi untuk FFM Toolkit. Lanjutan dari `Arsip/2026-07-07-ffm-pro-backend` (verifikasi kode 1-device-per-kode tidak diubah), ditambah endpoint webhook supaya kode otomatis dibuat dan dikirim email saat ada pembelian baru di OrderHero.

## Endpoint

- `POST /api/verify-code` — dipanggil dari app FFM Toolkit saat buyer input kode. Tidak berubah dari versi lama.
- `POST /api/generate-code` — generate kode manual lewat `admin.html`, untuk kasus di luar jalur otomatis (mis. refund diganti unit baru, dukungan pelanggan).
- `POST /api/order-webhook?secret=XXXX` — dipanggil OrderHero saat order lunas. Mengecek produk & tanggal cutoff, generate kode, kirim email lewat Resend. Order sebelum `ACTIVATION_CUTOFF_ISO` otomatis dilewati (grandfathered, tidak dapat kode karena memang tidak butuh).

## Environment Variables (set di Vercel project settings)

| Variable | Contoh | Keterangan |
|---|---|---|
| `ADMIN_SECRET` | (bebas, rahasia) | Password untuk `admin.html` / `generate-code`. Sama seperti versi lama. |
| `ORDERHERO_WEBHOOK_SECRET` | (bebas, rahasia) | Dicocokkan dengan `?secret=` di URL webhook yang didaftarkan ke OrderHero. |
| `FFM_PRODUCT_ID` | `6a6fedabf09087975093f04a` | ID produk Formula Flipping Mobil di OrderHero, supaya webhook produk lain diabaikan. |
| `ACTIVATION_CUTOFF_ISO` | `2026-10-03T00:00:00Z` | Order dengan `paid_at` sebelum tanggal ini dilewati (grandfathered). |
| `RESEND_API_KEY` | (dari dashboard Resend) | Untuk kirim email kode aktivasi. |
| `RESEND_FROM_EMAIL` | `aktivasi@info.ultimatedigitalsolution.my.id` | Subdomain `info.ultimatedigitalsolution.my.id` sudah diverifikasi di Resend — pakai local-part apa saja di depan `@`, mis. `aktivasi@`, `noreply@`, atau `ffmtoolkit@`. |

## Langkah Setup (dilakukan manual oleh pemilik project)

1. Domain pengirim sudah diverifikasi di Resend (`info.ultimatedigitalsolution.my.id`) — buat API key di dashboard Resend kalau belum.
2. Deploy folder ini ke Vercel sebagai project baru (atau timpa project `ffm-backend-xi` yang lama), set semua environment variables di atas.
3. Setelah dapat URL deployment (mis. `https://ffm-pro-backend.vercel.app`), daftarkan webhook di OrderHero: event order lunas/completed, target URL `https://ffm-pro-backend.vercel.app/api/order-webhook?secret=<ORDERHERO_WEBHOOK_SECRET>`.
4. Update URL `PRO_VERIFY_URL` di `js/activation.js` pada app FFM Toolkit kalau domain backend berubah dari sebelumnya.

## Catatan

- WhatsApp sengaja TIDAK dipakai untuk kirim kode di versi ini — dicoba dulu lewat API OrderHero, ternyata jalur WA yang aktif sekarang cuma kirim notifikasi status generik, bukan konten. Kode hanya lewat email untuk saat ini.
- Satu order = satu kode (idempotent berdasar `order.id`), jadi aman kalau OrderHero mengirim webhook yang sama dua kali.
