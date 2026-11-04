// ISHQ KNOT Worker — serves the static site, plus a small API for the photo admin (admin.html).
// Two photo lists: the portfolio (/api/photos) and the homepage cover slideshow (/api/hero).
// Each lives in R2 under the same name as its default list (a static asset), which is
// used until the admin saves once. Uploaded photos live in R2 under media/.

const LISTS = { "/api/photos": "photos.json", "/api/hero": "hero.json" };
const CATEGORIES = ["couples", "brides", "moments", "celebrations", "prewedding"];
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_UPLOAD = 15 * 1024 * 1024;

// Client photos: a client types their password at /client-photos, then sees their own photos at /d/<id>.
// The client list lives in R2 as deliveries.json; files live under deliveries/<id>/ and are never public.
const DELIVERIES = "deliveries.json";
const SETTINGS = "settings.json";
const REMIND_GB = 10; // the end of Cloudflare's free storage
const PART_SIZE = 32 * 1024 * 1024; // a Worker request can't exceed 100 MB, so big files upload in parts
const KEEP_DAYS = 7; // an expired link stays closed this long before its files are deleted, so it can be extended
const HASH_ROUNDS = 10000; // low enough for the Workers Free 10 ms CPU limit
const SESSION_MS = 24 * 60 * 60 * 1000;
const MAX_FACE_TEXT = 8000; // 40 faces in one photo

