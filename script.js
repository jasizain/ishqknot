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
      <img src="${p.src}" alt="${p.title}" loading="lazy"${p.pos ? ` style="object-position:${p.pos}"` : ""}>
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
  card.innerHTML = `
    ${p.featured ? '<span class="pkg-badge">Most complete</span>' : ""}
    <p class="pkg-num">Package ${num}</p>
    <h3>${p.name}</h3>
    <p class="pkg-title">${p.title}</p>
    ${p.quote ? `<p class="pkg-quote">“${p.quote}”</p>` : ""}
    <p class="pkg-label">Coverage team</p>
    <p class="pkg-team">${p.team.join(" · ")}</p>
    <p class="pkg-label">Included</p>
    ${p.groups
      ? Object.entries(p.groups).map(([g, items]) => `<p class="pkg-group">${g}</p>${list(items)}`).join("")
      : list(p.includes)}
    <div class="pkg-foot">
      <p class="pkg-price">${p.price || "Price on request"}</p>
      <a href="#contact" class="btn ${p.featured ? "btn-light" : "btn-dark"}" data-choose="${label}">Enquire</a>
    </div>`;
  pkgGrid.appendChild(card);
  pkgSelect.add(new Option(label, label));
});

pkgGrid.addEventListener("click", e => {
  const btn = e.target.closest("[data-choose]");
  if (btn) pkgSelect.value = btn.dataset.choose;
});

document.querySelectorAll(".pkg-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelector(".pkg-tab.active").classList.remove("active");
    tab.classList.add("active");
    pkgGrid.querySelectorAll(".pkg").forEach(card =>
      card.classList.toggle("hidden", tab.dataset.pkg !== "all" && card.dataset.type !== tab.dataset.pkg));
  });
});

// Filters + "View more" (shows two rows at first)
const PREVIEW = 8;
const moreBtn = document.getElementById("gallery-more");
let activeFilter = "all";
let expanded = false;

function renderGallery() {
  let shown = 0, matches = 0;
  gallery.querySelectorAll(".gallery-item").forEach(item => {
    const match = activeFilter === "all" || item.dataset.category === activeFilter;
    if (match) matches++;
    const show = match && (expanded || shown < PREVIEW);
    if (show) shown++;
    const wasHidden = item.classList.contains("hidden");
    item.classList.toggle("hidden", !show);
    if (show && wasHidden) { item.style.animation = "none"; item.offsetHeight; item.style.animation = ""; }
  });
  moreBtn.parentElement.hidden = matches <= PREVIEW;
  moreBtn.textContent = expanded ? "Show less" : `View more photos (${matches - PREVIEW})`;
}

document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(".filter.active").classList.remove("active");
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

// Hero slideshow — cover photos are managed from admin.html (/api/hero, default hero.json).
// The slides written in index.html show first; they're swapped if the saved list differs.
const heroBox = document.querySelector(".hero-slides");
let slideIdx = 0;

fetch("/api/hero").then(r => r.ok ? r.json() : Promise.reject())
  .then(list => {
    const current = [...heroBox.querySelectorAll("img")].map(img => img.getAttribute("src") + img.style.objectPosition);
    if (!list.length || list.map(h => h.src + (h.pos || "center 50%")).join() === current.join()) return;
    heroBox.innerHTML = list.map((h, i) => `
      <div class="hero-slide${i === 0 ? " active" : ""}" data-title="${h.title}">
        <img src="${h.src}" alt="${h.title}" style="object-position: ${h.pos || "center 50%"}"${i ? ' loading="lazy"' : ""}>
      </div>`).join("");
    slideIdx = 0;
  })
  .catch(() => {});

setInterval(() => {
  const heroSlides = heroBox.querySelectorAll(".hero-slide");
  if (heroSlides.length < 2) return;
  heroSlides[slideIdx].classList.remove("active");
  slideIdx = (slideIdx + 1) % heroSlides.length;
  heroSlides[slideIdx].classList.add("active");
}, 6000);

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

// Reveal sections on scroll
const revealEls = document.querySelectorAll(".section-head, .about-img, .about-text, .terms-inner > div, .contact-info, .contact-form, .quote blockquote");
revealEls.forEach(el => el.classList.add("reveal"));
const io = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); io.unobserve(entry.target); }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

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

document.getElementById("year").textContent = new Date().getFullYear();
