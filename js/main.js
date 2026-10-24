// ---------- เริ่มทำงาน ----------
// ปุ่มแผง, สลับโหมดมืด/สว่าง แล้ววาดทุกอย่างครั้งแรก

// ---------- แถบเมนูด้านล่าง ----------
// 3 ระดับ: peek (เห็นแค่ชื่อกับสถานะ) / half (ครึ่งจอ) / full; ลากขึ้นลงที่ขีดหรือหัวแถบ, กด = สลับ peek ↔ half
(function () {
  const sheet = document.getElementById('sheet');
  const grab = document.getElementById('grab');
  const head = document.getElementById('sheet-head');
  const root = document.documentElement;
  const heights = () => {
    const peek = grab.offsetHeight + head.offsetHeight + 2;
    const full = Math.max(peek, window.innerHeight - 64);
    return { peek: peek, half: Math.min(full, Math.max(peek + 160, Math.round(window.innerHeight * 0.45))), full: full };
  };
  let state = 'peek';
  const setH = px => root.style.setProperty('--sheet-h', Math.round(px) + 'px');
  function setState(s) {
    state = s;
    sheet.dataset.state = s;
    grab.setAttribute('aria-expanded', String(s !== 'peek'));
    setH(heights()[s]);
  }
  window.setSheet = setState;

  let startY = 0, startH = 0, moved = false, lastY = 0, lastT = 0, vel = 0;
  function down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('a, button:not(#grab)')) return;
    startY = lastY = e.clientY; lastT = e.timeStamp; vel = 0; moved = false;
    startH = sheet.getBoundingClientRect().height;
    e.preventDefault();   // ไม่ให้เมาส์ลากแล้วไปเลือกข้อความในแถบ
    e.currentTarget.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  }
  function move(e) {
    if (!sheet.classList.contains('dragging')) return;
    const dy = startY - e.clientY;
    if (Math.abs(dy) > 4) moved = true;
    const h = heights();
    setH(Math.min(h.full, Math.max(h.peek, startH + dy)));
    if (e.timeStamp > lastT) vel = (lastY - e.clientY) / (e.timeStamp - lastT);   // px/ms ขึ้น = บวก
    lastY = e.clientY; lastT = e.timeStamp;
  }
  function up() {
    if (!sheet.classList.contains('dragging')) return;
    sheet.classList.remove('dragging');
    if (!moved) { setState(state === 'peek' ? 'half' : 'peek'); return; }
    const h = heights(), cur = sheet.getBoundingClientRect().height;
    const order = ['peek', 'half', 'full'];
    if (Math.abs(vel) > 0.5) {   // ปัดเร็ว = ไปขั้นถัดไปตามทิศ
      setState(vel > 0 ? (order.find(k => h[k] > cur + 1) || 'full') : (order.slice().reverse().find(k => h[k] < cur - 1) || 'peek'));
      return;
    }
    setState(order.reduce((a, k) => Math.abs(h[k] - cur) < Math.abs(h[a] - cur) ? k : a, 'peek'));
  }
  [grab, head].forEach(el => {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  grab.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setState(state === 'peek' ? 'half' : 'peek'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setState(state === 'peek' ? 'half' : 'full'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setState(state === 'full' ? 'half' : 'peek'); }
  });
  // กดสถานีหรืออำเภอในแถบ = ย่อแถบลงก่อน ให้เห็นแผนที่ที่ซูมไป
  document.getElementById('sheet-body').addEventListener('click', e => {
    if (e.target.closest('.st, .grp, .dgrid button')) setState('peek');
  }, true);
  window.addEventListener('resize', () => setState(state));
  // หัวแถบสูงขึ้นเมื่อข้อความสถานะยาว/ขึ้นบรรทัดใหม่ ต้องคำนวณความสูงตอนย่อใหม่
  if (window.ResizeObserver) new ResizeObserver(() => { if (!sheet.classList.contains('dragging')) setState(state); }).observe(head);
  setState('peek');
})();

// ---------- ติดต่อฝ่ายช่วยเหลือ ----------
(function () {
  const btn = document.getElementById('support-btn');
  const box = document.getElementById('support');
  const copy = document.getElementById('support-copy');
  const email = document.getElementById('support-email').textContent.trim();
  const show = open => { box.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) copy.focus(); else btn.focus(); };
  btn.addEventListener('click', () => show(box.hidden));
  document.getElementById('support-close').addEventListener('click', () => show(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) show(false); });
  copy.addEventListener('click', () => {
    const done = () => { copy.textContent = 'คัดลอกแล้ว'; setTimeout(() => { copy.textContent = 'คัดลอก'; }, 1500); };
    const fallback = () => {   // คลิปบอร์ดใช้ไม่ได้ (เช่นเปิดจากไฟล์) ให้เลือกข้อความไว้แทน
      const r = document.createRange(); r.selectNodeContents(document.getElementById('support-email'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); copy.textContent = 'กด Ctrl+C';
    };
    if (navigator.clipboard) navigator.clipboard.writeText(email).then(done, fallback); else fallback();
  });
})();

// ---------- โหมดมืด/สว่าง ----------
// อัตโนมัติ = ตามระบบเครื่อง, เลือกเองแล้วจำไว้ในเบราว์เซอร์นี้
function applyTheme() {
  const d = isDark();
  if (!map.hasLayer(osm) && !map.hasLayer(esri)) esri.addTo(map).bringToBack();
  mask.setStyle({ fillOpacity: d ? 0.45 : 0.3 });
  districts.setStyle(f => districts.options.style(f));
  render();
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === (document.documentElement.dataset.theme || 'auto'))));
}
function setTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
  applyTheme();
}
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
darkMQ.addEventListener('change', () => { if (!document.documentElement.dataset.theme) applyTheme(); });

STATIONS = sanitizeStations(STATIONS);
renderLegend();
applyTheme();
loadLive();
setInterval(loadLive, Math.max(10, Number(LIVE.refreshSec) || 30) * 1000);
