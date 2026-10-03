/* POST /api/order-webhook?secret=XXXX
   Dipanggil oleh webhook OrderHero saat order lunas (event order.paid / sejenisnya).
   - Hanya diproses kalau order mengandung FFM_PRODUCT_ID dan paid_at >= ACTIVATION_CUTOFF_ISO
     (pembeli sebelum tanggal cutoff di-grandfather, tidak perlu kode - cukup tidak diproses di sini).
   - Idempotent: order yang sama tidak akan menghasilkan kode dobel walau webhook dikirim ulang.
   - Setelah kode dibuat, dikirim langsung lewat email (Resend) ke email pembeli dari payload order.
     TIDAK bergantung ke jalur pengiriman OrderHero sendiri. */
import { kv } from "@vercel/kv";

function randomCode() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I biar gak salah baca
  var seg = function () {
    var s = "";
    for (var i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  return "FFM-PRO-" + seg() + "-" + seg();
}

function extractOrder(body) {
  // OrderHero bisa kirim payload dibungkus { event, data } atau order langsung di root - tangani dua-duanya.
  if (body && body.data && (body.data.id || body.data.order_number)) return body.data;
  if (body && body.order && (body.order.id || body.order.order_number)) return body.order;
  return body;
}

function orderContainsProduct(order, productId) {
  if (order.product_id === productId) return true;
  if (Array.isArray(order.items)) {
    return order.items.some(function (it) { return it.product_id === productId; });
  }
  return false;
}

async function sendActivationEmail(toEmail, toName, code) {
  var apiKey = process.env.RESEND_API_KEY;
  var from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL belum diset");

  var html =
    "<p>Halo " + (toName || "") + ",</p>" +
    "<p>Terima kasih sudah membeli <strong>Formula Flipping Mobil</strong>. Berikut kode aktivasi FFM Toolkit kamu:</p>" +
    "<p style=\"font-size:22px;font-weight:800;letter-spacing:1px;background:#f4f1ea;border:1px dashed #c8551a;" +
    "border-radius:8px;padding:16px;text-align:center;\">" + code + "</p>" +
    "<p>Cara pakai: buka aplikasi FFM Toolkit di HP kamu, lalu masukkan kode ini saat diminta aktivasi.</p>" +
    "<p>Panduan instalasi & penggunaan lengkap ada di dalam ebook.</p>" +
    "<p>Simpan email ini - kode hanya aktif untuk 1 perangkat.</p>";

  var res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({
      from: from,
      to: [toEmail],
      subject: "Kode Aktivasi FFM Toolkit kamu",
      html: html
    })
  });
  if (!res.ok) {
    var text = await res.text().catch(function () { return ""; });
    throw new Error("Resend gagal (" + res.status + "): " + text);
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  var expectedSecret = process.env.ORDERHERO_WEBHOOK_SECRET;
  var gotSecret = (req.query && req.query.secret) || "";
  if (!expectedSecret || gotSecret !== expectedSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  var productId = process.env.FFM_PRODUCT_ID;
  var cutoffIso = process.env.ACTIVATION_CUTOFF_ISO;

  try {
    var order = extractOrder(req.body || {});
    if (!order || !order.id) return res.status(400).json({ message: "Payload order tidak dikenali" });

    var paymentOk = order.payment_status === "paid" || order.status === "completed";
    if (!paymentOk) return res.status(200).json({ skipped: true, reason: "belum lunas" });

    if (productId && !orderContainsProduct(order, productId)) {
      return res.status(200).json({ skipped: true, reason: "produk bukan FFM" });
    }

    var paidAt = order.paid_at ? new Date(order.paid_at) : null;
    if (cutoffIso && paidAt && paidAt < new Date(cutoffIso)) {
      return res.status(200).json({ skipped: true, reason: "sebelum cutoff aktivasi (grandfathered)" });
    }

    // Idempotensi: kalau order ini sudah pernah diproses, jangan generate/kirim lagi.
    var orderKey = "order:" + order.id;
    var existing = await kv.get(orderKey);
    if (existing) {
      return res.status(200).json({ already_processed: true, code: existing.code });
    }

    var email = order.customer_email;
    if (!email) return res.status(200).json({ skipped: true, reason: "order tanpa email pembeli" });

    var code = randomCode();
    var tries = 0;
    while (await kv.get("code:" + code) && tries < 5) { code = randomCode(); tries++; }

    await kv.set("code:" + code, {
      status: "unused",
      createdAt: Date.now(),
      note: "Auto dari order " + order.order_number || order.id,
      email: email,
      whatsapp: order.customer_phone || "",
      orderId: order.id
    });
    await kv.set(orderKey, { code: code, createdAt: Date.now() });

    await sendActivationEmail(email, order.customer_name, code);

    return res.status(200).json({ ok: true, code: code });
  } catch (e) {
    return res.status(500).json({ message: "Gagal memproses webhook: " + e.message });
  }
}
