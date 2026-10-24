// ---------- แผนที่ ----------
// แผนที่พื้นหลัง, ขอบเขตจังหวัด/อำเภอ, ป้ายชื่อ, รายการอำเภอในแผง และเมนูเลเยอร์

const map = L.map('map', { zoomControl: true, zoomSnap: 0.25, maxBounds: REGION, maxBoundsViscosity: 1.0 });
// แผนที่พื้นหลังหลักใช้ Esri: เซิร์ฟเวอร์ของ OpenStreetMap บล็อกหน้าที่ไม่มี Referer (เปิดไฟล์ตรง ฝังในหน้าอื่น)
// และส่งภาพ "Access blocked" มาแทนแผนที่ จึงเหลือ OSM ไว้เป็นตัวเลือกในเมนูเลเยอร์
// (ภาพ blocked โหลดได้ปกติ จึงสลับให้อัตโนมัติไม่ได้ สลับเองเฉพาะตอนเซิร์ฟเวอร์ไม่ตอบ)
const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, bounds: REGION, attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors'
});
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, bounds: REGION, attribution: '© OpenStreetMap contributors'
});
osm.on('tileerror', () => {
  if (map.hasLayer(osm)) { map.removeLayer(osm); esri.addTo(map).bringToBack(); }
});

const prov = L.geoJSON(LAYERS.prov, {
  style: { color: '#d32f2f', weight: 3, fill: false },
  interactive: false
}).addTo(map);
// เว้นที่ด้านล่างให้แถบเมนู (ความสูงปัจจุบันอยู่ใน --sheet-h ปิดแถบ = 0)
function fitOpts(pad) {
  const sheetH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-h')) || 0;
  return { paddingTopLeft: [pad, pad], paddingBottomRight: [pad, pad + sheetH] };
}
// ถ้าหน้าเปิดตอนแผนที่ยังไม่มีขนาด (เช่นแท็บซ่อนอยู่) ตั้งมุมมองคร่าวๆ ก่อน แล้วค่อยพอดีจังหวัดเมื่อมีขนาด
let fitted = false;
function fitProvince() {
  if (map.getSize().x > 0) { map.fitBounds(prov.getBounds(), fitOpts(20)); fitted = true; }
  else map.setView(prov.getBounds().getCenter(), 9);
}
fitProvince();
// อำเภอที่กำลังโฟกัส (js/district.js) และเลเยอร์มืดรอบอำเภอ
let focusCode = null;
const focusGroup = L.layerGroup().addTo(map);
// ซูมออกได้ไม่เกินกรอบจังหวัดข้างเคียง (ตอนโฟกัสอำเภอ district.js ตั้งเอง)
function syncMinZoom() { if (!focusCode && map.getSize().x > 0) map.setMinZoom(map.getBoundsZoom(REGION, true)); }
syncMinZoom();
map.on('resize', () => { syncMinZoom(); if (!fitted) fitProvince(); });

NEIGHBORS.forEach(n => {
  const icon = L.divIcon({ className: 'dl nb', html: '<span></span>', iconSize: [0, 0] });
  const m = L.marker([n[1], n[2]], { icon: icon, interactive: false, keyboard: false });
  m.on('add', () => { m.getElement().firstChild.textContent = n[0]; });
  m.addTo(map);
});

// ทำให้นอกจังหวัดมืดลง
const world = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
const holes = [];
LAYERS.prov.geometry.coordinates.forEach(poly => holes.push(poly[0].map(p => [p[1], p[0]])));
const mask = L.polygon([world].concat(holes), { stroke: false, fillColor: '#000', fillOpacity: 0.3, interactive: false }).addTo(map);

const colorOf = {};
LAYERS.dist.features
  .map(f => f.properties.code).sort()
  .forEach((code, i) => { colorOf[code] = DISTRICT_COLORS[i % DISTRICT_COLORS.length]; });
const distLayers = {};

function districtTitle(name) { return name.indexOf('เมือง') === 0 ? name : 'อำเภอ' + name; }

// ปิดสีอำเภอได้จากเมนูเลเยอร์ (เหลือแค่เส้นขอบ)
let showDistrictColor = true;
const districts = L.geoJSON(LAYERS.dist, {
  style: f => ({ color: isDark() ? '#aab4b9' : '#444', weight: 1, fillColor: colorOf[f.properties.code], fillOpacity: showDistrictColor ? 0.38 : 0 }),
  onEachFeature: (f, layer) => {
    distLayers[f.properties.code] = layer;
    layer.on('mouseover', () => layer.setStyle({ fillOpacity: showDistrictColor ? 0.62 : 0.15, weight: 2 }));
    layer.on('mouseout', () => districts.resetStyle(layer));
    layer.on('click', () => showDistrict(f.properties.code));
  }
}).addTo(map);

// ป้ายชื่ออำเภอ แสดงเมื่อซูมใกล้พอ
const labelLayer = L.layerGroup();
LAYERS.dist.features.forEach(f => {
  const icon = L.divIcon({ className: 'dl', html: '<span></span>', iconSize: [0, 0] });
  const m = L.marker([f.properties.lat, f.properties.lon], { icon: icon, interactive: false, keyboard: false });
  m.on('add', () => { m.getElement().firstChild.textContent = f.properties.name; });
  labelLayer.addLayer(m);
});
const LABEL_MIN_ZOOM = 9.5;
function syncLabels() {
  const on = map.getZoom() >= LABEL_MIN_ZOOM;
  if (on && !map.hasLayer(labelLayer)) labelLayer.addTo(map);
  if (!on && map.hasLayer(labelLayer)) map.removeLayer(labelLayer);
}
map.on('zoomend', syncLabels);
syncLabels();

// สถานีมีหลายจุด ซูมไกลแสดงแค่จุดสี ซูมใกล้แล้วค่อยแสดงชื่อ
const CHIP_MIN_ZOOM = 10.5;
function syncChips() { map.getContainer().classList.toggle('lowz', map.getZoom() < CHIP_MIN_ZOOM); }
map.on('zoomend', syncChips);
syncChips();

// รายการอำเภอในเมนู "เลือกอำเภอ"
(function () {
  const grid = document.getElementById('dgrid');
  LAYERS.dist.features.slice().sort((a, c) => a.properties.code < c.properties.code ? -1 : 1).forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const sw = document.createElement('i'); sw.style.background = colorOf[f.properties.code];
    const tx = document.createElement('span'); tx.textContent = f.properties.name;
    btn.appendChild(sw); btn.appendChild(tx);
    btn.addEventListener('click', () => showDistrict(f.properties.code));
    grid.appendChild(btn);
  });
})();

const stationLayer = L.layerGroup().addTo(map);
const waterLayer = L.layerGroup().addTo(map);
const ridLayer = L.layerGroup().addTo(map);
// เลเยอร์ว่างไว้เป็นสวิตช์ เปิด = มีสีอำเภอ ปิด = เหลือแค่เส้นขอบ
const colorSwitch = L.layerGroup().addTo(map);
colorSwitch.on('add remove', e => {
  showDistrictColor = e.type === 'add';
  districts.setStyle(f => districts.options.style(f));
  document.querySelectorAll('.dgrid i').forEach(i => { i.style.opacity = showDistrictColor ? '' : '0.25'; });
});
L.control.layers(
  { 'Esri': esri, 'OpenStreetMap': osm },
  { 'อำเภอ': districts, 'สีอำเภอ': colorSwitch, 'เส้นทางน้ำ': waterLayer, 'สถานีกรมชลประทาน': ridLayer, 'สถานี': stationLayer },
  { collapsed: true, position: 'topright' }
).addTo(map);
