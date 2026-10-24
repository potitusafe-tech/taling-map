// ---------- กราฟระดับน้ำ ----------
// จำเฉพาะในหน้าเว็บที่เปิดอยู่ ไม่เก็บลงฐานข้อมูล: ค่าล่าสุดเปลี่ยน → เพิ่มจุดใหม่แล้วลากเส้นต่อ

const TRAIL = {};
const TRAIL_MAX = 300;
function recordTrail() {
  STATIONS.forEach(s => {
    if (s.sample || !Number.isFinite(Number(s.level_cm))) return;
    const pts = TRAIL[s.id] || (TRAIL[s.id] = []);
    const key = (s.time || '') + '|' + s.level_cm;
    if (pts.length && pts[pts.length - 1].key === key) return;
    const t = parseStationTime(s.time) || new Date();
    pts.push({ key: key, t: t, l: Number(s.level_cm) });
    if (pts.length > TRAIL_MAX) pts.shift();
  });
}

function trendFigure(s, st) {
  const pts = TRAIL[s.id] || [];
  const box = document.createElement('div'); box.className = 'trend';
  const head = document.createElement('div'); head.className = 'trend-head';
  head.textContent = 'กราฟระดับน้ำตั้งแต่เปิดหน้านี้';
  const cnt = document.createElement('span'); cnt.textContent = pts.length + ' จุด';
  head.appendChild(cnt); box.appendChild(head);
  if (!pts.length) {
    const n = document.createElement('div'); n.className = 'note'; n.style.marginTop = '2px';
    n.textContent = s.sample ? 'สถานีนี้ยังเป็นข้อมูลจำลอง ไม่มีกราฟ' : 'รอข้อมูลจากบอร์ด…';
    box.appendChild(n); return box;
  }
  // พื้นที่วาด 600x170: ซ้าย 46 (ตัวเลขแกน y) ล่าง 26 (เวลา)
  const W = 600, H = 170, L = 46, R = 12, T = 10, B = 26;
  const maxL = Math.max(100, ...pts.map(p => p.l)) , minL = Math.min(0, ...pts.map(p => p.l));
  const t0 = pts[0].t.getTime(), t1 = pts[pts.length - 1].t.getTime();
  const span = Math.max(t1 - t0, 60000);
  const X = t => pts.length === 1 ? (L + W - R) / 2 : L + (t - t0) / span * (W - L - R);
  const Y = l => T + (maxL - l) / (maxL - minL) * (H - T - B);
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="กราฟระดับน้ำ ' + pts.length + ' จุด">';
  [0, 25, 50, 75, 100].forEach(v => {
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--line)" stroke-width="1"/>' +
           '<text x="' + (L - 6) + '" y="' + (Y(v) + 5) + '" text-anchor="end" font-size="14" style="fill:var(--muted)">' + v + '</text>';
  });
  THRESHOLDS.forEach(t => {
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(t.cm) + '" y2="' + Y(t.cm) + '" stroke="' + t.color + '" stroke-width="1.5" stroke-dasharray="6 5" opacity=".8"/>';
  });
  const line = pts.map(p => X(p.t.getTime()).toFixed(1) + ',' + Y(p.l).toFixed(1)).join(' ');
  if (pts.length > 1) svg += '<polyline points="' + line + '" fill="none" stroke="var(--link)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
  pts.forEach((p, i) => {
    const last = i === pts.length - 1;
    svg += '<circle cx="' + X(p.t.getTime()).toFixed(1) + '" cy="' + Y(p.l).toFixed(1) + '" r="' + (last ? 6 : 3.5) + '" fill="' + statusOf(p.l).color + '" stroke="var(--bg)" stroke-width="' + (last ? 2.5 : 1.5) + '"><title>' + hhmm(p.t) + ' · ' + p.l.toFixed(1) + ' cm</title></circle>';
  });
  svg += '<text x="' + L + '" y="' + (H - 6) + '" font-size="14" style="fill:var(--muted)">' + hhmm(pts[0].t) + '</text>';
  if (pts.length > 1) svg += '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" font-size="14" style="fill:var(--muted)">' + hhmm(pts[pts.length - 1].t) + '</text>';
  svg += '</svg>';
  const fig = document.createElement('div'); fig.innerHTML = svg; box.appendChild(fig.firstChild);
  if (pts.length > 1) {
    const d = pts[pts.length - 1].l - pts[pts.length - 2].l;
    const n = document.createElement('div'); n.className = 'trend-foot';
    n.textContent = (d > 0.5 ? '▲ ขึ้น ' : d < -0.5 ? '▼ ลง ' : '● คงที่ ') + Math.abs(d).toFixed(1) + ' cm จากจุดก่อน · ต่ำสุด ' +
      Math.min(...pts.map(p => p.l)).toFixed(1) + ' · สูงสุด ' + Math.max(...pts.map(p => p.l)).toFixed(1) + ' cm';
    box.appendChild(n);
  } else {
    const n = document.createElement('div'); n.className = 'trend-foot';
    n.textContent = 'จุดแรก รอข้อมูลรอบถัดไปเพื่อลากเส้นต่อ';
    box.appendChild(n);
  }
  return box;
}
