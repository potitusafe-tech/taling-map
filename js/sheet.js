// ---------- เมนูและแถบด้านล่าง ----------
// ปุ่ม "เมนู" มุมซ้ายล่าง → เลือกว่าจะดูอะไร (ภาพรวม / เลือกอำเภอ / อื่นๆ) → แถบล่างเปิดหน้านั้น
// แถบมี 3 ระดับ: peek (เห็นแค่หัว) / half / full ลากที่ขีดหรือหัวแถบ, × = ปิด, ← = ย้อนกลับ
// ความสูงแถบเก็บใน --sheet-h ให้ CSS (ปุ่มลอย เครดิตแผนที่) และ fitOpts() ใน map.js ใช้

const VIEW_TITLES = { overview: 'ภาพรวมสถานะ', districts: 'เลือกอำเภอ', district: 'อำเภอ', more: 'อื่นๆ' };
let setSheet, openView, closeSheet;

(function () {
  const $ = id => document.getElementById(id);
  const sheet = $('sheet'), grab = $('grab'), head = $('sheet-head'), body = $('sheet-body');
  const title = $('sheet-title'), back = $('sheet-back');
  const menuBtn = $('menu-btn'), menu = $('menu');
  const root = document.documentElement;
  let state = 'closed', backFn = null;

  const heights = () => {
    const peek = grab.offsetHeight + head.offsetHeight + 2;
    const full = Math.max(peek, window.innerHeight - 64);
    return { peek: peek, half: Math.min(full, Math.max(peek + 180, Math.round(window.innerHeight * 0.45))), full: full };
  };
  const setH = px => root.style.setProperty('--sheet-h', Math.round(px) + 'px');

  setSheet = function (s) {
    state = s;
    sheet.hidden = s === 'closed';
    sheet.dataset.state = s;
    grab.setAttribute('aria-expanded', String(s === 'half' || s === 'full'));
    setH(s === 'closed' ? 0 : heights()[s]);
  };

  openView = function (view, opt) {
    opt = opt || {};
    sheet.querySelectorAll('.view').forEach(v => { v.hidden = v.dataset.view !== view; });
    title.textContent = opt.title || VIEW_TITLES[view];
    backFn = opt.back || null;
    back.hidden = !backFn;
    body.scrollTop = 0;
    closeMenu();
    setSheet(state === 'full' ? 'full' : 'half');
  };

  closeSheet = function () {
    setSheet('closed');
    clearDistrictFocus();
    menuBtn.focus();
  };

  back.addEventListener('click', () => { if (backFn) backFn(); });
  $('sheet-close').addEventListener('click', closeSheet);

  // ---------- เมนูเลือกสิ่งที่จะดู ----------
  function openMenu() {
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    menu.querySelector('[role="menuitem"]').focus();
  }
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', () => { if (menu.hidden) openMenu(); else closeMenu(); });
  menu.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.view !== 'district') clearDistrictFocus();
    openView(b.dataset.view);
  }));
  menu.addEventListener('keydown', e => {   // ลูกศรขึ้นลงเลื่อนระหว่างตัวเลือก
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); menuBtn.focus(); } });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  });

  // ---------- ลากแถบขึ้นลง ----------
  let startY = 0, startH = 0, moved = false, lastY = 0, lastT = 0, vel = 0;
  function down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('a, button')) return;
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
    if (!moved) { setSheet(state === 'peek' ? 'half' : 'peek'); return; }
    const h = heights(), cur = sheet.getBoundingClientRect().height;
    const order = ['peek', 'half', 'full'];
    if (Math.abs(vel) > 0.5) {   // ปัดเร็ว = ไปขั้นถัดไปตามทิศ
      setSheet(vel > 0 ? (order.find(k => h[k] > cur + 1) || 'full') : (order.slice().reverse().find(k => h[k] < cur - 1) || 'peek'));
      return;
    }
    setSheet(order.reduce((a, k) => Math.abs(h[k] - cur) < Math.abs(h[a] - cur) ? k : a, 'peek'));
  }
  [grab, head].forEach(el => {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  grab.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheet(state === 'peek' ? 'half' : 'peek'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSheet(state === 'peek' ? 'half' : 'full'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSheet(state === 'full' ? 'half' : 'peek'); }
  });

  // กดสถานีในแถบ = ย่อแถบลงเหลือหัว ให้เห็นแผนที่กับกล่องรายละเอียด
  body.addEventListener('click', e => { if (e.target.closest('.st')) setSheet('peek'); }, true);
  window.addEventListener('resize', () => { if (state !== 'closed') setSheet(state); });
  if (window.ResizeObserver) new ResizeObserver(() => {
    if (state !== 'closed' && !sheet.classList.contains('dragging')) setSheet(state);
  }).observe(head);
  setSheet('closed');
})();
