const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTGmaTPdReMCx5yseoJVANx2zUwILfk9eQ9rG8IEqIOv-CHGtP_iRxeOCnOf7pYZzN2RV1dq4CPXiiG/pub?gid=813074154&single=true&output=csv";
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSePrfQZy-nylSzyb4CcOv2R-5eYdABNdOkDkeEd2E9f-dr16Q/viewform"

const $ = (id) => document.getElementById(id);

function showToast(message, ms = 900){
  const t = $("toast");
  if (!t) return;
  t.innerHTML = `<span class="spark"></span><span>${escapeHtml(message)}</span>`;
  t.classList.remove("hidden");
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.add("hidden"), ms);
}

function goWithToast(message, fn, delay = 650){
  showToast(message, delay + 450);
  setTimeout(fn, delay);
}

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && inQuotes && n === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { row.push(cur); cur = ""; continue; }
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && n === "\n") i++;
      row.push(cur); rows.push(row);
      row = []; cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function toInt(x) {
  const n = parseInt(String(x || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function normalize(s) { return String(s || "").trim(); }
function contains(hay, needle) { return hay.toLowerCase().includes(needle.toLowerCase()); }
function dateValue(s) { const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime(); }

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;")
    .replaceAll("\n","<br/>");
}

function buildItem(rec) {
  const wrap = document.createElement("div");
  wrap.className = "item card";
  wrap.id = rec._id; // for shareable hash links

  wrap.style.cursor = "pointer";
wrap.addEventListener("click", (e) => {
  // ignore clicks on buttons inside the card (copy buttons)
  if (e.target.closest("button")) return;

  goWithToast("Oof. This one hits. Taking you there…", () => {
    location.hash = `#${rec._id}`;
    wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 450);
});
  
  const meta = document.createElement("div");
  meta.className = "metaRow";

  const b1 = document.createElement("span");
  b1.className = "badge";
  b1.textContent = rec.category || "Uncategorized";

  const b2 = document.createElement("span");
  b2.className = "badge";
  b2.textContent = rec.age != null ? `Age ${rec.age}` : "Age ?";

  const b3 = document.createElement("span");
  b3.className = "badge";
  b3.textContent = rec.country ? rec.country : "—";

  const b4 = document.createElement("span");
  b4.className = "badge";
  b4.textContent = rec.timestamp ? new Date(rec.timestamp).toLocaleDateString() : "";

  meta.append(b1, b2, b3, b4);

  const h3 = document.createElement("h3");
  h3.textContent = rec.regret || "";

  wrap.append(meta, h3);

  if (rec.instead) {
    const blk = document.createElement("div");
    blk.className = "block";
    blk.innerHTML = `<div class="k">What I would do instead</div>${escapeHtml(rec.instead)}`;
    wrap.appendChild(blk);
  }

  if (rec.advice) {
    const blk = document.createElement("div");
    blk.className = "block";
    blk.innerHTML = `<div class="k">Advice to someone younger</div>${escapeHtml(rec.advice)}`;
    wrap.appendChild(blk);
  }

  // Share buttons
  const shareRow = document.createElement("div");
  shareRow.className = "shareRow";

  const copyTextBtn = document.createElement("button");
  copyTextBtn.className = "btn smallBtn";
  copyTextBtn.type = "button";
  copyTextBtn.textContent = "Copy text";

  const copyLinkBtn = document.createElement("button");
  copyLinkBtn.className = "btn smallBtn secondary";
  copyLinkBtn.type = "button";
  copyLinkBtn.textContent = "Copy link";

  copyTextBtn.addEventListener("click", async () => {
    const text = formatShareText(rec);
    await navigator.clipboard.writeText(text);
    copyTextBtn.textContent = "Copied ✓";
    setTimeout(() => (copyTextBtn.textContent = "Copy text"), 1200);
  });

  copyLinkBtn.addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}#${rec._id}`;
    await navigator.clipboard.writeText(link);
    copyLinkBtn.textContent = "Copied ✓";
    setTimeout(() => (copyLinkBtn.textContent = "Copy link"), 1200);
  });

  shareRow.append(copyTextBtn, copyLinkBtn);
  wrap.appendChild(shareRow);

  return wrap;
}