// Reviews: a client writes one from their photo page; it waits under reviews/waiting/<id>.json
// until the admin approves it into reviews.json, which the homepage shows.
const REVIEWS = "reviews.json";
const waitingKey = id => `reviews/waiting/${id}.json`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      if ((path === "/client-photos" || /^\/d\/[a-z0-9-]+\/?$/.test(path)) && req.method === "GET") return clientPage(req, env);
      if (path === "/api/client/unlock" && req.method === "POST") return await clientUnlock(req, env, url);
      if (path.startsWith("/api/d/")) return await publicDelivery(req, env, url);
      if (path.startsWith("/api/deliveries")) return await authed(req, env, () => adminDelivery(req, env, url));
      if (path === "/api/settings") return await authed(req, env, () => settings(req, env));
      if (path === "/api/reviews" && req.method === "GET") return await publicReviews(env);
      if (path.startsWith("/api/reviews/")) return await authed(req, env, () => adminReviews(req, env, url));
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

  // Daily (see crons in wrangler.jsonc): delete files of links that closed more than KEEP_DAYS ago
  async scheduled(_event, env) {
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    const all = await loadDeliveries(env);
    const gone = all.filter(d => d.expiresAt < cutoff);
    if (!gone.length) return;
    for (const d of gone) await deleteDelivery(env, d);
    await saveDeliveries(env, all.filter(d => d.expiresAt >= cutoff));
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

// Admin choices kept with the photos, so every device sees the same ones
async function settings(req, env) {
  if (req.method === "PUT") {
    const { remindGB } = await req.json().catch(() => ({}));
    const gb = Number(remindGB);
    if (!(gb > 0 && gb <= 100000)) return json({ error: "Enter the storage in GB" }, 400);
    await env.BUCKET.put(SETTINGS, JSON.stringify({ remindGB: gb }), { httpMetadata: { contentType: "application/json" } });
    return json({ remindGB: gb });
  }
  if (req.method !== "GET") return json({ error: "Not found" }, 404);
  const obj = await env.BUCKET.get(SETTINGS);
  return json({ remindGB: REMIND_GB, ...(obj && await obj.json()) }, 200, { "Cache-Control": "no-store" });
}

// ---------- Reviews ----------

async function loadReviews(env) {
  const obj = await env.BUCKET.get(REVIEWS);
  return obj ? obj.json() : [];
}

function saveReviews(env, all) {
  return env.BUCKET.put(REVIEWS, JSON.stringify(all), { httpMetadata: { contentType: "application/json" } });
}

async function publicReviews(env) {
  const all = await loadReviews(env);
  return json(all.map(({ names, place, stars, text }) => ({ names, place, stars, text })), 200, { "Cache-Control": "public, max-age=60" });
}

// Shown on the homepage with textContent, so this only trims and limits
function cleanReview(body) {
  const line = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  const review = {
    names: line(body?.names, 60),
    place: line(body?.place, 60),
    stars: Math.round(Number(body?.stars)),
    text: String(body?.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 500),
  };
  if (!review.names) return "Please write your names";
  if (!(review.stars >= 1 && review.stars <= 5)) return "Please choose the stars";
  if (review.text.length < 10) return "Please write a few words";
  return review;
}

// A client's own review, from their photo page: GET shows it, POST sends a new one for approval
async function clientReview(req, env, d) {
  if (req.method === "POST") {
    const review = cleanReview(await req.json().catch(() => null));
    if (typeof review === "string") return json({ error: review }, 400);
    await env.BUCKET.put(waitingKey(d.id), JSON.stringify({ id: d.id, client: d.client, at: Date.now(), ...review }), { httpMetadata: { contentType: "application/json" } });
    return json({ state: "waiting", review });
  }
  const waiting = await env.BUCKET.get(waitingKey(d.id));
  if (waiting) return json({ state: "waiting", review: await waiting.json() }, 200, { "Cache-Control": "no-store" });
  const live = (await loadReviews(env)).find(r => r.id === d.id);
  return json(live ? { state: "live", review: live } : { state: "none" }, 200, { "Cache-Control": "no-store" });
}

async function adminReviews(req, env, url) {
  const m = url.pathname.match(/^\/api\/reviews\/(list|[a-z0-9-]+\/(approve|reject|remove))$/);
  if (!m) return json({ error: "Not found" }, 404);
  const live = await loadReviews(env);
  if (m[1] === "list" && req.method === "GET") {
    const listed = await env.BUCKET.list({ prefix: "reviews/waiting/" });
    const waiting = await Promise.all(listed.objects.map(o => env.BUCKET.get(o.key).then(obj => obj?.json())));
    return json({ waiting: waiting.filter(Boolean).sort((a, b) => b.at - a.at), live }, 200, { "Cache-Control": "no-store" });
  }
  if (req.method !== "POST") return json({ error: "Not found" }, 404);

  const id = m[1].split("/")[0];
  const action = m[2];
  if (action === "remove") {
    await saveReviews(env, live.filter(r => r.id !== id));
    return json({ ok: true });
  }
  const obj = await env.BUCKET.get(waitingKey(id));
  if (!obj) return json({ error: "This review is gone. Refresh the page." }, 404);
  if (action === "approve") {
    const review = await obj.json();
    // A couple has one review on the site; a new one from them replaces the old one
    await saveReviews(env, [review, ...live.filter(r => r.id !== id)]);
  }
  await env.BUCKET.delete(waitingKey(id));
  return json({ ok: true });
}

// ---------- Client photos ----------

async function loadDeliveries(env) {
  const obj = await env.BUCKET.get(DELIVERIES);
  return obj ? obj.json() : [];
}

function saveDeliveries(env, all) {
  return env.BUCKET.put(DELIVERIES, JSON.stringify(all), { httpMetadata: { contentType: "application/json" } });
}

// Each client's file list is stored on its own, because one wedding can be a thousand photos
const filesKey = id => `deliveries/${id}/files.json`;

// Face codes for search are kept in small batches, not in one file, so that adding photos and
// opening a gallery never have to read a whole wedding's faces. See face/faces.js.
const facesKey = (id, n) => `deliveries/${id}/faces/${n}`;
const refOf = key => key.split("/").pop();

async function loadFiles(env, id) {
  const obj = await env.BUCKET.get(filesKey(id));
  return obj ? obj.json() : [];
}

function saveFiles(env, d, files) {
  d.count = files.length;
  d.total = files.reduce((sum, f) => sum + f.size, 0);
  return env.BUCKET.put(filesKey(d.id), JSON.stringify(files), { httpMetadata: { contentType: "application/json" } });
}

async function saveFaces(env, d, faces) {
  if (!Object.keys(faces).length) return;
  await env.BUCKET.put(facesKey(d.id, d.faceBatches || 0), JSON.stringify(faces), { httpMetadata: { contentType: "application/json" } });
  d.faceBatches = (d.faceBatches || 0) + 1;
}

async function deleteKeys(env, keys) {
  for (let i = 0; i < keys.length; i += 1000) await env.BUCKET.delete(keys.slice(i, i + 1000));
}

async function deleteDelivery(env, d) {
  const files = await loadFiles(env, d.id);
  const faces = Array.from({ length: d.faceBatches || 0 }, (_, n) => facesKey(d.id, n));
  await deleteKeys(env, [...files.flatMap(f => f.thumb ? [f.key, f.thumb] : [f.key]), ...faces, filesKey(d.id)]);
}

async function clientPage(req, env) {
  const res = await env.ASSETS.fetch(new URL("/download", req.url));
  const page = new Response(res.body, res);
  page.headers.set("X-Robots-Tag", "noindex");
  page.headers.set("Referrer-Policy", "no-referrer");
  page.headers.set("Cache-Control", "no-store");
  return page;
}

// The last date is a whole day in India: the link closes at midnight at the end of it
const lastMoment = date => Date.parse(`${date}T23:59:59+05:30`);
const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || "") && !isNaN(lastMoment(date));
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: HASH_ROUNDS }, key, 256);
  return toB64(bits);
}

