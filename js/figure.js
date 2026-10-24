// ---------- ภาพตัดขวางตลิ่ง ----------
// เสา แขน เซนเซอร์ สกรู L1-L3 และน้ำที่ขยับเป็นคลื่นตามระดับของสถานี (ค่าคงที่อยู่ใน js/config.js)

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
// สกรูเปียกไหม: ใช้ค่าที่ ESP32 อ่านจริง (l1/l2/l3) ถ้ามี ไม่งั้นคำนวณจากระดับน้ำ
function screwWet(s, sc) {
  const real = s[sc.id.toLowerCase()];
  return typeof real === 'boolean' ? real : Number(s.level_cm) >= sc.cm;
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
      const y = levelY(sc.cm), wet = screwWet(s, sc);
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