function formatShareText(rec){
  const bits = [];
  bits.push(`[${rec.category || "Uncategorized"}] ${rec.country ? rec.country : ""} ${rec.age != null ? `(Age ${rec.age})` : ""}`.trim());
  bits.push(`Regret: ${rec.regret || ""}`);
  if (rec.instead) bits.push(`Instead: ${rec.instead}`);
  if (rec.advice) bits.push(`Advice: ${rec.advice}`);
  bits.push(`— Regret Index`);
  return bits.join("\n");
}

let ALL = [];
let FILTERED = [];

const CATEGORY_COLORS = {
  "Career": "#7c3aed",
  "Love": "#ef4444",
  "Health": "#22c55e",
  "Money": "#eab308",
  "Family": "#06b6d4",
  "Friends": "#3b82f6",
  "Self": "#a855f7",
  "Uncategorized": "#94a3b8"
};

const COUNTRY_ALIASES = {
  "usa": "united states of america",
  "us": "united states of america",
  "u.s.": "united states of america",
  "uk": "united kingdom",
  "u.k.": "united kingdom",
  "uae": "united arab emirates"
};

let LAST_IDS = new Set();
let MAP_READY = false;
let WORLD_GEO = null;

async function initMap(){
  // world atlas topojson (public CDN)
  const topo = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r=>r.json());
  const countries = topojson.feature(topo, topo.objects.countries);
  WORLD_GEO = countries;

  renderLegend();
  MAP_READY = true;
  drawMap(); // initial
}

function computeCountryCategoryLeaders(){
  // returns: { countryNameLower -> {leaderCat, totalsByCat, total} }
  const by = {};

  for (const r of ALL){
    const cn = normCountryName(r.country);
    if (!cn) continue;
    const cat = r.category || "Uncategorized";
    by[cn] ||= { totalsByCat: {}, total: 0 };
    by[cn].totalsByCat[cat] = (by[cn].totalsByCat[cat] || 0) + 1;
    by[cn].total += 1;
  }

  for (const cn of Object.keys(by)){
    const entries = Object.entries(by[cn].totalsByCat).sort((a,b)=>b[1]-a[1]);
    by[cn].leaderCat = entries[0]?.[0] || "Uncategorized";
  }

  return by;
}

