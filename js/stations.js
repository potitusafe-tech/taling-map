// ---------- สถานี ----------
// สถานะ, สรุปรายอำเภอ, กล่องรายละเอียดสถานี, ภาพตัดขวางตลิ่ง และการโหลด stations.json

// ---------- สถานี ----------
function statusOf(cm) {
  for (const t of THRESHOLDS) if (cm >= t.cm) return t;
  return NORMAL;
}

// หาว่าสถานีอยู่อำเภอไหน จากพิกัด (ไม่ต้องใส่อำเภอเองใน stations.json)
function inRing(lon, lat, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function districtOf(s) {
  const f = LAYERS.dist.features.find(f => f.geometry.coordinates.some(poly => inRing(s.lon, s.lat, poly[0])));
  return f ? f.properties.code : '';
}
const distName = {};
LAYERS.dist.features.forEach(f => { distName[f.properties.code] = f.properties.name; });
const markerById = {};

// ชื่อสถานีพร้อมรหัสในวงเล็บ เช่น แม่น้ำบางปะกง (2401-1) ใช้รหัสนี้เป็น STATION_ID ใน ESP32
function stationLabel(s) { return s.name + ' (' + s.id + ')'; }

function colorText(st) { return st.color === '#f9a825' && !isDark() ? '#8a6100' : st.color; }

// กดอำเภอ: ซูมไปที่อำเภอ แล้วสรุปสถานีในอำเภอนั้น
function showDistrict(code) {
  const layer = distLayers[code];
  const f = layer.feature;
  map.fitBounds(layer.getBounds(), fitOpts(30));

  const box = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = districtTitle(f.properties.name);
  box.appendChild(b);
  const area = document.createElement('div'); area.className = 'note'; area.style.marginTop = '0';
  area.textContent = 'พื้นที่ ' + Number(f.properties.area_sqkm).toLocaleString('th-TH', { maximumFractionDigits: 1 }) + ' ตร.กม.';
  box.appendChild(area);

  const here = STATIONS.filter(s => districtOf(s) === code)
    .sort((a, c) => Number(c.level_cm) - Number(a.level_cm));
  if (!here.length) {
    const no = document.createElement('div'); no.style.marginTop = '6px'; no.textContent = 'ยังไม่มีสถานีในอำเภอนี้';
    box.appendChild(no);
  } else {
    const worst = statusOf(Number(here[0].level_cm));
    const sum = document.createElement('div'); sum.style.marginTop = '6px';
    sum.textContent = here.length + ' สถานี · สถานะสูงสุด: ';
    const w = document.createElement('b'); w.textContent = worst.name; w.style.color = colorText(worst); sum.appendChild(w);
    box.appendChild(sum);
    const tb = document.createElement('table'); tb.className = 'info sum';
    here.forEach(s => {
      const st = statusOf(Number(s.level_cm));
      const tr = document.createElement('tr');
      const a = document.createElement('td');
      const btn = document.createElement('button'); btn.type = 'button';
      const dot = document.createElement('i'); dot.style.background = st.color;
      btn.appendChild(dot); btn.appendChild(document.createTextNode(stationLabel(s)));
      btn.addEventListener('click', () => { map.flyTo([s.lat, s.lon], 12); markerById[s.id].openPopup(); });
      a.appendChild(btn);
      const lv = document.createElement('td'); lv.textContent = Number(s.level_cm).toFixed(1) + ' cm';
      const ss = document.createElement('td'); ss.textContent = st.name; ss.style.color = colorText(st);
      tr.appendChild(a); tr.appendChild(lv); tr.appendChild(ss); tb.appendChild(tr);
    });
    box.appendChild(tb);
    const nt = document.createElement('div'); nt.className = 'note'; nt.textContent = 'กดชื่อสถานีเพื่อดูรายละเอียด';
    box.appendChild(nt);
  }
  L.popup({ minWidth: 260, autoPan: false }).setLatLng(layer.getBounds().getCenter()).setContent(box).openOn(map);
}


// ---------- ภาพตัดขวางตลิ่งในกล่องสถานี ----------
function levelY(cm) { return ZERO_Y - Math.max(-5, Math.min(150, Number(cm) || 0)) * PX_PER_CM; }
function bankOf(s) {
  if (BANKS[s.bank]) return Number(s.bank);
  let h = 0; for (const ch of String(s.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 5 + 1;
}
function wavePath(amp, len) {
  let d = 'M-200 0';
  for (let x = -200; x < 1000; x += len) d += ' q' + len / 4 + ' ' + (-amp) + ' ' + len / 2 + ' 0 t' + len / 2 + ' 0';
  return d + ' L1000 600 L-200 600 Z';
}
function bankFigure(s, st) {
  const n = bankOf(s), b = BANKS[n];
  const lvl = Number(s.level_cm);
  const ticks = THRESHOLDS.map(t => '<line x1="752" x2="800" y1="' + levelY(t.cm) + '" y2="' + levelY(t.cm) + '" stroke="' + t.color + '" stroke-width="5"/>').join('');
  const fig = document.createElement('div'); fig.className = 'fig';
  fig.innerHTML =
    '<svg viewBox="0 0 800 500" role="img" aria-label="ภาพตัดขวาง' + b.name + ' ระดับน้ำ ' + lvl.toFixed(1) + ' cm">' +
    '<line x1="580" y1="92" x2="580" y2="600" stroke="#d9582b" stroke-width="3" stroke-dasharray="10 8"/>' +
    '<g class="wl" style="transform:translateY(' + levelY(lvl) + 'px)"><g class="bob">' +
      '<g class="wv2"><path d="' + wavePath(7, 140) + '" fill="#7fbbe6"/></g>' +
      '<g class="wv1"><path d="' + wavePath(6, 100) + '" fill="#b6dbf4" fill-opacity=".92" stroke="#3a86c8" stroke-width="3"/></g>' +
    '</g></g>' +
    '<polygon points="' + b.ground + '" fill="#e2d1b1" stroke="#8a6d3b" stroke-width="2"/>' +
    (b.wall ? '<rect x="444" y="309" width="11" height="131" fill="#7a7a7a"/>' : '') +
    ticks +
    '<rect x="140" y="373" width="220" height="8" fill="#d9582b" stroke="#7a2e14" stroke-width="2"/>' +
    '<rect x="244" y="50" width="12" height="323" fill="#f2f2f2" stroke="#333" stroke-width="2"/>' +
    '<line x1="256" y1="218" x2="402" y2="76" stroke="#555" stroke-width="6"/>' +
    '<rect x="244" y="69" width="336" height="7" fill="#f2f2f2" stroke="#333" stroke-width="2"/>' +
    '<rect x="200" y="72" width="44" height="44" fill="#e6f4ea" stroke="#1e7a45" stroke-width="3"/>' +
    '<rect x="573" y="77" width="14" height="15" rx="2" fill="#222"/>' +
    SCREWS.map(sc => {
      const y = levelY(sc.cm), wet = lvl >= sc.cm;
      return '<circle cx="250" cy="' + y + '" r="9" fill="#e8a317" stroke="' + (wet ? '#2f7fc8' : '#8a5a00') + '" stroke-width="' + (wet ? 6 : 2.5) + '"/>' +
        '<text x="226" y="' + (y + 9) + '" text-anchor="end" font-size="26" font-weight="600" style="fill:' + (wet ? '#2f7fc8' : 'var(--muted)') + '">' + sc.id + '</text>';
    }).join('') +
    '<text x="790" y="150" text-anchor="end" font-size="44" font-weight="700" style="fill:' + colorText(st) + '">' + lvl.toFixed(1) + ' cm</text>' +
    '<text x="598" y="200" font-size="30" style="fill:var(--muted)">↕ ' + (140 - lvl).toFixed(1) + ' cm</text>' +
    '</svg>';
  const cap = document.createElement('div'); cap.className = 'cap';
  cap.textContent = 'แบบที่ ' + n + ' ' + b.name;
  fig.appendChild(cap);
  return fig;
}
// น้ำเลื่อนจากระดับก่อนหน้า (หรือจากก้นคลองเมื่อเพิ่งเปิด) ไปยังระดับล่าสุด
const waterY = {};
let rendering = false;
function riseWater(s, root) {
  const wl = root && root.querySelector('.wl');
  if (!wl) return;
  const target = levelY(s.level_cm);
  const from = waterY[s.id] !== undefined ? waterY[s.id] : 470;
  wl.style.transition = 'none';
  wl.style.transform = 'translateY(' + from + 'px)';
  wl.getBoundingClientRect();
  wl.style.transition = '';
  wl.style.transform = 'translateY(' + target + 'px)';
  waterY[s.id] = target;
}

function render() {
  // ข้อมูลใหม่เข้ามาแล้วกล่องสถานีเปิดค้างอยู่ ให้เปิดกลับและน้ำเลื่อนจากระดับเดิม
  const openId = Object.keys(markerById).find(id => markerById[id].isPopupOpen());
  rendering = true;
  stationLayer.clearLayers();
  rendering = false;
  const list = document.getElementById('list');
  list.textContent = '';
  const anySample = STATIONS.some(s => s.sample);
  document.getElementById('simtag').style.display = anySample ? '' : 'none';

  // เรียงตามอำเภอ แล้วใส่หัวข้ออำเภอในรายการด้านซ้าย
  const sorted = STATIONS.map(s => ({ s: s, code: districtOf(s) }))
    .sort((a, c) => a.code < c.code ? -1 : a.code > c.code ? 1 : 0);
  let lastCode = null;
  sorted.forEach(({ s, code }) => {
    if (code !== lastCode) {
      const h = document.createElement('button'); h.type = 'button'; h.className = 'grp';
      h.textContent = code ? districtTitle(distName[code]) : 'นอกเขตจังหวัด';
      if (code) h.addEventListener('click', () => showDistrict(code));
      list.appendChild(h);
      lastCode = code;
    }
    const st = statusOf(Number(s.level_cm));
    const lvl = Number(s.level_cm).toFixed(1);

    const el = document.createElement('div');
    el.className = 'mk';
    el.style.setProperty('--c', st.color);
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = st.color;
    const chip = document.createElement('span'); chip.className = 'chip';
    chip.textContent = stationLabel(s) + ' · ' + st.name;
    el.appendChild(dot); el.appendChild(chip);
    const icon = L.divIcon({ html: el, className: '', iconSize: [0, 0] });
    const m = L.marker([s.lat, s.lon], { icon: icon, title: stationLabel(s) }).addTo(stationLayer);
    markerById[s.id] = m;

    const pop = document.createElement('div');
    const hd = document.createElement('b'); hd.textContent = stationLabel(s) + ' · ' + st.name; hd.style.color = colorText(st); pop.appendChild(hd);
    if (code) { const dn = document.createElement('div'); dn.className = 'note'; dn.style.marginTop = '0'; dn.textContent = districtTitle(distName[code]); pop.appendChild(dn); }
    const rows = [];
    const num = (v, d) => (v === undefined || v === null || v === '') ? '-' : Number(v).toFixed(d);
    rows.push(['ระดับน้ำ (เหนือระดับต่ำสุด)', lvl + ' cm']);
    rows.push(['ระดับน้ำต่ำสุดที่บันทึก', num(s.min_cm, 1) + ' cm']);
    rows.push(['ระยะเซนเซอร์ถึงผิวน้ำ', num(140 - Number(s.level_cm), 1) + ' cm']);
    rows.push(['อุณหภูมิ', num(s.temp_c, 1) + ' °C']);
    rows.push(['ความชื้นสัมพัทธ์', num(s.rh, 0) + ' %']);
    rows.push(['ความกดอากาศ', num(s.pres_hpa, 1) + ' hPa']);
    [['L1', 65], ['L2', 80], ['L3', 95]].forEach(p => rows.push(['สกรูวัดระดับ ' + p[0] + ' (' + (p[0] === 'L1' ? 15 : p[0] === 'L2' ? 30 : 45) + ' cm)', Number(s.level_cm) >= p[1] ? 'เปียก' : 'แห้ง']));
    rows.push(['แบตเตอรี่', num(s.batt_v, 2) + ' V']);
    rows.push(['อัปเดตล่าสุด', s.time]);
    const tb = document.createElement('table'); tb.className = 'info';
    rows.forEach(r => { const tr = document.createElement('tr'); const a1 = document.createElement('td'); a1.textContent = r[0]; const a2 = document.createElement('td'); a2.textContent = r[1]; tr.appendChild(a1); tr.appendChild(a2); tb.appendChild(tr); });
    const wrap = document.createElement('div'); wrap.className = 'stwrap';
    wrap.appendChild(tb); wrap.appendChild(bankFigure(s, st));
    pop.appendChild(wrap);
    if (s.sample) { const sm = document.createElement('div'); sm.className = 'note'; sm.textContent = 'ตำแหน่ง ค่า และลักษณะตลิ่งเป็นข้อมูลจำลอง'; pop.appendChild(sm); }
    m.bindPopup(pop, { minWidth: 250, maxWidth: 640 });
    m.on('popupopen', e => {
      // ความกว้างคิดตอนเปิด ไม่ใช่ตอนวาด (ตอนวาดหน้าต่างอาจยังไม่มีขนาด)
      e.popup.options.maxWidth = Math.max(250, Math.min(640, window.innerWidth - 40));
      e.popup.update();
      riseWater(s, e.popup.getElement());
    });
    m.on('popupclose', () => { if (!rendering) delete waterY[s.id]; });

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'st';
    const d = document.createElement('span'); d.className = 'd'; d.style.background = st.color;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = stationLabel(s);
    const v = document.createElement('span'); v.className = 'v'; v.textContent = st.name;
    btn.appendChild(d); btn.appendChild(n); btn.appendChild(v);
    btn.addEventListener('click', () => { map.flyTo([s.lat, s.lon], 12); m.openPopup(); });
    list.appendChild(btn);
  });
  if (openId && markerById[openId] && map.hasLayer(markerById[openId])) markerById[openId].openPopup();
}

function renderLegend() {
  const lg = document.getElementById('legend');
  lg.textContent = '';
  const rows = THRESHOLDS.slice().reverse().map(t => ({ c: t.color, text: t.name + ' ตั้งแต่ ' + t.cm + ' cm (เกณฑ์ตัวอย่าง)' }));
  rows.unshift({ c: NORMAL.color, text: NORMAL.name });
  rows.forEach(r => {
    const row = document.createElement('div');
    const i = document.createElement('i'); i.style.background = r.c;
    const t = document.createElement('span'); t.textContent = r.text;
    row.appendChild(i); row.appendChild(t); lg.appendChild(row);
  });
}

// ---------- ข้อมูลสด ----------
// ลำดับ: Firebase (ถ้าตั้ง LIVE.firebaseUrl) → stations.json ข้าง index.html → data/stations.js
// ESP32 ส่งแค่ค่าที่วัด (level_cm, temp_c, ...) ไปที่ /stations/<id> ตำแหน่ง ชื่อ และแบบตลิ่งมาจาก data/stations.js
let baseStations = null;

function firebaseBase() {
  const u = String(LIVE.firebaseUrl || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)$/.test(u) ? u : '';
}

// รวมค่าสดเข้ากับสถานีเดิมด้วย id; id ใหม่ที่ส่ง lat/lon มาด้วยจะถูกเพิ่มเป็นสถานีใหม่
function mergeLive(base, live) {
  const byId = {};
  base.forEach(s => { byId[s.id] = Object.assign({}, s); });
  Object.keys(live || {}).forEach(id => {
    const v = live[id];
    if (!v || typeof v !== 'object') return;
    const merged = Object.assign({}, byId[id] || {}, v, { id: id, sample: false });
    if (v.level_cm === undefined && byId[id]) merged.level_cm = byId[id].level_cm;
    byId[id] = merged;
  });
  return sanitizeStations(Object.keys(byId).map(k => byId[k]));
}

function setLiveMsg(text, ok) {
  const el = document.getElementById('livemsg');
  if (!el) return;
  el.textContent = text;
  el.dataset.state = ok ? 'ok' : 'off';
}

async function loadLive() {
  if (!baseStations) baseStations = STATIONS.slice();
  const fb = firebaseBase();
  if (fb) {
    try {
      const res = await fetch(fb + '/stations.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const clean = mergeLive(baseStations, data && typeof data === 'object' ? data : {});
      const n = Object.keys(data || {}).filter(id => clean.some(s => s.id === id)).length;
      STATIONS = clean; render();
      setLiveMsg('ข้อมูลสดจาก ESP32: ' + n + ' สถานี · อ่านล่าสุด ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), true);
    } catch (e) {
      setLiveMsg('เชื่อมต่อ Firebase ไม่ได้ (' + safeText(e.message, 40) + ') แสดงค่าล่าสุดที่มี', false);
    }
    return;
  }
  setLiveMsg(LIVE.firebaseUrl ? 'URL ของ Firebase ใน js/config.js ไม่ถูกรูปแบบ' : 'ยังไม่ได้เชื่อม ESP32 (ตั้ง LIVE.firebaseUrl ใน js/config.js)', false);
  try {
    const res = await fetch('stations.json', { cache: 'no-store' });
    if (!res.ok) return;
    const clean = sanitizeStations(await res.json());
    if (clean.length) { STATIONS = clean; render(); }
  } catch (e) { /* ไม่มีไฟล์ ใช้ข้อมูลตัวอย่างต่อ */ }
}
