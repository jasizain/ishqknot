// Portfolio photos are managed from admin.html. /api/photos serves the saved list;
// photos.json is the default list (and the fallback when the API isn't running).
// `pos` (optional) sets which part of the photo shows in the cropped grid tile.
let photos = [];

const gallery = document.getElementById("gallery");

async function loadGallery() {
  photos = await fetch("/api/photos").then(r => r.ok ? r.json() : Promise.reject())
    .catch(() => fetch("photos.json").then(r => r.json()));
  photos.forEach((p, i) => {
    const item = document.createElement("figure");
    item.className = "gallery-item";
    item.dataset.category = p.category;
    item.dataset.index = i;
    item.tabIndex = 0;
    item.innerHTML = `
      <div class="gallery-photo"><img src="${p.src}" alt="${p.title}" loading="lazy"${p.pos ? ` style="object-position:${p.pos}"` : ""}></div>
      <figcaption class="caption"><h4>${p.title}</h4><span>${p.category}</span></figcaption>`;
    gallery.appendChild(item);
  });
  renderGallery();
}

// Wedding packages — fill in `price` (e.g. "₹25,000"); empty shows "Price on request".
const packages = [
  { name: "Essential", title: "Wedding Day Photography", type: "photo", price: "",
    team: ["1 Photographer"],
    includes: ["Edited wedding photos", "Online album (shareable link)", "All final files on pendrive"] },
  { name: "Classic", title: "Wedding Day & Night Photography", type: "photo", price: "",
    quote: "Your love story deserves to be remembered exactly the way it felt.",
    team: ["1 Photographer"],
    includes: ["Day & night coverage", "Edited wedding photos", "Online album (shareable link)", "All final files on pendrive", "Complimentary album (10 pages)"] },
  { name: "Signature", title: "Wedding Day with Evening Reception Photography", type: "photo", price: "",
    quote: "Because some moments deserve to live forever.",
    team: ["1 Photographer"],
    includes: ["Wedding day coverage", "Evening reception coverage", "Edited photos", "Online album (shareable link)", "All final files on pendrive"] },
  { name: "Cinematic", title: "Wedding Day Photography & Videography", type: "film", price: "",
    quote: "More than photographs and films, we create memories that will be cherished for generations.",
    team: ["1 Photographer", "1 Videographer"],
    includes: ["Edited photos", "Highlight film (4–6 min)", "2–3 reels (time based)", "Online album (shareable link)", "All final files on pendrive"] },
  { name: "Eternal", title: "Wedding Night Photography + Wedding Day Photography & Videography", type: "film", price: "",
    team: ["1 Photographer", "1 Videographer"],
    includes: ["Wedding night photography", "Wedding day photography", "Wedding day videography", "Edited wedding photos", "Highlight film (4–6 min)", "2–3 reels (time based)", "Online album (shareable link)", "All final files on pendrive"] },
  { name: "Forever", title: "Wedding Day & Night Photography + Videography", type: "film", price: "",
    team: ["1 Photographer", "1 Videographer"],
    includes: ["Day & night coverage", "Edited wedding photos", "Highlight film (4–6 min)", "2–3 reels (time based)", "Online album (shareable link)", "All final files on pendrive"] },
  { name: "Celebration", title: "Wedding Day with Reception Photography & Videography", type: "film", price: "",
    quote: "Every wedding is a once-in-a-lifetime story, and we are honored to preserve it with emotion, beauty, and timeless artistry.",
    team: ["1 Photographer", "1 Videographer"],
    includes: ["Wedding day coverage", "Evening reception coverage", "Edited photos", "Highlight film (4–6 min)", "2–3 reels (time based)", "Online album (shareable link)", "All final files on pendrive"] },
  { name: "Premium Experience", title: "Luxury Wedding Day Coverage", type: "film", price: "", featured: true,
    photo: "images/grand-entrance.jpg",
    quote: "More than photographs and films, we create memories that will be cherished for generations.",
    team: ["2 Photographers", "2 Videographers"],
    groups: {
      "Photography": ["Edited wedding photos", "Online album (shareable link)"],
      "Cinematic films": ["Wedding teaser or 3 Instagram reels", "Highlight film (4–6 min)", "Full wedding film (entire function)"],
      "Keepsakes": ["Premium album", "Mini album", "Pendrive with all final files", "Customized photo frame"],
    } },
];

