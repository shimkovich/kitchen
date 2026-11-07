// Grey-box kitchen viewer. Builds the scene from projects/<p>/kitchen.json
// (format: docs/spec-format.md). Spec units are millimetres, scene units metres.
//
// The camera state lives in the URL hash so a view can be sent as a link and
// reproduced exactly by tools/shot.py. The 3:2 frame drawn over the screen is
// the area tools/shot.py renders at 1536x1024: frameFov() keeps the vertical
// field of view inside that frame equal to SHOT_FOV on every screen shape, so
// what the phone shows inside the frame is what gets rendered.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

const SHOT_FOV = 50;
const FRAME_ASPECT = 1.5;
const mm = v => v / 1000;

const params = new URLSearchParams(location.search);
const PROJECT = params.get('p') || 'example';
const SHOT = params.has('shot');
if (SHOT) document.body.classList.add('shot');

function fail(msg) {
  const e = document.getElementById('error');
  e.textContent = msg;
  e.style.display = 'block';
  window.ERROR = msg;
  window.READY = true;
}
window.addEventListener('error', ev => fail(String(ev.message)));

const BUILTIN_COLORS = {
  walls: '#f2f0ec', floor: '#c9c1b4', fronts: '#8fa3b0', wallFronts: '#e8e4dc',
  worktop: '#55524d', plinth: '#3c3c3c', glass: '#9cc7e8', frame: '#ffffff',
  door: '#a08060', hob: '#111111', sink: '#b8bcc0', hood: '#a0a0a0',
  oven: '#222222', tap: '#999999', box: '#cccccc', backsplash: '#dcd6cc',
};

const DEFAULTS = {
  base: { height: 850, depth: 580, plinth: 100, plinthInset: 50, worktop: 38, overhang: 20 },
  wall: { bottom: 1450, height: 700, depth: 350 },
  tall: { height: 2100, depth: 600 },
};