function setCountryFilterFromMap(countryName){
  // put the clicked country name into the existing filter box
  $("country").value = countryName;

  // clear category chip selection? (optional)
  // $("category").value = "";

  applyFilters();

  // scroll to results
  document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function drawMap(){
  if (!MAP_READY || !WORLD_GEO) return;

  const svg = d3.select("#worldMap");
  svg.selectAll("*").remove();

  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const projection = d3.geoNaturalEarth1().fitSize([width, height], WORLD_GEO);
  const path = d3.geoPath(projection);

  const agg = computeCountryCategoryLeaders();
  const tip = $("mapTip");

  svg.append("g")
    .selectAll("path")
    .data(WORLD_GEO.features)
    .join("path")
    .attr("d", path)
    .attr("fill", d => {
      const name = (d.properties?.name || "").toLowerCase();
      const rec = agg[name];
      const cat = rec?.leaderCat || "Uncategorized";
      return CATEGORY_COLORS[cat] || CATEGORY_COLORS["Uncategorized"];
    })
    .attr("stroke", "rgba(255,255,255,.12)")
    .attr("stroke-width", 0.6)
    .on("click", (event, d) => {
  const name = (d.properties?.name || "").trim();
  if (!name) return;

  goWithToast(`Zooming into ${name}…`, () => {
    setCountryFilterFromMap(name);
  }, 450);
})
    .on("mousemove", (event, d) => {
      const name = (d.properties?.name || "Unknown");
      const key = name.toLowerCase();
      const rec = agg[key];

      let html = `<div class="t">${escapeHtml(name)}</div>`;
      if (!rec){
        html += `<div class="muted">No submissions yet.</div>`;
      } else {
        html += `<div class="muted">Total: ${rec.total}</div>`;
        const entries = Object.entries(rec.totalsByCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
        html += `<div style="margin-top:6px; display:grid; gap:4px;">` +
          entries.map(([cat,n])=>{
            const col = CATEGORY_COLORS[cat] || CATEGORY_COLORS["Uncategorized"];
            return `<div style="display:flex; justify-content:space-between; gap:10px;">
              <span><span style="display:inline-block;width:10px;height:10px;border-radius:4px;background:${col};margin-right:8px;"></span>${escapeHtml(cat)}</span>
              <span class="muted">${n}</span>
            </div>`;
          }).join("") +
          `</div>`;
      }

      tip.innerHTML = html;
      tip.classList.remove("hidden");

      // position tooltip near cursor (within container)
      const wrap = $("mapWrap").getBoundingClientRect();
      const x = event.clientX - wrap.left + 14;
      const y = event.clientY - wrap.top + 14;
      tip.style.left = `${Math.min(x, wrap.width - 290)}px`;
      tip.style.top = `${Math.min(y, wrap.height - 140)}px`;
    })
    .on("mouseleave", () => {
      tip.classList.add("hidden");
    });
}

function recordFromRow(headers, row) {
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i] ?? "");

  const timestamp = obj["Timestamp"] || obj["timestamp"] || "";
const age = toInt(obj["Age"] || obj["age"]);
const country = normalize(obj["Country"] || obj["country"]);
const category = normalize(obj["Regret Category"] || obj["Category"] || obj["category"]);
const regret = normalize(obj["The Regret"] || obj["Regret"] || obj["regret"]);
const instead = normalize(obj["What I would do instead (optional)"] || obj["What I would do instead"] || obj["Instead"] || obj["instead"]);
const advice = normalize(obj["Advice to someone younger (optional)"] || obj["Advice to someone younger"] || obj["Advice"] || obj["advice"]);


  if (!regret) return null;

const rec = { timestamp, age, country, category, regret, instead, advice };
if (looksSpammy(rec) || looksTooProfane(rec)) return null;

return rec;
return { timestamp, age, country, category, regret, instead, advice };
}

function applyFilters() {
  const q = normalize($("q").value);
  const category = normalize($("category").value);
  const ageMin = toInt($("ageMin").value);
  const ageMax = toInt($("ageMax").value);
  const country = normalize($("country").value);
  const sort = $("sort").value;

  FILTERED = ALL.filter(r => {
    if (category && r.category !== category) return false;
    if (ageMin != null && (r.age == null || r.age < ageMin)) return false;
    if (ageMax != null && (r.age == null || r.age > ageMax)) return false;
    if (country && (!r.country || !contains(r.country, country))) return false;
    if (q) {
      const blob = `${r.category} ${r.country} ${r.age} ${r.regret} ${r.instead} ${r.advice}`;
      if (!contains(blob, q)) return false;
    }
    return true;
  });

  FILTERED.sort((a, b) => {
    if (sort === "newest") return dateValue(b.timestamp) - dateValue(a.timestamp);
    if (sort === "oldest") return dateValue(a.timestamp) - dateValue(b.timestamp);
    if (sort === "age_desc") return (b.age ?? -1) - (a.age ?? -1);
    if (sort === "age_asc") return (a.age ?? 999) - (b.age ?? 999);
    return 0;
  });

  render();
}

function render() {
  const list = $("list");
  const empty = $("empty");
  list.innerHTML = "";

  if (!FILTERED.length) {
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    for (const rec of FILTERED) list.appendChild(buildItem(rec));
  }

  $("stats").textContent = `${ALL.length} regrets • showing ${FILTERED.length}`;
}

