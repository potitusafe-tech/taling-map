// ---------- ความปลอดภัยพื้นฐาน ----------
// ข้อมูลสถานีที่มาจากไฟล์ (data/stations.js หรือ stations.json) ผ่านการตรวจที่นี่ก่อนใช้งานทุกครั้ง:
// เก็บเฉพาะ field ที่รู้จัก, ตัวเลขต้องเป็นตัวเลขจริงในช่วงที่สมเหตุสมผล, ข้อความถูกตัดความยาวและตัดอักขระควบคุม
// ส่วนแสดงผลใส่ข้อความด้วย textContent เสมอ จึงไม่มีข้อความจากภายนอกถูกตีความเป็น HTML

const MAX_STATIONS = 500;

function safeText(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max || 80);
}

function safeNum(v, lo, hi) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(hi, Math.max(lo, n));
}

function sanitizeStation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = safeText(raw.id, 32);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const lat = safeNum(raw.lat, -90, 90), lon = safeNum(raw.lon, -180, 180);
  if (lat === undefined || lon === undefined) return null;
  // ต้องอยู่ในกรอบฉะเชิงเทราและจังหวัดข้างเคียง ไม่งั้นทิ้ง
  if (lat < 12.2 || lat > 14.6 || lon < 100.25 || lon > 102.95) return null;
  const level = safeNum(raw.level_cm, -50, 500);
  if (level === undefined) return null;
  const s = {
    id: id,
    name: safeText(raw.name, 60) || id,
    lat: lat, lon: lon,
    level_cm: level,
    min_cm: safeNum(raw.min_cm, -50, 500),
    time: safeText(raw.time, 40),
    temp_c: safeNum(raw.temp_c, -20, 70),
    rh: safeNum(raw.rh, 0, 100),
    pres_hpa: safeNum(raw.pres_hpa, 800, 1100),
    batt_v: safeNum(raw.batt_v, 0, 20),
    sample: raw.sample === true
  };
  // สกรู L1-L3 ที่ ESP32 อ่านได้จริง (true = เปียก) ไม่ส่งมา = ใช้ระดับน้ำคำนวณแทน
  ['l1', 'l2', 'l3'].forEach(k => { if (typeof raw[k] === 'boolean') s[k] = raw[k]; });
  const bank = safeNum(raw.bank, 1, 5);
  if (bank !== undefined) s.bank = Math.round(bank);
  return s;
}

function sanitizeStations(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list.slice(0, MAX_STATIONS)) {
    const s = sanitizeStation(raw);
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}