let spec;
try {
  if (!/^[a-z0-9-]+$/.test(PROJECT)) throw new Error(`bad project id: ${PROJECT}`);
  const r = await fetch(`projects/${PROJECT}/kitchen.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`projects/${PROJECT}/kitchen.json: HTTP ${r.status}`);
  spec = await r.json();
} catch (e) {
  fail(String(e));
  throw e;
}

const D = {};
for (const k of Object.keys(DEFAULTS)) D[k] = { ...DEFAULTS[k], ...(spec.defaults?.[k] || {}) };
const ROOM = spec.room;
const W = ROOM.width, DP = ROOM.depth, H = ROOM.height;
document.getElementById('title').textContent = spec.name || PROJECT;
document.title = spec.name || PROJECT;

// --- renderer, scene, camera ------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(SHOT ? 1 : Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);
const camera = new THREE.PerspectiveCamera(SHOT_FOV, innerWidth / innerHeight, 0.05, 100);
const controls = new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(mm(W) * 0.7 + 1.5, mm(H) + 2.5, mm(DP) + 2.5);
sun.target.position.set(mm(W) / 2, 0, mm(DP) / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 20 });
scene.add(sun, sun.target);

// --- materials and primitives ------------------------------------------------

const matCache = {};
function color(key) {
  return spec.materials?.[key]?.color || BUILTIN_COLORS[key] || BUILTIN_COLORS.box;
}
function mat(key) {
  return matCache[key] ??= new THREE.MeshStandardMaterial({ color: color(key), roughness: 0.85 });
}
const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a2a2a });
const seamMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });

// Axis-aligned box from a min corner and a size, both in mm.
function worldBox(x, y, z, w, h, d, matKey, { edges = true, shadow = true } = {}) {
  const geo = new THREE.BoxGeometry(mm(w), mm(h), mm(d));
  const m = new THREE.Mesh(geo, mat(matKey));
  m.position.set(mm(x + w / 2), mm(y + h / 2), mm(z + d / 2));
  m.castShadow = m.receiveShadow = shadow;
  if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  scene.add(m);
  occluders.push(m);
  return m;
}

// Each wall is a frame: o = corner where runs start, u = along the wall,
// n = into the room. Runs, openings and fixtures are placed in (a, n, y)
// wall-local millimetres and mapped to world here.
const WALLS = {
  back: { o: [0, 0], u: [1, 0], n: [0, 1] },
  front: { o: [0, DP], u: [1, 0], n: [0, -1] },
  left: { o: [0, 0], u: [0, 1], n: [1, 0] },
  right: { o: [W, 0], u: [0, 1], n: [-1, 0] },
};
function wallFrame(name) {
  const f = WALLS[name];
  if (!f) throw new Error(`unknown wall "${name}" (use back, left, right, front)`);
  return f;
}
function toWorld(f, a, n) {
  return [f.o[0] + f.u[0] * a + f.n[0] * n, f.o[1] + f.u[1] * a + f.n[1] * n];
}
function localBox(f, a, w, n0, d, y0, h, matKey, opts) {
  const [x1, z1] = toWorld(f, a, n0);
  const [x2, z2] = toWorld(f, a + w, n0 + d);
  return worldBox(Math.min(x1, x2), y0, Math.min(z1, z2), Math.abs(x2 - x1), h, Math.abs(z2 - z1), matKey, opts);
}
function localLine(f, a1, y1, a2, y2, n) {
  const [x1, z1] = toWorld(f, a1, n);
  const [x2, z2] = toWorld(f, a2, n);
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(mm(x1), mm(y1), mm(z1)), new THREE.Vector3(mm(x2), mm(y2), mm(z2)),
  ]);
  scene.add(new THREE.Line(g, seamMat));
}
// A one-sided plane facing into the room. Seen from outside the room it is
// culled, which is what lets the camera look in through a wall.
function localPlane(f, a, w, y0, h, n, matKey) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(mm(w), mm(h)), mat(matKey));
  const [x, z] = toWorld(f, a + w / 2, n);
  p.position.set(mm(x), mm(y0 + h / 2), mm(z));
  p.rotation.y = Math.atan2(f.n[0], f.n[1]);
  p.receiveShadow = true;
  scene.add(p);
  occluders.push(p);
  return p;
}

// --- labels (dimension mode) --------------------------------------------------

const labels = new THREE.Group();
labels.visible = false;
scene.add(labels);
function label(text, x, y, z) {
  const lines = String(text).split('\n');
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = 'bold 56px -apple-system, system-ui, sans-serif';
  ctx.font = font;
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
  c.width = Math.ceil(tw + 32);
  c.height = 66 * lines.length + 16;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#b00000';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 16, 8 + i * 66));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Fixed on-screen size, drawn over everything; occlusion is decided per
  // label by updateLabelVisibility(), since a depth-tested billboard is cut
  // apart by the cabinet it sits 40 mm in front of.
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false }));
  const k = 0.032 / 66;
  s.scale.set(c.width * k, c.height * k, 1);
  s.position.set(mm(x), mm(y), mm(z));
  s.renderOrder = 10;
  labels.add(s);
}
function localLabel(f, text, a, y, n) {
  const [x, z] = toWorld(f, a, n);
  label(text, x, y, z);
}
// Hide a label when something stands between it and the camera. Walls are
// one-sided, so the raycaster ignores a wall the camera is looking through.
const occluders = [];
const ray = new THREE.Raycaster();
const toLabel = new THREE.Vector3();
function updateLabelVisibility() {
  if (!labels.visible) return;
  for (const s of labels.children) {
    toLabel.subVectors(s.position, camera.position);
    const dist = toLabel.length();
    ray.set(camera.position, toLabel.normalize());
    ray.far = dist - 0.005;
    s.visible = ray.intersectObjects(occluders, false).length === 0;
  }
}

// --- room ---------------------------------------------------------------------

{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(mm(W), mm(DP)), mat(ROOM.floorMaterial || 'floor'));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(mm(W / 2), 0, mm(DP / 2));
  floor.receiveShadow = true;
  scene.add(floor);
  const wallKey = ROOM.wallMaterial || 'walls';
  for (const name of ROOM.walls || ['back', 'left', 'right', 'front']) {
    const f = wallFrame(name);
    const len = f.u[0] ? W : DP;
    localPlane(f, 0, len, 0, H, 0, wallKey);
  }
  // Faces down, so a camera above it looks straight through. Worth switching
  // on for furniture that reaches the ceiling: without it a shot shows bare
  // background above the wall and the render invents a taller room.
  if (ROOM.ceiling) {
    // Unlit: a downward normal catches only the hemisphere light's ground
    // colour, and a grey ceiling in the shot becomes a grey ceiling in the
    // render.
    const m = new THREE.MeshBasicMaterial({ color: color(ROOM.ceilingMaterial || wallKey) });
    const c = new THREE.Mesh(new THREE.PlaneGeometry(mm(W), mm(DP)), m);
    c.rotation.x = Math.PI / 2;
    c.position.set(mm(W / 2), mm(H), mm(DP / 2));
    scene.add(c);
    occluders.push(c);
  }
  label(`ширина ${W}`, W / 2, H - 120, 40);
  label(`глубина ${DP}`, 40, H - 120, DP / 2);
  label(`высота ${H}`, 120, H / 2 + 600, 40);
}

for (const op of spec.openings || []) {
  const f = wallFrame(op.wall);
  if (op.type === 'door') {
    localPlane(f, op.from, op.width, 0, op.height, 2, op.material || 'door');
  } else {
    localPlane(f, op.from, op.width, op.bottom, op.height, 2, 'frame');
    localPlane(f, op.from + 50, op.width - 100, op.bottom + 50, op.height - 100, 4, op.material || 'glass');
  }
  const kind = op.type === 'door' ? 'дверь' : 'окно';
  const bottom = op.type === 'door' ? '' : `, низ ${op.bottom}`;
  localLabel(f, `${kind} ${op.width}×${op.height}${bottom}\nот угла ${op.from}`,
    op.from + op.width / 2, (op.bottom || 0) + op.height / 2, 60);
}

// --- runs ---------------------------------------------------------------------

// Front divisions: `doors` splits the width evenly; the height is split either
// by `rows`, a list of explicit heights bottom-up that must fill the front
// area, or by `drawers` into equal parts.
function fronts(f, a, w, n, y0, h, m) {
  const doors = m.doors ?? 1;
  for (let k = 1; k < doors; k++) localLine(f, a + (k * w) / doors, y0, a + (k * w) / doors, y0 + h, n);
  if (m.rows) {
    const sum = m.rows.reduce((s, v) => s + v, 0);
    if (Math.abs(sum - h) > 1) throw new Error(`rows ${m.rows.join('+')} = ${sum}, front area is ${h}`);
    let y = y0;
    for (const r of m.rows) {
      localLabel(f, String(r), a + 60, y + r / 2, n + 39);
      y += r;
      if (y < y0 + h - 1) localLine(f, a, y, a + w, y, n);
    }
  } else {
    const drawers = m.drawers ?? 0;
    for (let k = 1; k < drawers; k++) localLine(f, a, y0 + (k * h) / drawers, a + w, y0 + (k * h) / drawers, n);
  }
}

function oven(f, a, w, n, bottom) {
  const ow = Math.min(w - 20, 595);
  localBox(f, a + (w - ow) / 2, ow, n, 3, bottom, 595, 'oven');
}

function buildBaseRun(run) {
  const f = wallFrame(run.wall);
  const B = D.base, T = D.tall;
  const bodyTop = B.height - B.worktop;
  const topKey = run.worktop || 'worktop';
  let a = run.from || 0;
  let segStart = null;
  const closeSeg = end => {
    if (segStart !== null && end > segStart) {
      localBox(f, segStart, end - segStart, 0, B.depth + B.overhang, bodyTop, B.worktop, topKey);
    }
    segStart = null;
  };
  for (const m of run.modules) {
    if (m.gap != null) { closeSeg(a); a += m.gap; continue; }
    const w = m.w;
    if (m.tall) {
      closeSeg(a);
      const th = m.h ?? T.height, td = m.d ?? T.depth, rail = m.rail ?? 0;
      localBox(f, a + 2, w - 4, 0, td - B.plinthInset, 0, B.plinth, 'plinth');
      localBox(f, a + 2, w - 4, 0, td, B.plinth, th - B.plinth, m.front || run.tallFront || run.front || 'fronts');
      if (rail) localLine(f, a + 2, th - rail, a + w - 2, th - rail, td + 1);
      fronts(f, a + 2, w - 4, td + 1, B.plinth, th - B.plinth - rail, m);
      if (m.fixture === 'oven') oven(f, a, w, td, m.fixtureBottom ?? 850);
      localLabel(f, `${m.label ? m.label + '\n' : ''}${w}`, a + w / 2, th - 250, td + 40);
    } else {
      const d = m.d ?? B.depth;
      localBox(f, a + 2, w - 4, 0, d - B.plinthInset, 0, B.plinth, 'plinth');
      localBox(f, a + 2, w - 4, 0, d, B.plinth, bodyTop - B.plinth, m.front || run.front || 'fronts');
      fronts(f, a + 2, w - 4, d + 1, B.plinth, bodyTop - B.plinth, m);
      if (m.worktop === false) closeSeg(a);
      else if (segStart === null) segStart = a;
      const top = B.height, depth = B.depth + B.overhang;
      if (m.fixture === 'sink') {
        const sw = Math.min(w - 120, 600), sd = 420;
        localBox(f, a + (w - sw) / 2, sw, depth - 80 - sd, sd, top, 3, 'sink', { shadow: false });
        localBox(f, a + w / 2 - 15, 30, depth - 80 - sd - 70, 30, top, 260, 'tap');
      } else if (m.fixture === 'hob') {
        const hw = Math.min(w - 40, 590), hd = 510;
        localBox(f, a + (w - hw) / 2, hw, (depth - hd) / 2, hd, top, 4, 'hob', { shadow: false });
      } else if (m.fixture === 'oven') {
        oven(f, a, w, d, m.fixtureBottom ?? bodyTop - 600);
      }
      if (m.worktop === false) closeSeg(a + w);
      localLabel(f, `${m.label ? m.label + '\n' : ''}${w}`, a + w / 2, B.plinth + (bodyTop - B.plinth) / 2, d + 40);
    }
    a += w;
  }
  closeSeg(a);
}

function buildWallRun(run) {
  const f = wallFrame(run.wall);
  const Wl = D.wall;
  let a = run.from || 0;
  for (const m of run.modules) {
    if (m.gap != null) { a += m.gap; continue; }
    const w = m.w;
    if (m.fixture === 'hood') {
      const bottom = m.bottom ?? Wl.bottom + 100, h = m.h ?? 600, d = m.d ?? 350;
      localBox(f, a, w, 0, d, bottom, h, m.material || 'hood');
      localLabel(f, `${m.label || 'вытяжка'}\n${w}, низ ${bottom}`, a + w / 2, bottom + h / 2, d + 40);
    } else {
      const bottom = m.bottom ?? run.bottom ?? Wl.bottom, h = m.h ?? run.height ?? Wl.height, d = m.d ?? run.depth ?? Wl.depth;
      localBox(f, a + 2, w - 4, 0, d, bottom, h, m.front || run.front || 'wallFronts');
      fronts(f, a + 2, w - 4, d + 1, bottom, h, m);
      localLabel(f, `${m.label ? m.label + '\n' : ''}${w}`, a + w / 2, bottom + h / 2, d + 40);
    }
    a += w;
  }
}

for (const run of spec.runs || []) {
  if ((run.level || 'base') === 'wall') buildWallRun(run);
  else buildBaseRun(run);
}

for (const b of spec.boxes || []) {
  worldBox(b.x, b.y, b.z, b.w, b.h, b.d, b.material || 'box');
  if (b.label) label(b.label, b.x + b.w / 2, b.y + b.h + 80, b.z + b.d / 2);
}

// --- camera state <-> URL hash -------------------------------------------------

function defaultView() {
  camera.position.set(mm(W * 0.85), 1.65, mm(DP) + 1.4);
  controls.target.set(mm(W * 0.45), 1.0, mm(DP * 0.3));
}
function topView() {
  const span = Math.max(W, DP);
  camera.position.set(mm(W / 2), mm(span) * 1.9, mm(DP / 2) + 0.001);
  controls.target.set(mm(W / 2), 0, mm(DP / 2));
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const cam = (h.get('cam') || '').split(',').map(Number);
  if (cam.length === 6 && cam.every(Number.isFinite)) {
    camera.position.set(mm(cam[0]), mm(cam[1]), mm(cam[2]));
    controls.target.set(mm(cam[3]), mm(cam[4]), mm(cam[5]));
  } else {
    defaultView();
  }
  setDims(!SHOT && h.get('dims') === '1');
}
function hashString() {
  const p = camera.position, t = controls.target;
  const cam = [p.x, p.y, p.z, t.x, t.y, t.z].map(v => Math.round(v * 1000)).join(',');
  return `#cam=${cam}${labels.visible ? '&dims=1' : ''}`;
}
let hashTimer = 0;
function scheduleHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => history.replaceState(null, '', hashString()), 250);
}
function shareUrl() {
  return `${location.origin}${location.pathname}?p=${PROJECT}${hashString()}`;
}