function looksSpammy(rec){
  const blob = `${rec.regret}\n${rec.instead}\n${rec.advice}`.toLowerCase();

  // too many links
  const linkCount = (blob.match(/https?:\/\/|www\./g) || []).length;
  if (linkCount >= 2) return true;

  // obvious spam keywords (you can tune this)
  const spamWords = ["crypto", "forex", "telegram", "whatsapp me", "dm me", "onlyfans", "airdrop", "casino", "betting", "loan"];
  if (spamWords.some(w => blob.includes(w))) return true;

  // very low-effort junk
  const letters = blob.replace(/[^a-z]/g, "");
  if (letters.length < 10) return true;

  return false;
}

function looksTooProfane(rec){
  // lightweight filter; not perfect, but it blocks the worst
  const blob = `${rec.regret} ${rec.instead} ${rec.advice}`.toLowerCase();
  const hard = ["kys", "kill yourself", "rape", "nazi"]; // keep this list short + serious
  return hard.some(w => blob.includes(w));
}

function makeId(rec){
  // stable-ish id for share links: timestamp + short hash of regret
  const base = `${rec.timestamp}|${rec.regret}`.toLowerCase();
  let h = 0;
  for (let i=0;i<base.length;i++) h = (h*31 + base.charCodeAt(i)) >>> 0;
  return `r${h.toString(16)}`;
}

function normCountryName(s){
  const x = normalize(s).toLowerCase();
  if (!x) return "";
  return (COUNTRY_ALIASES[x] || x).replace(/\s+/g," ").trim();
}

function ageBand(age){
  if (age == null) return "Unknown";
  if (age < 20) return "<20";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60+";
}

function renderMiniStats(){
  const total = ALL.length;

  const cats = {};
  const bands = {};
  const countries = new Set();

  for (const r of ALL){
    const c = r.category || "Uncategorized";
    cats[c] = (cats[c] || 0) + 1;

    const b = ageBand(r.age);
    bands[b] = (bands[b] || 0) + 1;

    if (r.country) countries.add(normCountryName(r.country));
  }

  const topCat = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
  const topBand = Object.entries(bands).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
  const nCountries = countries.size;

  const el = $("miniStats");
  el.innerHTML = "";

  const items = [
    ["Total regrets", total.toLocaleString()],
    ["Top category", topCat],
    ["Most common age band", topBand],
    ["Countries", nCountries.toLocaleString()]
  ];

  for (const [k,v] of items){
    const card = document.createElement("div");
    card.className = "card statCard";
    card.innerHTML = `<div class="statK">${k}</div><div class="statV">${escapeHtml(v)}</div>`;
    el.appendChild(card);
  }
}

function renderBroadcast(newOnes){
  const box = $("broadcast");

  // if first time, fill with latest 12
  if (!box.dataset.init){
    box.dataset.init = "1";
    const latest = [...ALL].sort((a,b)=>dateValue(b.timestamp)-dateValue(a.timestamp)).slice(0, 12);
    box.innerHTML = "";
    for (const r of latest){
      box.appendChild(broadcastCard(r));
    }
    return;
  }

  // prepend new items (up to 5 each refresh)
  for (const r of newOnes.slice(0,5)){
    const node = broadcastCard(r);
    node.classList.add("pulse");
    box.prepend(node);
  }

  // trim to 20
  while (box.children.length > 20) box.removeChild(box.lastChild);
}

function broadcastCard(r){
  const d = document.createElement("div");
  d.className = "broadcastItem";
  const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : "";
  d.innerHTML = `
    <div class="broadcastTop">
      <span>${escapeHtml(r.country || "—")} • ${escapeHtml(r.category || "Uncategorized")}</span>
      <span>${escapeHtml(ts)}</span>
    </div>
    <div>${escapeHtml(r.regret || "")}</div>
  `;
  return d;
}

function renderLegend(){
  const leg = $("legend");
  leg.innerHTML = "";
  Object.entries(CATEGORY_COLORS).forEach(([cat, col])=>{
    if (cat === "Uncategorized") return;
    const d = document.createElement("div");
    d.className = "legItem";
    d.innerHTML = `<span class="sw" style="background:${col}"></span><span>${escapeHtml(cat)}</span>`;
    leg.appendChild(d);
  });
}