// Clients type only a password, so it has to find their photos without trying every client's hash
const lookupOf = async password => toB64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`client:${password}`)));

// A session cookie proves the password was given. It is signed with the admin secret and the
// client's salt, so changing their password logs everyone out of their photos.
async function sign(d, exp, env) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(env.ADMIN_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toB64(await crypto.subtle.sign("HMAC", key, enc.encode(`${d.id}.${exp}.${d.salt}`)));
}

async function hasSession(req, d, env) {
  const cookie = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)dl=(\d+)\.([\w-]+)/);
  if (!cookie || +cookie[1] < Date.now()) return false;
  return sameText(cookie[2], await sign(d, cookie[1], env));
}

async function clientUnlock(req, env, url) {
  const { password } = await req.json().catch(() => ({}));
  const given = String(password || "");
  const lookup = await lookupOf(given);
  const d = (await loadDeliveries(env)).find(x => x.lookup === lookup);
  if (!d || !(await sameText(await hashPassword(given, d.salt), d.hash))) return json({ error: "Wrong password" }, 401);
  if (Date.now() > d.expiresAt) return json({ error: "This link has closed", closed: true }, 410);
  const exp = Math.min(Date.now() + SESSION_MS, d.expiresAt);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return json({ id: d.id }, 200, {
    "Set-Cookie": `dl=${exp}.${await sign(d, exp, env)}; Path=/api/d/${d.id}; Max-Age=${Math.floor((exp - Date.now()) / 1000)}; HttpOnly; SameSite=Lax${secure}`,
  });
}

