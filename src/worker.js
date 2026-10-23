// ISHQ KNOT Worker — serves the static site, plus a small API for the photo admin (admin.html).
// Two photo lists: the portfolio (/api/photos) and the homepage cover slideshow (/api/hero).
// Each lives in R2 under the same name as its default list (a static asset), which is
// used until the admin saves once. Uploaded photos live in R2 under media/.

const LISTS = { "/api/photos": "photos.json", "/api/hero": "hero.json" };
const CATEGORIES = ["couples", "brides", "moments", "celebrations", "prewedding"];
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_UPLOAD = 15 * 1024 * 1024;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      const list = LISTS[path];
      if (list && req.method === "GET") return getPhotos(req, env, list);
      if (list && req.method === "PUT") return authed(req, env, () => savePhotos(req, env, list));
      if (path === "/api/upload" && req.method === "POST") return authed(req, env, () => upload(req, env));
      if (path === "/api/login" && req.method === "POST") return authed(req, env, () => json({ ok: true }));
      if (path.startsWith("/media/") && req.method === "GET") return media(path.slice(1), env);
      if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message || "Server error" }, 500);
    }
    return env.ASSETS.fetch(req);
  },
};

async function loadPhotos(req, env, list) {
  const obj = await env.BUCKET.get(list);
  if (obj) return obj.json();
  const res = await env.ASSETS.fetch(new URL("/" + list, req.url));
  return res.json();
}

async function getPhotos(req, env, list) {
  return json(await loadPhotos(req, env, list), 200, { "Cache-Control": "no-store" });
}

async function savePhotos(req, env, list) {
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) return json({ error: "Expected a list of photos" }, 400);

  const photos = [];
  for (const p of body) {
    const src = String(p?.src || "");
    if (!/^(images\/[\w.-]+|\/media\/[\w.-]+)$/.test(src)) return json({ error: `Bad photo path: ${src}` }, 400);
    const title = String(p.title || "").replace(/[<>"]/g, "").trim().slice(0, 80) || "Untitled"; // title is put into HTML
    const photo = { src, title };
    if (list === "photos.json") { // cover photos have no category
      if (!CATEGORIES.includes(p.category)) return json({ error: `Bad category: ${p.category}` }, 400);
      photo.category = p.category;
    }
    if (/^center \d{1,3}%$/.test(p.pos || "") && p.pos !== "center 50%") photo.pos = p.pos;
    photos.push(photo);
  }

  // Delete uploaded files that are no longer in this list or the other one
  const others = await Promise.all(Object.values(LISTS).filter(l => l !== list).map(l => loadPhotos(req, env, l)));
  const keep = new Set([...photos, ...others.flat()].map(p => p.src));
  const before = await loadPhotos(req, env, list);
  const removed = before.filter(p => p.src.startsWith("/media/") && !keep.has(p.src)).map(p => p.src.slice(1));
  if (removed.length) await env.BUCKET.delete(removed);

  await env.BUCKET.put(list, JSON.stringify(photos), { httpMetadata: { contentType: "application/json" } });
  return json(photos);
}

async function upload(req, env) {
  const type = req.headers.get("Content-Type") || "";
  const ext = IMAGE_TYPES[type];
  if (!ext) return json({ error: "Only JPG, PNG or WebP images" }, 400);
  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_UPLOAD) return json({ error: "Image is empty or too large (max 15 MB)" }, 400);

  const key = `media/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.BUCKET.put(key, data, { httpMetadata: { contentType: type } });
  return json({ src: "/" + key });
}

async function media(key, env) {
  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable", // keys are never reused
      ETag: obj.httpEtag,
    },
  });
}

// Password from the ADMIN_PASSWORD secret (`npx wrangler secret put ADMIN_PASSWORD`)
async function authed(req, env, handler) {
  const given = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!env.ADMIN_PASSWORD || !(await sameText(given, env.ADMIN_PASSWORD))) {
    return json({ error: "Wrong password" }, 401);
  }
  return handler();
}

// Constant-time compare via hashing, so response timing doesn't leak the password
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([a, b].map(s => crypto.subtle.digest("SHA-256", enc.encode(s))));
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
}
