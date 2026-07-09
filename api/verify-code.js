/* POST /api/verify-code  body: { code, deviceId }
   Dipanggil dari app FFM Toolkit saat buyer memasukkan kode Pro.
   - Kode belum pernah dipakai -> tandai "redeemed" + simpan deviceId, valid.
   - Kode sudah redeemed TAPI oleh deviceId yang sama -> tetap valid
     (supaya re-install app / ganti browser cache tidak mengunci buyer sendiri).
   - Kode sudah redeemed oleh device LAIN -> ditolak. */
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  var body = req.body || {};
  var code = (body.code || "").toString().trim().toUpperCase();
  var deviceId = (body.deviceId || "").toString().trim();

  if (!code) return res.status(400).json({ valid: false, message: "Kode wajib diisi" });

  try {
    var key = "code:" + code;
    var record = await kv.get(key);
    if (!record) {
      return res.status(404).json({ valid: false, message: "Kode tidak ditemukan. Cek kembali penulisannya." });
    }
    if (record.status === "unused") {
      record.status = "redeemed";
      record.deviceId = deviceId;
      record.redeemedAt = Date.now();
      await kv.set(key, record);
      return res.status(200).json({ valid: true });
    }
    if (record.status === "redeemed" && record.deviceId === deviceId) {
      return res.status(200).json({ valid: true });
    }
    return res.status(409).json({ valid: false, message: "Kode ini sudah pernah dipakai di device lain." });
  } catch (e) {
    return res.status(500).json({ valid: false, message: "Gagal verifikasi: " + e.message });
  }
}
