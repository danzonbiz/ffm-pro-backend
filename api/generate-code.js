/* POST /api/generate-code
   Admin-only endpoint (dipakai dari admin.html). Membuat kode unik baru
   berstatus "unused" di Vercel KV. Wajib header X-Admin-Secret yang cocok
   dengan env var ADMIN_SECRET di project Vercel. */
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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  var adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    var code = randomCode();
    var tries = 0;
    while (await kv.get("code:" + code) && tries < 5) { code = randomCode(); tries++; }

    var note = (req.body && req.body.note) || "";
    await kv.set("code:" + code, {
      status: "unused",
      createdAt: Date.now(),
      note: note
    });
    return res.status(200).json({ code: code });
  } catch (e) {
    return res.status(500).json({ message: "Gagal generate kode: " + e.message });
  }
}