function renderChips(){
  const chips = $("chips");
  if (!chips) return;

  const cats = ["Career","Love","Health","Money","Family","Friends","Self"];
  chips.innerHTML = "";

  // All chip
  const all = document.createElement("button");
  all.className = "chip";
  all.type = "button";
  all.innerHTML = `<span class="dot" style="background:${CATEGORY_COLORS["Uncategorized"]}"></span>All`;
  all.addEventListener("click", () => {
    $("category").value = "";
    applyFilters();
    renderChips(); // refresh active state
  });
  chips.appendChild(all);

  for (const c of cats){
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.type = "button";
    btn.dataset.cat = c;
    btn.innerHTML = `<span class="dot" style="background:${CATEGORY_COLORS[c]}"></span>${c}`;
    btn.addEventListener("click", () => {
      $("category").value = c;
      applyFilters();
      renderChips();
      document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    chips.appendChild(btn);
  }

  // Active state
  const current = $("category").value || "";
  [...chips.querySelectorAll(".chip")].forEach(b=>{
    const cat = b.dataset.cat || "";
    if (!current && !cat) b.classList.add("active");
    else if (current && cat === current) b.classList.add("active");
    else b.classList.remove("active");
  });
}

async function loadOnce() {
  $("submitLink").href = FORM_URL;

  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load CSV");

  const csv = await res.text();
  const rows = parseCSV(csv);
  const headers = rows[0].map(h => String(h || "").trim());

  const nextAll = rows.slice(1)
    .map(r => recordFromRow(headers, r))
    .filter(Boolean)
    .map(r => {
      r._id = makeId(r);
      return r;
    });

  // detect new items for broadcast
  const nextIds = new Set(nextAll.map(r => r._id));
  const newOnes = nextAll.filter(r => !LAST_IDS.has(r._id))
    .sort((a,b)=>dateValue(b.timestamp)-dateValue(a.timestamp));

  ALL = nextAll;
  renderChips();
  LAST_IDS = nextIds;

  // update everything
  applyFilters();
  renderMiniStats();
  renderBroadcast(newOnes);
  drawMap();

  // if user opened a shared link, scroll it into view once
  if (location.hash && !document.body.dataset.hashDone){
    document.body.dataset.hashDone = "1";
    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function load() {
  if (!MAP_READY) await initMap();

  await loadOnce();

  // refresh every 12 seconds
  setInterval(() => {
    loadOnce().catch(() => {
      $("stats").textContent = "Live update failed. Check your CSV link + permissions.";
    });
  }, 12000);
}


function wire() {
  ["q","category","ageMin","ageMax","country","sort"].forEach(id => {
    $(id).addEventListener("input", applyFilters);
    $(id).addEventListener("change", applyFilters);
  });

  $("clearBtn").addEventListener("click", () => {
    $("q").value = "";
    $("category").value = "";
    $("ageMin").value = "";
    $("ageMax").value = "";
    $("country").value = "";
    $("sort").value = "newest";
    applyFilters();
  });

  $("randomBtn").addEventListener("click", () => {
    if (!FILTERED.length) return;
    const rec = FILTERED[Math.floor(Math.random() * FILTERED.length)];
    const list = $("list");
    list.innerHTML = "";
    list.appendChild(buildItem(rec));
    $("empty").classList.add("hidden");
    $("stats").textContent = `Random regret • ${ALL.length} total`;
  });
}

wire();
$("submitLink").addEventListener("click", (e) => {
  e.preventDefault();
  goWithToast("Alright… confess your villain arc 😈", () => {
    window.open(FORM_URL, "_blank", "noreferrer");
  });
});
load().catch(() => {
  $("stats").textContent = "Couldn’t load data. Check your CSV + Form URLs.";
});

window.addEventListener("resize", () => drawMap());