async function publicDelivery(req, env, url) {
  const m = url.pathname.match(/^\/api\/d\/([a-z0-9-]+)(?:\/(file|thumb|faces)\/(\d+)|\/(review))?$/);
  const reading = req.method === "GET" || req.method === "HEAD";
  if (!m || !(reading || (m[4] && req.method === "POST"))) return json({ error: "Not found" }, 404);
  const [, id, action, index] = m;
  const d = (await loadDeliveries(env)).find(x => x.id === id);
  if (!d) return json({ error: "This link is not valid", closed: true }, 404);
  if (Date.now() > d.expiresAt) return json({ error: "This link has closed", closed: true }, 410);
  if (!(await hasSession(req, d, env))) return json({ error: "Password needed" }, 401);
  if (m[4]) return clientReview(req, env, d);

  if (action === "faces") {
    const batch = +index < (d.faceBatches || 0) && await env.BUCKET.get(facesKey(id, +index));
    if (!batch) return new Response("Not found", { status: 404 });
    return new Response(batch.body, { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  }

  const files = await loadFiles(env, id);
  if (!action) {
    return json({ client: d.client, date: d.date, faces: d.faceBatches || 0, files: files.map(f => ({ name: f.name, size: f.size, photo: !!f.thumb, ref: refOf(f.key) })) }, 200, { "Cache-Control": "no-store" });
  }
  const file = files[+index];
  if (action === "file") return sendFile(req, env, file);
  const thumb = file?.thumb && await env.BUCKET.get(file.thumb);
  if (!thumb) return new Response("Not found", { status: 404 });
  return new Response(thumb.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}

// Supports Range requests, so a broken download can continue instead of starting again
async function sendFile(req, env, file) {
  if (!file) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
  });
  if (req.method === "HEAD") {
    headers.set("Content-Length", file.size);
    return new Response(null, { headers });
  }

  const range = req.headers.get("Range");
  const obj = await env.BUCKET.get(file.key, range ? { range: req.headers } : {});
  if (!obj) return new Response("Not found", { status: 404 });
  headers.set("ETag", obj.httpEtag);
  if (!range || !obj.range) {
    headers.set("Content-Length", file.size);
    return new Response(obj.body, { headers });
  }
  const offset = obj.range.offset ?? file.size - obj.range.suffix;
  const length = obj.range.length ?? file.size - offset;
  headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${file.size}`);
  headers.set("Content-Length", length);
  return new Response(obj.body, { status: 206, headers });
}

const adminView = d => ({ id: d.id, client: d.client, date: d.date, expiresAt: d.expiresAt, created: d.created, count: d.count || 0, total: d.total || 0, faces: d.faceBatches || 0 });

// Returns an error response if the password can't be used, otherwise null
async function badPassword(password, all, d) {
  if (String(password || "").length < 8) return json({ error: "Password needs at least 8 characters" }, 400);
  const lookup = await lookupOf(String(password));
  if (all.some(x => x !== d && x.lookup === lookup)) return json({ error: "Another client has this password. Choose a different one." }, 409);
  return null;
}

async function setPassword(d, password) {
  d.salt = crypto.randomUUID();
  d.hash = await hashPassword(String(password), d.salt);
  d.lookup = await lookupOf(String(password));
}

async function adminDelivery(req, env, url) {
  const m = url.pathname.match(/^\/api\/deliveries(?:\/([a-z0-9-]+)(?:\/(files|parts|complete|thumb|add|faces)(?:\/(\d+))?)?)?$/);
  if (!m) return json({ error: "Not found" }, 404);
  const [, id, action, index] = m;
  const all = await loadDeliveries(env);

  if (!id) {
    if (req.method === "GET") return json(all.map(adminView), 200, { "Cache-Control": "no-store" });
    if (req.method !== "POST") return json({ error: "Not found" }, 404);
    const { client, date, password } = await req.json().catch(() => ({}));
    const name = String(client || "").replace(/[<>"]/g, "").trim().slice(0, 80);
    if (!name) return json({ error: "Enter the client's name" }, 400);
    if (!validDate(date)) return json({ error: "Choose a last date" }, 400);
    const bad = await badPassword(password, all);
    if (bad) return bad;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const d = { id: `${slug || "client"}-${crypto.randomUUID().slice(0, 8)}`, client: name, date, expiresAt: lastMoment(date), created: Date.now(), count: 0, total: 0 };
    await setPassword(d, password);
    all.unshift(d);
    await saveDeliveries(env, all);
    return json({ ...adminView(d), partSize: PART_SIZE });
  }

  const d = all.find(x => x.id === id);
  if (!d) return json({ error: "Client not found" }, 404);

  if (!action && req.method === "PUT") { // change the last date or the password
    const { date, password } = await req.json().catch(() => ({}));
    if (date !== undefined) {
      if (!validDate(date)) return json({ error: "Choose a last date" }, 400);
      d.date = date;
      d.expiresAt = lastMoment(date);
    }
    if (password !== undefined) {
      const bad = await badPassword(password, all, d);
      if (bad) return bad;
      await setPassword(d, password);
    }
    await saveDeliveries(env, all);
    return json(adminView(d));
  }

  if (!action && req.method === "DELETE") {
    await deleteDelivery(env, d);
    await saveDeliveries(env, all.filter(x => x !== d));
    return json({ ok: true });
  }

  if (action === "files" && index === undefined && req.method === "GET") {
    return json((await loadFiles(env, id)).map(f => ({ name: f.name, size: f.size, photo: !!f.thumb, ref: refOf(f.key) })), 200, { "Cache-Control": "no-store" });
  }

  if (action === "files" && index !== undefined && req.method === "DELETE") {
    const files = await loadFiles(env, id);
    const file = files[+index];
    if (!file) return json({ error: "File not found" }, 404);
    await deleteKeys(env, file.thumb ? [file.key, file.thumb] : [file.key]);
    files.splice(+index, 1);
    await saveFiles(env, d, files);
    await saveDeliveries(env, all);
    return json(adminView(d));
  }

  if (action === "files" && req.method === "POST") { // start an upload
    const key = `deliveries/${id}/${crypto.randomUUID()}`;
    const upload = await env.BUCKET.createMultipartUpload(key);
    return json({ key, uploadId: upload.uploadId, partSize: PART_SIZE });
  }

  const ours = key => String(key || "").startsWith(`deliveries/${id}/`) && !String(key).endsWith("files.json");

  if (action === "thumb" && index !== undefined && req.method === "GET") {
    const file = (await loadFiles(env, id))[+index];
    const thumb = file?.thumb && await env.BUCKET.get(file.thumb);
    if (!thumb) return new Response("Not found", { status: 404 });
    return new Response(thumb.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  }

  if (action === "faces" && req.method === "POST") { // AI face search for photos uploaded earlier
    const { faces } = await req.json().catch(() => ({}));
    if (!faces || typeof faces !== "object" || Object.values(faces).some(text => typeof text !== "string" || text.length > MAX_FACE_TEXT)) return json({ error: "Bad faces" }, 400);
    await saveFaces(env, d, faces);
    await saveDeliveries(env, all);
    return json(adminView(d));
  }

  if (action === "thumb" && req.method === "PUT") {
    const key = url.searchParams.get("key");
    const data = await req.arrayBuffer();
    if (!ours(key) || !data.byteLength || data.byteLength > MAX_UPLOAD) return json({ error: "Bad preview" }, 400);
    await env.BUCKET.put(`${key}.thumb`, data, { httpMetadata: { contentType: "image/jpeg" } });
    return json({ thumb: `${key}.thumb` });
  }

  if (action === "parts") {
    const key = url.searchParams.get("key");
    const uploadId = url.searchParams.get("uploadId");
    if (!ours(key) || !uploadId) return json({ error: "Bad upload" }, 400);
    const upload = env.BUCKET.resumeMultipartUpload(key, uploadId);
    if (req.method === "PUT") {
      const part = +url.searchParams.get("part");
      if (!(part >= 1 && part <= 10000)) return json({ error: "Bad part number" }, 400);
      return json(await upload.uploadPart(part, req.body));
    }
    if (req.method === "DELETE") {
      await upload.abort();
      return json({ ok: true });
    }
  }

  if (action === "complete" && req.method === "POST") {
    const { key, uploadId, parts } = await req.json().catch(() => ({}));
    if (!ours(key) || !uploadId || !Array.isArray(parts)) return json({ error: "Bad upload" }, 400);
    await env.BUCKET.resumeMultipartUpload(key, uploadId).complete(parts);
    return json({ ok: true });
  }

  if (action === "add" && req.method === "POST") { // finished uploads join the client's list in batches
    const body = await req.json().catch(() => ({}));
    const added = Array.isArray(body.files) ? body.files : [];
    if (added.some(f => !ours(f.key) || (f.thumb && !ours(f.thumb)))) return json({ error: "Bad upload" }, 400);
    const faces = {};
    const files = await loadFiles(env, id);
    for (const f of added) {
      if (typeof f.faces === "string" && f.faces.length <= MAX_FACE_TEXT) faces[refOf(f.key)] = f.faces;
      const entry = { key: f.key, name: String(f.name || "file").replace(/[\/\\<>"]/g, "").slice(0, 150), size: +f.size || 0 };
      if (f.thumb) entry.thumb = f.thumb;
      files.push(entry);
    }
    await saveFaces(env, d, faces);
    await saveFiles(env, d, files);
    await saveDeliveries(env, all);
    return json(adminView(d));
  }

  return json({ error: "Not found" }, 404);
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