const pkgGrid = document.getElementById("packages-grid");
const pkgSelect = document.getElementById("package-select");
const list = items => `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;

packages.forEach((p, i) => {
  const num = String(i + 1).padStart(2, "0");
  const label = `Package ${num} — ${p.name}`;
  const card = document.createElement("article");
  card.className = "pkg" + (p.featured ? " featured" : "");
  card.dataset.type = p.type;
  const price = p.price || "Price on request";
  const enquire = `<a href="#contact" class="btn" data-choose="${label}">Enquire <i>→</i></a>`;
  card.innerHTML = p.featured ? `
    <div class="pkg-photo"><img src="${p.photo}" alt="" loading="lazy"></div>
    <div class="pkg-feature">
      <div>
        <h3>${p.name}</h3>
        <p class="pkg-title">${p.title}. Our most complete package.</p>
        <p class="pkg-quote">“${p.quote}”</p>
      </div>
      <div><p class="pkg-label">Coverage team</p><p class="pkg-team">${p.team.join(" · ")}</p></div>
      <div class="pkg-groups">
        ${Object.entries(p.groups).map(([g, items]) => `<div><p class="pkg-group">${g}</p>${list(items)}</div>`).join("")}
      </div>
      <div class="pkg-feature-foot"><p class="pkg-price">${price}</p>${enquire}</div>
    </div>` : `
    <div>
      <h3>${p.name}</h3>
      <p class="pkg-title">${p.title}</p>
      <p class="pkg-price">${price}</p>
    </div>
    <div>
      <p class="pkg-label">Coverage team</p>
      <p class="pkg-team">${p.team.join(" · ")}</p>
      ${p.quote ? `<p class="pkg-quote">“${p.quote}”</p>` : ""}
    </div>
    <div><p class="pkg-label">Included</p>${list(p.includes)}</div>
    <div class="pkg-foot">${enquire}</div>`;
  pkgGrid.appendChild(card);
  pkgSelect.add(new Option(label, label));
});

pkgGrid.addEventListener("click", e => {
  const btn = e.target.closest("[data-choose]");
  if (btn) pkgSelect.value = btn.dataset.choose;
});

const pkgTabs = document.querySelectorAll("[data-pkg]");
pkgTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    pkgTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    pkgGrid.querySelectorAll(".pkg").forEach(card =>
      card.classList.toggle("hidden", tab.dataset.pkg !== "all" && card.dataset.type !== tab.dataset.pkg));
  });
});

// Filters + "View more" (shows three rows at first; the wall has four columns, two on phones)
const PREVIEW = innerWidth > 860 ? 12 : 8;
const moreBtn = document.getElementById("gallery-more");
let activeFilter = "all";
let expanded = false;

// The wall: each photo goes in the shortest column, then every column is
// stretched a little so they all end level. Heights are in hundredths of a column's width.
const SHAPES = [133, 150, 125];
const GAP = 4;

// A short list uses a column count it divides into evenly, so no photo stretches too tall
function wallColumns(count) {
  const base = innerWidth > 1100 ? 4 : innerWidth > 860 ? 3 : 2;
  if (base === 2 || count >= base * 3) return Math.max(1, Math.min(count, base));
  return [base + 2, base + 1, base, base - 1].find(n => count % n === 0) || Math.max(1, Math.min(count, base));
}

function layoutWall() {
  const items = [...gallery.querySelectorAll(".gallery-item:not(.hidden)")];
  const cols = wallColumns(items.length);
  gallery.style.setProperty("--cols", cols);
  gallery.style.setProperty("--unit", `${(gallery.clientWidth - GAP * (cols - 1)) / cols / 100}px`);

  const columns = Array.from({ length: cols }, () => ({ height: 0, items: [] }));
  items.forEach(item => {
    const column = columns.reduce((a, b) => b.height < a.height ? b : a);
    const size = SHAPES[item.dataset.look];
    column.items.push({ item, size });
    column.height += size;
  });

  const tallest = Math.max(...columns.map(column => column.height));
  columns.forEach((column, i) => {
    let row = 1;
    column.items.forEach(({ item, size }, n) => {
      const last = n === column.items.length - 1;
      const span = last ? tallest + 1 - row : Math.round(size * tallest / column.height);
      item.style.gridColumn = i + 1;
      item.style.gridRow = `${row} / span ${span}`;
      row += span;
    });
  });
}

function renderGallery() {
  let shown = 0, matches = 0;
  gallery.querySelectorAll(".gallery-item").forEach(item => {
    const match = activeFilter === "all" || item.dataset.category === activeFilter;
    if (match) matches++;
    const show = match && (expanded || shown < PREVIEW);
    if (show) item.dataset.look = shown++ % 3; // photo shape, repeats every three
    const wasHidden = item.classList.contains("hidden");
    item.classList.toggle("hidden", !show);
    if (show && wasHidden) { item.style.animation = "none"; item.offsetHeight; item.style.animation = ""; }
  });
  moreBtn.parentElement.hidden = matches <= PREVIEW;
  moreBtn.textContent = expanded ? "Show less" : `View more photos (${matches - PREVIEW})`;
  layoutWall();
}

addEventListener("resize", layoutWall);

const filterBtns = document.querySelectorAll("[data-filter]");
filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    expanded = false;
    renderGallery();
  });
});
moreBtn.addEventListener("click", () => {
  expanded = !expanded;
  renderGallery();
  if (!expanded) document.getElementById("work").scrollIntoView();
});
loadGallery();

// Lightbox
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCaption = document.getElementById("lb-caption");
let current = 0;

const visibleIndexes = () =>
  [...gallery.querySelectorAll(".gallery-item:not(.hidden)")].map(el => +el.dataset.index);

function openLightbox(i) {
  current = i;
  lbImg.src = photos[i].src;
  lbImg.alt = photos[i].title;
  lbCaption.textContent = photos[i].title;
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  lb.classList.remove("open");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
function step(dir) {
  const list = visibleIndexes();
  const pos = list.indexOf(current);
  openLightbox(list[(pos + dir + list.length) % list.length]);
}

gallery.addEventListener("click", e => {
  const item = e.target.closest(".gallery-item");
  if (item) openLightbox(+item.dataset.index);
});
gallery.addEventListener("keydown", e => {
  const item = e.target.closest(".gallery-item");
  if (item && e.key === "Enter") openLightbox(+item.dataset.index);
});
lb.querySelector(".lb-close").addEventListener("click", closeLightbox);
lb.querySelector(".lb-prev").addEventListener("click", () => step(-1));
lb.querySelector(".lb-next").addEventListener("click", () => step(1));
lb.addEventListener("click", e => { if (e.target === lb) closeLightbox(); });
document.addEventListener("keydown", e => {
  if (!lb.classList.contains("open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});

// About photos are managed from admin.html (/api/about, default about.json): eight places,
// four in each group, already written in index.html with the defaults.
fetch("/api/about").then(r => r.ok ? r.json() : Promise.reject())
  .catch(() => fetch("about.json").then(r => r.json()))
  .then(list => {
    document.querySelectorAll(".about .collage img").forEach((img, i) => {
      const p = list[i];
      if (!p) return;
      if (img.getAttribute("src") !== p.src) img.src = p.src;
      img.alt = p.title;
      img.style.objectPosition = p.pos || "center 50%";
    });
  })
  .catch(() => {});

// Hero slideshow — cover photos are managed from admin.html. src/worker.js writes the first
// photo and the whole list (#hero-data) into the page; the other slides are added here.
const heroBox = document.querySelector(".hero-slides");
const heroPanels = [...heroBox.querySelectorAll(".hero-panel")];
let heroCount = 0, slideIdx = 0, heroTimer;

function showSlide(i) {
  slideIdx = i;
  heroPanels.forEach((panel, side) => {
    const at = (i + side) % heroCount;
    panel.querySelectorAll(".hero-slide").forEach(s => s.classList.toggle("active", +s.dataset.i === at));
  });
}

// A slide only comes up once its photo has loaded, so a slow phone never sees an empty grey frame
function startSlides() {
  clearInterval(heroTimer);
  if (heroCount < 2) return;
  heroTimer = setInterval(() => {
    const next = (slideIdx + 1) % heroCount;
    if (heroPanels.every(panel => panel.querySelector(`.hero-slide[data-i="${(next + heroPanels.indexOf(panel)) % heroCount}"] img`)?.complete)) showSlide(next);
  }, 6000);
}

function buildSlides(list) {
  if (!list.length) return;
  heroCount = list.length;
  heroBox.classList.toggle("single", heroCount < 2);
  // The other photos wait for the first one, so they don't share a slow connection with it
  const first = heroBox.querySelector(".hero-slide img");
  if (first && !first.complete) {
    first.addEventListener("load", () => buildSlides(list), { once: true });
    first.addEventListener("error", () => buildSlides(list), { once: true });
    return;
  }
  heroPanels.forEach((panel, side) => {
    list.forEach((h, i) => {
      if (panel.querySelector(`.hero-slide[data-i="${i}"]`)) return; // the one already in the page
      const img = Object.assign(document.createElement("img"), { src: h.src, alt: h.title, onload: () => img.classList.add("in") });
      img.style.objectPosition = h.pos || "center 50%";
      if (i !== side) img.fetchPriority = "low";
      const slide = Object.assign(document.createElement("div"), { className: "hero-slide" });
      slide.dataset.i = i;
      slide.append(img);
      panel.append(slide);
    });
  });
  showSlide(0);
  startSlides();
}

// A photo that finished loading before this script ran has already missed its onload
heroBox.querySelectorAll("img").forEach(img => { if (img.complete && img.naturalWidth) img.classList.add("in"); });

const heroData = document.getElementById("hero-data");
if (heroData) buildSlides(JSON.parse(heroData.textContent));
else fetch("/api/hero").then(r => r.ok ? r.json() : []).then(buildSlides).catch(() => {});

// Nav: background on scroll + mobile menu
const nav = document.getElementById("nav");
const toggle = nav.querySelector(".nav-toggle");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 60);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("menu-open");
  toggle.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
});
nav.querySelectorAll(".nav-links a").forEach(a =>
  a.addEventListener("click", () => {
    nav.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  })
);

// Reveal on scroll — items in the same group follow each other in a short stagger
const revealGroups = [".section > h2", ".about-copy", ".collage figure", ".line", ".portfolio-head p",
  ".packages-head p", ".pkg", ".pay-steps li", ".terms-list li", ".quote-photo", ".quote blockquote",
  ".contact-info > *", ".contact-form"];
const io = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); io.unobserve(entry.target); }
  });
}, { threshold: 0.1 });
revealGroups.forEach(selector => document.querySelectorAll(selector).forEach(el => {
  el.classList.add("reveal");
  el.style.setProperty("--i", [...el.parentElement.children].indexOf(el) % 4);
  io.observe(el);
}));

// The two strands: they leave the two hero photos, weave down the page behind the sections,
// then come in from opposite edges of #knot-slot and hook together in a reef knot.
// Scrolling draws them; the knot darkens once it closes.
const strands = document.getElementById("strands");
const knotSlot = document.getElementById("knot-slot");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const main = document.querySelector("main");
let strandTable = [];

function weave(points) {
  return points.reduce((d, [x, y], i) => {
    if (!i) return `M${x} ${y}`;
    const [px, py] = points[i - 1], mid = (py + y) / 2;
    return `${d}C${px} ${mid} ${x} ${mid} ${x} ${y}`;
  }, "");
}

// One rope of the knot, from the page edge (edgeX, top) into a loop around the other rope and out
// to a short loose end. turn = 1 or -1: the second rope is the first turned half a circle.
function ropePath(edgeX, top, cx, cy, size, turn) {
  const p = (x, y) => `${cx + x * size * turn} ${cy + y * size * turn}`;
  const inY = cy - 60 * size * turn, inX = cx - 190 * size * turn;
  return `M${edgeX} ${top}C${edgeX} ${inY} ${(edgeX + inX) / 2} ${inY} ${inX} ${inY}` +
    `C${p(-100, -60)} ${p(30, -50)} ${p(70, -26)}C${p(104, -8)} ${p(104, 8)} ${p(70, 26)}` +
    `C${p(30, 50)} ${p(-100, 60)} ${p(-190, 60)}C${p(-222, 60)} ${p(-250, 76)} ${p(-262, 100)}`;
}

// Where a rope crosses the middle; drawn on top so the two read as tied, not just crossed
function overPiece(path, cx, cy, topHalf) {
  const total = path.getTotalLength();
  let best = 0, bestGap = Infinity;
  for (let l = 0; l < total; l += 2) {
    const pt = path.getPointAtLength(l);
    if ((pt.y < cy) !== topHalf) continue;
    if (Math.abs(pt.x - cx) < bestGap) { bestGap = Math.abs(pt.x - cx); best = l; }
  }
  const pts = [];
  for (let l = best - 15; l <= best + 15; l += 3) {
    const pt = path.getPointAtLength(l);
    pts.push(`${pt.x} ${pt.y}`);
  }
  const d = `M${pts.join("L")}`;
  return `<path class="over halo" d="${d}"/><path class="over" d="${d}"/>`;
}

function drawStrands() {
  const W = main.clientWidth, H = main.scrollHeight;
  const slot = knotSlot.getBoundingClientRect();
  const top = slot.top - main.getBoundingClientRect().top;
  const cx = W / 2, cy = top + slot.height / 2;
  const size = Math.min(1, W / 640);
  const hero = document.getElementById("hero").offsetHeight;
  const stops = [...main.querySelectorAll(":scope > section:not(.hero):not(.contact)")].map(el => el.offsetTop);
  const edge = W * .05;

  const rope = turn => ropePath(turn > 0 ? edge : W - edge, top, cx, cy, size, turn);
  const route = (start, sway, turn) => {
    const pts = [[W * start, hero - 40], ...stops.map((y, i) => [W * sway[i % 2], y]), [turn > 0 ? edge : W - edge, top]];
    return weave(pts) + rope(turn).replace(/^M[^C]+/, "");
  };

  strands.setAttribute("width", W);
  strands.setAttribute("height", H);
  strands.setAttribute("viewBox", `0 0 ${W} ${H}`);
  strands.innerHTML = `
    <path class="strand" pathLength="1" d="${route(.25, [.92, .08], 1)}"/>
    <path class="strand" pathLength="1" d="${route(.75, [.06, .9], -1)}"/>
    <path class="knot" d="${rope(1)}"/>
    <path class="knot" d="${rope(-1)}"/>`;
  const ropes = strands.querySelectorAll(".knot");
  strands.insertAdjacentHTML("beforeend", overPiece(ropes[0], cx, cy, true) + overPiece(ropes[1], cx, cy, false));

  // How far along each strand the line must be drawn when the reader reaches a given height
  strandTable = [...strands.querySelectorAll(".strand")].map((path, n) => {
    const total = path.getTotalLength(), ropeStart = total - ropes[n].getTotalLength(), rows = [];
    for (let l = 0; l < ropeStart; l += 24) rows.push([path.getPointAtLength(l).y, l / total]);
    rows.push([top, ropeStart / total], [cy + 100 * size, 1]);
    return rows;
  });
  stepStrands();
}

function stepStrands() {
  const reach = calm ? Infinity : window.scrollY + innerHeight * .7;
  strands.querySelectorAll(".strand").forEach((path, n) => {
    const rows = strandTable[n], i = rows.findIndex(r => r[0] > reach);
    let done = 1;
    if (i === 0) done = 0;
    else if (i > 0) {
      const [y0, f0] = rows[i - 1], [y1, f1] = rows[i];
      done = f0 + (f1 - f0) * (reach - y0) / (y1 - y0);
    }
    path.style.strokeDashoffset = 1 - done;
  });
  const last = strandTable[0]?.at(-1)[0];
  strands.classList.toggle("tied", reach >= last);
}

let strandFrame;
new ResizeObserver(() => {
  cancelAnimationFrame(strandFrame);
  strandFrame = requestAnimationFrame(drawStrands);
}).observe(main);
window.addEventListener("scroll", () => { if (strandTable.length) stepStrands(); }, { passive: true });

// Contact form → saves the enquiry to the Google Sheet CRM (see crm/README.md),
// then opens WhatsApp with the details filled in
const WHATSAPP = "917736301133";
const CRM_URL = ""; // Apps Script web app URL ending in /exec
document.getElementById("contact-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = new FormData(e.target);
  if (CRM_URL) {
    fetch(CRM_URL, { method: "POST", mode: "no-cors", keepalive: true, body: new URLSearchParams(f) })
      .catch(() => {}); // never block the WhatsApp hand-off
  }
  const lines = [
    "Hi ISHQ KNOT! I'd like to enquire about a booking.",
    `Name: ${f.get("name")}`,
    `Phone: ${f.get("phone")}`,
    f.get("date") && `Wedding date: ${f.get("date")}`,
    f.get("venue") && `Venue: ${f.get("venue")}`,
    `Package: ${f.get("package") || "Not sure yet"}`,
    f.get("message") && `Message: ${f.get("message")}`,
  ].filter(Boolean);
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
});

// Reviews the admin approved slide past in a loop. With none yet, the section stays hidden.
const REVIEW_SPEED = 40; // px a second

function reviewCard(r, copy) {
  const card = document.createElement("article");
  card.className = "review";
  if (copy) card.setAttribute("aria-hidden", "true");
  const stars = Object.assign(document.createElement("div"), { className: "review-stars", textContent: "★".repeat(r.stars) + "☆".repeat(5 - r.stars) });
  stars.setAttribute("aria-label", `${r.stars} of 5 stars`);
  const cite = Object.assign(document.createElement("cite"), { textContent: r.names });
  if (r.place) cite.append(Object.assign(document.createElement("small"), { textContent: r.place }));
  card.append(stars, Object.assign(document.createElement("p"), { textContent: r.text }), cite);
  return card;
}

fetch("/api/reviews").then(r => r.ok ? r.json() : []).then(list => {
  if (!list.length) return;
  const track = document.getElementById("reviews-track");
  track.append(...list.map(r => reviewCard(r)));
  document.getElementById("reviews").hidden = false;
  if (calm) return;
  // Repeat the reviews until one round is wider than the screen, then add the round again
  const wide = Math.max(innerWidth, screen.width);
  while (track.scrollWidth < wide) track.append(...list.map(r => reviewCard(r, true)));
  const round = track.children.length;
  for (let i = 0; i < round; i++) track.append(reviewCard(list[i % list.length], true));
  track.style.setProperty("--loop", `${track.scrollWidth / 2 / REVIEW_SPEED}s`);
}).catch(() => {});

document.getElementById("year").textContent = new Date().getFullYear();