// --- frame overlay and fov ---------------------------------------------------

const frameEl = document.createElement('div');
frameEl.id = 'frame';
Object.assign(frameEl.style, {
  position: 'absolute', boxShadow: '0 0 0 9999px rgba(0,0,0,0.28)',
  outline: '1px solid rgba(255,255,255,0.9)', pointerEvents: 'none',
});
document.getElementById('ui').prepend(frameEl);

function frameFov(sw, sh) {
  const fh = Math.min(sh, sw / FRAME_ASPECT);
  const fw = fh * FRAME_ASPECT;
  Object.assign(frameEl.style, {
    left: `${(sw - fw) / 2}px`, top: `${(sh - fh) / 2}px`, width: `${fw}px`, height: `${fh}px`,
  });
  const t = Math.tan(THREE.MathUtils.degToRad(SHOT_FOV / 2)) * (sh / fh);
  return THREE.MathUtils.radToDeg(2 * Math.atan(t));
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = frameFov(innerWidth, innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

// --- UI -------------------------------------------------------------------------

const btnDims = document.getElementById('btn-dims');
function setDims(on) {
  labels.visible = on;
  btnDims.classList.toggle('on', on);
}
let toastTimer = 0;
function toast(text, ms = 2500) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, ms);
}
btnDims.onclick = () => { setDims(!labels.visible); scheduleHash(); };
document.getElementById('btn-top').onclick = () => { topView(); controls.update(); scheduleHash(); };
document.getElementById('btn-reset').onclick = () => { defaultView(); controls.update(); scheduleHash(); };
document.getElementById('btn-link').onclick = async () => {
  const url = shareUrl();
  history.replaceState(null, '', hashString());
  try {
    await navigator.clipboard.writeText(url);
    toast('Ссылка скопирована — вставь её в чат');
  } catch {
    toast(url, 15000);
  }
};

controls.addEventListener('change', scheduleHash);
addEventListener('hashchange', () => { readHash(); controls.update(); });
addEventListener('resize', resize);

readHash();
controls.update();
resize();
renderer.setAnimationLoop(() => {
  updateLabelVisibility();
  renderer.render(scene, camera);
});
requestAnimationFrame(() => requestAnimationFrame(() => { window.READY = true; }));
