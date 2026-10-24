// ---------- เริ่มทำงาน ----------
// ปุ่มแผง, สลับโหมดมืด/สว่าง แล้ววาดทุกอย่างครั้งแรก

// ---------- ปิด/เปิดแท็บ ----------
document.getElementById('close').onclick = () => { document.body.classList.add('closed'); };
document.getElementById('open').onclick = () => { document.body.classList.remove('closed'); };

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
