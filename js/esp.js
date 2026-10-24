// ---------- หน้า ESP → ESP ----------
// อ่าน /stations.json ทุก 5 วินาที: ลำดับ (seq) ของสถานีไหนเพิ่ม = มีแพ็กเก็ตใหม่จาก node ผ่าน gateway
// ข้อมูลจากภายนอกใส่ด้วย textContent เท่านั้น

const DB_URL = 'https://taling-map-default-rtdb.asia-southeast1.firebasedatabase.app';
const POLL_MS = 5000;
const ROUND_MIN = 10;   // node ส่งเป็นรอบทุก 10 นาที (TEST_ROUND_MIN)
// เกณฑ์เดียวกับ js/config.js (หน้านี้ไม่โหลด Leaflet จึงไม่ใช้ config.js)
const LEVELS = [{ cm: 65, name: 'วิกฤต', color: '#c62828' }, { cm: 50, name: 'เตือน', color: '#ef6c00' }, { cm: 30, name: 'เฝ้าระวัง', color: '#f9a825' }];
const OK = { name: 'ปกติ', color: '#2e7d32' };

const lastSeq = {};
let firstLoad = true;
let seen = 0;
const $ = id => document.getElementById(id);

function statusOf(cm) { for (const l of LEVELS) if (cm >= l.cm) return l; return OK; }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function parseTime(t) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(String(t || ''));
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null;
}
function rssiInfo(r) {
  if (r === null) return { bars: 0, text: '—' };
  if (r >= -60) return { bars: 4, text: 'ดีมาก' };
  if (r >= -70) return { bars: 3, text: 'ดี' };
  if (r >= -80) return { bars: 2, text: 'พอใช้' };
  return { bars: 1, text: 'อ่อน (ลองขยับบอร์ดให้ใกล้กัน)' };
}
function td(text) { const c = document.createElement('td'); c.textContent = text; return c; }
function levelCell(cm) {
  const c = document.createElement('td');
  if (cm === null) { c.textContent = '—'; return c; }
  const st = statusOf(cm);
  const d = document.createElement('span'); d.className = 'dotc'; d.style.background = st.color;
  c.appendChild(d); c.appendChild(document.createTextNode(cm.toFixed(1) + ' cm · ' + st.name));
  return c;
}

// จุดวิ่ง node → gateway → Firebase
let animating = false;
function animatePacket() {
  const pkt = $('pkt'); if (!pkt || animating) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { flash('n-gw'); flash('n-fb'); return; }
  animating = true;
  const pts = [[150, 0], [330, 600], [470, 750], [610, 1300]];   // [x, ms]
  const t0 = performance.now();
  flash('n-node');
  (function step(now) {
    const t = now - t0;
    let x = pts[pts.length - 1][0];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][1]) { const a = pts[i - 1], b = pts[i]; x = a[0] + (b[0] - a[0]) * (t - a[1]) / (b[1] - a[1]); break; }
    }
    pkt.setAttribute('cx', x.toFixed(1));
    pkt.setAttribute('opacity', t < pts[pts.length - 1][1] ? '1' : '0');
    if (t > 600 && t < 700) flash('n-gw');
    if (t >= pts[pts.length - 1][1]) { flash('n-fb'); animating = false; return; }
    requestAnimationFrame(step);
  })(t0);
}
function flash(id) { const g = $(id); if (!g) return; g.classList.add('on'); setTimeout(() => g.classList.remove('on'), 900); }

function addFeedRow(id, s) {
  const tb = $('feed').tBodies[0];
  const empty = tb.querySelector('tr.empty'); if (empty) empty.remove();
  const tr = document.createElement('tr'); tr.className = 'new';
  const r = num(s.rssi);
  const screws = ['l1', 'l2', 'l3'].map((k, i) => 'L' + (i + 1) + (s[k] === true ? '●' : '○')).join(' ');
  tr.append(td(new Date().toLocaleTimeString('th-TH')), td(id), td('#' + (num(s.seq) ?? '—')), levelCell(num(s.level_cm)),
            td(r === null ? '—' : r + ' dBm · ' + rssiInfo(r).text), td(screws));
  tb.insertBefore(tr, tb.firstChild);
  while (tb.rows.length > 60) tb.deleteRow(tb.rows.length - 1);
}

function renderAll(entries) {
  const tb = $('all').tBodies[0];
  tb.textContent = '';
  entries.forEach(([id, s]) => {
    const tr = document.createElement('tr');
    const r = num(s.rssi);
    tr.append(td(id), td('#' + (num(s.seq) ?? '—')), td(String(s.time || '—').slice(0, 30)), levelCell(num(s.level_cm)), td(r === null ? '—' : r + ' dBm'));
    tb.appendChild(tr);
  });
}

function renderSummary(entries) {
  // แพ็กเก็ตล่าสุด = seq สูงสุด
  let latest = null;
  entries.forEach(([id, s]) => { const q = num(s.seq); if (q !== null && (!latest || q > latest.seq)) latest = { id: id, s: s, seq: q }; });
  if (!latest) { $('c-link').textContent = 'ยังไม่มีข้อมูล'; return; }
  const t = parseTime(latest.s.time);
  const ageMin = t ? Math.round((Date.now() - t) / 60000) : null;
  const alive = ageMin !== null && ageMin <= ROUND_MIN + 2;
  $('c-link').textContent = alive ? '🟢 ทำงาน' : '⚪ เงียบ';
  $('c-link-s').textContent = ageMin === null ? '' : alive ? 'ได้แพ็กเก็ตล่าสุด ' + (ageMin <= 0 ? 'เมื่อสักครู่' : ageMin + ' นาทีที่แล้ว') : 'ไม่มีแพ็กเก็ตใหม่ ' + ageMin + ' นาที (บอร์ดดับ/หลุด?)';
  $('c-last').textContent = latest.id + ' #' + latest.seq;
  $('c-last-s').textContent = String(latest.s.time || '').slice(0, 30);
  const r = num(latest.s.rssi), info = rssiInfo(r);
  $('c-rssi').textContent = r === null ? '—' : r + ' dBm';
  $('c-rssi-s').textContent = info.text;
  [...$('c-bars').children].forEach((b, i) => b.classList.toggle('on', i < info.bars));
  $('c-count').textContent = String(seen);
  $('flow-status').textContent = alive ? 'node → gateway → Firebase ทำงานปกติ' : 'ยังไม่มีแพ็กเก็ตใหม่ รอรอบถัดไปของ node';
}

async function poll() {
  try {
    const res = await fetch(DB_URL + '/stations.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json() || {};
    const entries = Object.keys(data).filter(id => /^[A-Za-z0-9_-]{1,32}$/.test(id) && data[id] && typeof data[id] === 'object')
      .sort().map(id => [id, data[id]]);
    let fresh = 0;
    entries.forEach(([id, s]) => {
      const q = num(s.seq);
      if (q === null) return;
      if (!firstLoad && lastSeq[id] !== undefined && q !== lastSeq[id]) { addFeedRow(id, s); seen++; fresh++; }
      lastSeq[id] = q;
    });
    firstLoad = false;
    if (fresh) animatePacket();
    renderAll(entries);
    renderSummary(entries);
  } catch (e) {
    $('flow-status').textContent = 'อ่าน Firebase ไม่ได้ (' + String(e.message).slice(0, 40) + ') จะลองใหม่';
  }
}

poll();
setInterval(poll, POLL_MS);
