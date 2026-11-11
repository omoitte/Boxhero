// 건강검진 기록 저장소 (Vercel Blob, 비공개)
//
//   GET  /api/health   헤더 x-key  → { store:{ "YYYY-MM-DD":{dt,org,v}, _settings:{next} } }
//   POST /api/health   헤더 x-key  { store }  → 통째로 저장
//
// 건강 기록은 민감한 개인정보라 환경변수 HEALTH_KEY(비밀번호)가 맞아야만 읽고 씁니다.
// HEALTH_KEY 가 없으면 아무것도 열지 않습니다(501).
import { put, get } from "@vercel/blob";

const PATH = "health/records.json";

function blobOpt() {
  const pick = (suffix) => {
    if (process.env["BLOB" + suffix]) return process.env["BLOB" + suffix];
    const k = Object.keys(process.env).find((n) => n.endsWith(suffix) && process.env[n]);
    return k ? process.env[k] : undefined;
  };
  const token = pick("_READ_WRITE_TOKEN");
  const storeId = pick("_STORE_ID");
  const o = {};
  if (token) o.token = token;
  else if (storeId) o.storeId = storeId;
  return o;
}

function body(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const KEY = process.env.HEALTH_KEY;
  if (!KEY) return res.status(501).json({ error: "key_not_set", message: "Vercel 환경변수 HEALTH_KEY 를 넣고 Redeploy 하세요." });
  const opt = blobOpt();
  if (!opt.token && !opt.storeId) return res.status(501).json({ error: "blob_not_configured", message: "Storage → Connect Store → Blob → Redeploy" });
  if (String(req.headers["x-key"] || "") !== KEY) return res.status(401).json({ error: "bad_key" });

  try {
    if (req.method === "GET") {
      try {
        const r = await get(PATH, { access: "private", useCache: false, ...opt });
        if (!r || !r.stream) return res.status(200).json({ store: null });
        return res.status(200).json({ store: JSON.parse(await new Response(r.stream).text()) });
      } catch { return res.status(200).json({ store: null }); }
    }
    if (req.method === "POST") {
      const b = body(req);
      if (!b.store || typeof b.store !== "object") return res.status(400).json({ error: "no_store" });
      const payload = JSON.stringify(b.store);
      if (payload.length > 1024 * 1024) return res.status(413).json({ error: "too_big" });
      await put(PATH, payload, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", ...opt });
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server", message: String(e && e.message || e) });
  }
}
