// ---------- ข้อมูลสด ----------
// อ่านข้อมูลจาก Firebase (หรือ stations.json) รวมกับข้อมูลสถานี และคาดการณ์เวลาอัปเดตครั้งต่อไป

// ---------- คาดการณ์เวลาอัปเดตครั้งต่อไป ----------
// เวลาในข้อมูลเป็น "dd/MM/yyyy HH:mm" (gateway ใส่ให้) + รอบส่ง (every_min ของสถานี หรือ LIVE.expectedEveryMin)
function parseStationTime(t) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return null;
  const y = Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]);   // รองรับปี พ.ศ.
  return new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}
function hhmm(d) { return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
function nextUpdate(s) {
  if (s.sample) return null;
  const last = parseStationTime(s.time);
  const every = s.every_min || LIVE.expectedEveryMin;
  if (!last || !every) return null;
  const at = new Date(last.getTime() + every * 60000);
  const diffMin = Math.round((at - Date.now()) / 60000);
  let text;
  if (diffMin > 0) text = hhmm(at) + ' น. (อีกราว ' + diffMin + ' นาที)';
  else if (diffMin > -every) text = hhmm(at) + ' น. (ใกล้ถึงแล้ว)';
  else text = 'เลยกำหนด ' + (-diffMin) + ' นาที — บอร์ดอาจไม่ได้ส่ง';
  return { at: at, diffMin: diffMin, text: text };
}
// เงียบ = ไม่มีข้อมูลใหม่เกินหนึ่งรอบหลังเวลาที่คาดไว้ (ข้อมูลจำลองไม่นับ)
function isSilent(s) {
  const nx = nextUpdate(s);
  return !!nx && nx.diffMin <= -(s.every_min || LIVE.expectedEveryMin);
}

// รอบถัดไปของทั้งระบบ = จากสถานีที่อัปเดตล่าสุด
function nextRound() {
  let best = null;
  STATIONS.forEach(s => { const nx = nextUpdate(s); if (nx && nx.diffMin > -LIVE.expectedEveryMin && (!best || nx.at > best.at)) best = nx; });
  return best ? '~' + hhmm(best.at) + ' น.' : '';
}

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
      STATIONS = clean; recordTrail(); render();
      const nr = nextRound();
      setLiveMsg('ข้อมูลสดจาก ESP32: ' + n + ' สถานี · อ่านล่าสุด ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + (nr ? ' · รอบถัดไป ' + nr : ''), true);
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
    if (clean.length) { STATIONS = clean; recordTrail(); render(); }
  } catch (e) { /* ไม่มีไฟล์ ใช้ข้อมูลตัวอย่างต่อ */ }
}
