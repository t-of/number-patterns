// 画面と操作・描画。中身（数の計算・つまみの範囲・保存と URL の読み書き）は patterns.js にある。
import {
  FIGS, FIG, PRIME_N, MULT_N, isPrimeTable, digitRoot, ulam, collatzPath, collatzNext, collatzTree, triPos,
  starLoops, starPoint, mandelEscape, MB_START, MB_SPAN, MB_MAX_ZOOM, MB_FACTOR, kochPoints, epicyclePeriod,
  epicycleJoints, chordsPeriod, knobMin, knobMax, randomParams, readState, fromSearch, shareUrl, summary,
} from './patterns.js';

// localStorage はほかのアプリと共有される（同じ t-of.github.io のため）。
// キーは必ず 'number-patterns.' で始める。
const STORE = 'number-patterns.';

function loadRaw(key) {
  try { return localStorage.getItem(STORE + key); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch { /* 保存できなくても遊べる */ }
}

WebAppKit.init({ title: '数の模様', text: '素数のらせん・星形・マンデルブロ集合など、数と円が描く模様を切り替えて眺める。つまみで数を変えると、模様がその場で形を変える。' });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ---- ここからアプリ本体 ----

const $ = (id) => document.getElementById(id);

const state = readState(loadRaw('state'));
const store = () => save('state', state);
// 図ごとの今の値。まだ触っていない図は既定（state.p には触った図だけ入れる）
const vals = Object.fromEntries(FIGS.map((f) => [f.id, (state.p[f.id] || f.def).slice()]));
let view = { ...MB_START };   // マンデルブロ集合の拡大の位置（保存しない）
// URL の ?f=&p= は保存した値より優先する
const shared = fromSearch(location.search);
if (shared) {
  state.fig = shared.fig;
  vals[shared.fig] = shared.p.slice();
  if (shared.view) view = { ...shared.view };
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---- 音 ----
// 音声ファイルは使わず Web Audio で作る。やわらかく小さく、描いている間は鳴らしっぱなしにしない

// iPhone のマナーモードでも鳴らす（Safari 16.4 以降）。
// 'playback' にすると音楽アプリの曲が止まるので、アプリの音がオンのときだけにする。
function setAudioSession(on) {
  try { if (navigator.audioSession) navigator.audioSession.type = on ? 'playback' : 'auto'; } catch { /* 対応していない */ }
}
setAudioSession(state.sound);

let actxAudio = null, master = null;
// ブラウザは触る前の音を止めるので、AudioContext は最初に触ったときに作る
function unlockAudio() {
  if (!state.sound) return;
  setAudioSession(true);
  if (!actxAudio) {
    try { actxAudio = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = actxAudio.createGain();
    master.gain.value = 0.5;
    master.connect(actxAudio.destination);
  }
  if (actxAudio.state === 'suspended') actxAudio.resume();
}
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

// 短い音。notes = [[周波数, 開始の遅れ(秒)], …]。slide を付けると周波数をその倍率まで動かす。
// 同じ種類 (kind) の音は gap 秒に 1 回まで（押しっぱなし・連打で重ねない）
const lastAt = {};
function tone(kind, notes, { dur = 0.1, type = 'sine', gain = 0.06, gap = 0.04, slide = 0 } = {}) {
  if (!state.sound || !actxAudio) return;
  const now = actxAudio.currentTime;
  if (now - (lastAt[kind] ?? -1) < gap) return;
  lastAt[kind] = now;
  for (const [f, at = 0] of notes) {
    const t = now + at;
    const o = actxAudio.createOscillator(), g = actxAudio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
}
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const sfx = {
  pop: () => tone('pop', [[620]], { dur: 0.07, type: 'triangle', gain: 0.07 }),
  tick: (t) => tone('tick', [[1100 + 700 * t]], { dur: 0.025, gain: 0.025, gap: 0.06 }),
  done: () => tone('done', [[523.25], [783.99, 0.02]], { dur: 0.6, gain: 0.04 }),
  zoom: () => tone('zoom', [[480]], { dur: 0.14, gain: 0.05, slide: 2.6 }),
  full: () => tone('full', [[170]], { dur: 0.12, type: 'triangle', gain: 0.08 }),
  random: () => tone('random', [0, 0.07, 0.14].map((at) => [440 * 2 ** (PENTA[Math.floor(Math.random() * PENTA.length)] / 12), at]),
    { dur: 0.1, type: 'triangle', gain: 0.05 }),
};

function renderSound() {
  $('soundBtn').setAttribute('aria-pressed', String(state.sound));
  $('soundBtn').setAttribute('aria-label', state.sound ? '音: オン' : '音: オフ');
  $('soundIcon').innerHTML = state.sound
    ? '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18.3 6a8.5 8.5 0 0 1 0 12"/>'
    : '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9.5 5 5m0-5-5 5"/>';
}
$('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  store();
  setAudioSession(state.sound);
  renderSound();
  if (state.sound) { unlockAudio(); sfx.pop(); }
});
renderSound();

// ---- 描く ----
// 描く場所は正方形。座標は「中心 0、半径 1」で考え、X() で画面の点にする（どの端末でも同じ絵）
const art = $('art'), over = $('over');
const ctx = art.getContext('2d'), octx = over.getContext('2d');
let S = 0, DPR = 1;
const X = (u) => S / 2 + u * S * 0.47;

const BG = '#0b0e0d';
const INK = '#f1ecd9';
const MINT = '#7ee0c3';
const RED = '#ff6b5e', BLUE = '#5b9dff';
// 数字根 1〜9 の色（隣どうしで色合いが大きく変わる並び）
const ROOT = ['', '#ff6b5e', '#ffa94d', '#ffe066', '#a9e34b', '#63e6be', '#4dabf7', '#9775fa', '#f783ac', '#e9ecef'];

// 図の描き方 = 「描く物の数 count」と「from〜to 番目を描く draw」。描く様子は count を時間で割って少しずつ描く。
// base は最初に 1 回（点や円の下絵）、overlay は別の Canvas に毎フレーム（円運動の腕）

// 点を並べる。xs, ys は画面の点、colors は 1 色か点ごとの色、size は点の大きさ（画面の点）
function dots(xs, ys, colors, size, round = false) {
  return {
    count: xs.length,
    draw(c, from, to) {
      if (typeof colors === 'string') c.fillStyle = colors;
      const h = size / 2;
      for (let i = from; i < to; i++) {
        if (typeof colors !== 'string') c.fillStyle = colors[i];
        if (round) { c.beginPath(); c.arc(xs[i], ys[i], h, 0, 7); c.fill(); }
        else c.fillRect(xs[i] - h, ys[i] - h, size, size);
      }
    },
  };
}

const ulamCache = new Map();
const ulamOf = (N) => ulamCache.get(N) || ulamCache.set(N, ulam(N)).get(N);

// 1〜N を並べ方 layout（0 うずまき / 1 らせん / 2 横に W 個）で置き、pick(n) が色を返した数だけ点にする
function numberDots(N, layout, W, pick, polarSize) {
  const xs = [], ys = [], cs = [];
  let size;
  if (layout === 0) {
    const u = ulamOf(N), cell = S / Math.ceil(Math.sqrt(N));
    size = Math.max(1, cell * 0.8);
    for (let n = 1; n <= N; n++) {
      const col = pick(n);
      if (col) { xs.push(S / 2 + u.xs[n - 1] * cell); ys.push(S / 2 + u.ys[n - 1] * cell); cs.push(col); }
    }
  } else if (layout === 1) {
    size = polarSize * DPR;
    for (let n = 1; n <= N; n++) {
      const col = pick(n);
      if (col) { xs.push(X(n / N * Math.cos(n))); ys.push(X(n / N * Math.sin(n))); cs.push(col); }
    }
  } else {
    const cell = S / W;
    size = Math.max(1, cell * 0.72);
    for (let n = 1; n <= Math.min(N, W * W); n++) {   // 描く場所に入る W 行まで
      const col = pick(n);
      if (col) { xs.push(((n - 1) % W + 0.5) * cell); ys.push((Math.floor((n - 1) / W) + 0.5) * cell); cs.push(col); }
    }
  }
  return dots(xs, ys, cs, size, size >= 3 * DPR);
}

// コラッツの格子: 1 マスの大きさは、描く数のうちいちばん大きい c が入るように（最大 24px）
function collatzGrid(maxNum) {
  const cell = Math.min(24 * DPR, S / (triPos(maxNum)[2] + 1));
  return {
    cell,
    at(m) { const [x, y] = triPos(m); return [(x + 0.5) * cell, S - (y + 0.5) * cell]; },
  };
}

const PLANS = {
  prime(p) {
    const isP = isPrimeTable();
    const colored = p[1] === 1;
    return numberDots(PRIME_N[p[2]], p[0], p[3], (n) => isP[n] && (colored ? ROOT[digitRoot(n)] : INK), [3, 1.8, 1.1][p[2]]);
  },

  multiples([layout, a, b, c, ni]) {
    const RGB = [];
    for (let k = 0; k < 8; k++) RGB.push(`rgb(${k & 4 ? 255 : 0},${k & 2 ? 255 : 0},${k & 1 ? 255 : 0})`);
    const pick = (n) => {
      const k = (a && n % a === 0 ? 4 : 0) | (b && n % b === 0 ? 2 : 0) | (c && n % c === 0 ? 1 : 0);
      return k && RGB[k];
    };
    // らせん（0）とうずまき（1）の順番が素数の模様と逆なので入れかえる
    return numberDots(MULT_N[ni], layout === 0 ? 1 : 0, 0, pick, [2.4, 1.7, 1.2][ni]);
  },

  collatz([mode, n]) {
    if (mode === 0) {
      const path = collatzPath(n);
      const g = collatzGrid(Math.max(...path));
      const labels = g.cell >= 14 * DPR;
      const dot = Math.min(5 * DPR, Math.max(1.5 * DPR, g.cell * 0.3));
      return {
        count: path.length,
        draw(c, from, to) {
          c.lineWidth = (g.cell >= 4 * DPR ? 1.6 : 1) * DPR;
          c.lineCap = 'round';
          c.font = `${Math.round(g.cell * 0.4)}px system-ui, sans-serif`;
          c.textBaseline = 'bottom';
          for (let i = from; i < to; i++) {
            const [x, y] = g.at(path[i]);
            if (i > 0) {
              const [px, py] = g.at(path[i - 1]);
              c.strokeStyle = path[i] * 2 === path[i - 1] ? RED : BLUE;   // ÷2 は赤、×3+1 は青
              c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
            }
            c.fillStyle = INK;
            c.beginPath(); c.arc(x, y, dot / 2, 0, 7); c.fill();
            if (labels) c.fillText(path[i], x + dot * 0.6, y - dot * 0.3);
          }
        },
      };
    }
    const { nums, max } = collatzTree(n);
    const g = collatzGrid(max);
    if (mode === 1) {
      const xs = [], ys = [];
      for (const m of nums) { const [x, y] = g.at(m); xs.push(x); ys.push(y); }
      return dots(xs, ys, INK, Math.max(1, g.cell * 0.6), g.cell >= 6 * DPR);
    }
    const edges = nums.filter((m) => m !== 1);
    return {
      count: edges.length,
      draw(c, from, to) {
        c.lineWidth = Math.max(1, Math.min(1.4 * DPR, g.cell * 0.3));
        c.lineCap = 'round';
        c.globalAlpha = 0.85;
        for (const half of [true, false]) {
          c.strokeStyle = half ? RED : BLUE;
          c.beginPath();
          for (let i = from; i < to; i++) {
            const m = edges[i];
            if ((m % 2 === 0) !== half) continue;
            const [x0, y0] = g.at(m), [x1, y1] = g.at(collatzNext(m));
            c.moveTo(x0, y0); c.lineTo(x1, y1);
          }
          c.stroke();
        }
        c.globalAlpha = 1;
      },
    };
  },

  star([b, a]) {
    const pt = (k) => starPoint(b, k).map(X);
    const segs = [];
    for (const loop of starLoops(b, a)) for (let i = 1; i < loop.length; i++) segs.push([loop[i - 1], loop[i]]);
    return {
      count: segs.length,
      base(c) {
        c.fillStyle = 'rgba(241, 236, 217, 0.5)';
        for (let k = 0; k < b; k++) { const [x, y] = pt(k); c.beginPath(); c.arc(x, y, 2.2 * DPR, 0, 7); c.fill(); }
      },
      draw(c, from, to) {
        c.strokeStyle = MINT;
        c.lineWidth = 1.6 * DPR;
        c.lineCap = 'round';
        c.beginPath();
        for (let i = from; i < to; i++) { c.moveTo(...pt(segs[i][0])); c.lineTo(...pt(segs[i][1])); }
        c.stroke();
      },
    };
  },

  koch([stage, snow]) {
    const pts = kochPoints(stage, snow === 1).map(X);
    return {
      count: pts.length / 2 - 1,
      draw(c, from, to) {
        c.strokeStyle = INK;
        c.lineWidth = 1.4 * DPR;
        c.lineJoin = c.lineCap = 'round';
        c.beginPath();
        c.moveTo(pts[from * 2], pts[from * 2 + 1]);
        for (let i = from + 1; i <= to; i++) c.lineTo(pts[i * 2], pts[i * 2 + 1]);
        c.stroke();
      },
    };
  },

  epicycle(p) {
    const sp = p.slice(0, 3), arms = p[3] === 1;
    const n = epicyclePeriod(sp);
    const pts = new Float64Array((n + 1) * 2);
    for (let k = 0; k <= n; k++) { const [x, y] = epicycleJoints(sp, k)[3]; pts[k * 2] = X(x); pts[k * 2 + 1] = X(y); }
    return {
      count: n,
      dur: arms ? n / 120 * 1000 : 3000,   // 腕を見せるときは 1 秒に 120 歩
      draw(c, from, to) {
        c.strokeStyle = MINT;
        c.lineWidth = 1.3 * DPR;
        c.lineJoin = c.lineCap = 'round';
        c.beginPath();
        c.moveTo(pts[from * 2], pts[from * 2 + 1]);
        for (let i = from + 1; i <= to; i++) c.lineTo(pts[i * 2], pts[i * 2 + 1]);
        c.stroke();
      },
      overlay(c, k) {
        c.clearRect(0, 0, S, S);
        if (!arms) return;
        const js = epicycleJoints(sp, k).map(([x, y]) => [X(x), X(y)]);
        c.strokeStyle = 'rgba(236, 239, 233, 0.55)';
        c.lineWidth = 1.5 * DPR;
        c.beginPath();
        c.moveTo(...js[0]);
        for (const j of js.slice(1)) c.lineTo(...j);
        c.stroke();
        js.forEach(([x, y], i) => {
          c.fillStyle = i === 3 ? '#ffb454' : '#8fb8ff';
          c.beginPath(); c.arc(x, y, (i === 3 ? 4 : 3) * DPR, 0, 7); c.fill();
        });
      },
    };
  },

  chords([s1, s2]) {
    const n = chordsPeriod(s1, s2);
    const at = (s, k) => { const a = (-90 + s * k) * Math.PI / 180; return [X(Math.cos(a)), X(Math.sin(a))]; };
    const alpha = Math.max(0.28, Math.min(0.9, 60 / n));   // 線が多いほど薄く（重なった所が濃くなる）
    return {
      count: n,
      base(c) {
        c.strokeStyle = 'rgba(241, 236, 217, 0.18)';
        c.lineWidth = 1 * DPR;
        c.beginPath(); c.arc(S / 2, S / 2, S * 0.47, 0, 7); c.stroke();
      },
      draw(c, from, to) {
        c.strokeStyle = `rgba(126, 224, 195, ${alpha})`;
        c.lineWidth = 1.1 * DPR;
        c.lineCap = 'round';
        for (let k = from; k < to; k++) {   // 1 本ずつ引く（まとめて引くと重なった所が濃くならない）
          c.beginPath(); c.moveTo(...at(s1, k)); c.lineTo(...at(s2, k)); c.stroke();
        }
      },
    };
  },
};

// マンデルブロ集合は重いので、1 CSS px に 1 点（粗いときは 2×2 に 1 点）で計算し、行ごとに区切って描く
const off = document.createElement('canvas');
const offctx = off.getContext('2d');
const MB_INSIDE = 0xff0d0b0a;   // ImageData に書く 32 bit 値（ABGR の順）
// 回数 k で決まる色。64 回で一巡する（暗い緑 → 深い緑 → ミント → 象牙 → 琥珀 → 暗い茶 → 暗い緑）
const MB_PAL = (() => {
  const stops = [[0x10, 0x16, 0x15], [0x1c, 0x4a, 0x42], [0x7e, 0xe0, 0xc3], [0xf6, 0xf0, 0xd8], [0xe0, 0xa2, 0x4a], [0x3a, 0x22, 0x14], [0x10, 0x16, 0x15]];
  const out = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    const t = i / 64 * (stops.length - 1), j = Math.floor(t), f = t - j;
    const [r, g, b] = stops[j].map((v, k) => Math.round(v + (stops[j + 1][k] - v) * f));
    out[i] = (0xff << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  return out;
})();

function mandelPlan(iter, coarse) {
  const R = Math.max(1, Math.round(S / DPR / (coarse ? 2 : 1)));
  off.width = off.height = R;
  const row = offctx.createImageData(R, 1);
  const px = new Uint32Array(row.data.buffer);
  const span = MB_SPAN / MB_FACTOR ** view.zoom;
  const { cx, cy } = view;
  let dirty = false;
  return {
    count: R,
    budget: true,
    draw(c, from, to) {
      for (let y = from; y < to; y++) {
        const im = cy - ((y + 0.5) / R - 0.5) * span;
        for (let x = 0; x < R; x++) {
          const k = mandelEscape(cx + ((x + 0.5) / R - 0.5) * span, im, iter);
          px[x] = k === iter ? MB_INSIDE : MB_PAL[k & 63];
        }
        offctx.putImageData(row, 0, y);
      }
      dirty = true;
    },
    // 1 フレームに 1 回、計算した行を画面に出す。まだの行は透明なので、前の（粗い）絵が残る
    flush(c) {
      if (!dirty) return;
      c.imageSmoothingEnabled = false;
      c.drawImage(off, 0, 0, S, S);
      dirty = false;
    },
  };
}

// ---- 描く様子 ----
let job = null;   // { plan, done, start, dur, chord }
let raf = 0;

function clearArt() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, S, S);
  octx.clearRect(0, 0, S, S);
}

// animate: 約 3 秒かけて描く様子を見せる。でなければ描き終わりの絵をすぐ出す（重い図は数フレームに分ける）
function begin(plan, { animate = false, keep = false } = {}) {
  cancelAnimationFrame(raf);
  if (!keep) { clearArt(); plan.base?.(ctx); }
  if (!animate && !plan.budget) {
    plan.draw(ctx, 0, plan.count);
    plan.overlay?.(octx, plan.count);
    job = null;
    return;
  }
  job = { plan, done: 0, start: performance.now(), dur: animate ? plan.dur ?? 3000 : 0, chord: animate };
  raf = requestAnimationFrame(frame);
}

function frame(t) {
  const j = job;
  if (!j) return;
  const { plan } = j;
  const target = j.dur ? Math.min(plan.count, Math.floor(plan.count * Math.max(0, t - j.start) / j.dur)) : plan.count;
  if (plan.budget) {
    const until = performance.now() + 10;   // 1 フレームに 10ms まで（画面を固めない）
    while (j.done < target && performance.now() < until) {
      const next = Math.min(target, j.done + 2);
      plan.draw(ctx, j.done, next);
      j.done = next;
    }
    plan.flush(ctx);
  } else if (target > j.done) {
    plan.draw(ctx, j.done, target);
    j.done = target;
  }
  plan.overlay?.(octx, j.done);
  if (j.done >= plan.count) {
    job = null;
    if (j.chord) sfx.done();
    return;
  }
  raf = requestAnimationFrame(frame);
}

let dragging = false;   // スライダーを動かしている間（マンデルブロ集合は粗く描くだけ）

function render(animate) {
  if (!S) return;
  const fig = state.fig, p = vals[fig];
  animate = animate && !reduceMotion.matches;
  if (fig === 'mandelbrot') {
    if (animate) { begin(mandelPlan(p[0], false), { animate }); return; }
    const coarse = mandelPlan(p[0], true);
    cancelAnimationFrame(raf);
    job = null;
    clearArt();
    coarse.draw(ctx, 0, coarse.count);
    coarse.flush(ctx);
    if (!dragging) begin(mandelPlan(p[0], false), { keep: true });
    return;
  }
  begin(PLANS[fig](p), { animate });
}

// つまみを動かしたときは、1 フレームにまとめて描き直す
let pending = 0;
function requestRender() {
  if (pending) return;
  pending = requestAnimationFrame(() => { pending = 0; render(false); });
}

let started = false;
new ResizeObserver(() => {
  DPR = Math.min(devicePixelRatio || 1, 2);   // 3 倍の画面でも 2 倍で描く（描く量を抑える）
  const w = Math.round(art.getBoundingClientRect().width * DPR);
  if (w > 0 && w !== S) {
    S = art.width = art.height = over.width = over.height = w;
    render(!started);   // はじめは描く様子を見せる。大きさが変わったときはすぐ描き直す
    started = true;
  }
}).observe(art);

// ---- 図を選ぶ・つまみ ----
const figBtns = FIGS.map((f) => {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = f.name;
  b.addEventListener('click', () => { selectFig(f.id); sfx.pop(); });
  return b;
});
$('figs').replaceChildren(...figBtns);

function renderInfo() {
  const f = FIG[state.fig];
  $('figName').textContent = f.name;
  $('figDesc').textContent = f.desc;
  $('figSum').textContent = summary(state.fig, vals[state.fig], view);
  $('home').hidden = state.fig !== 'mandelbrot';
  $('board').classList.toggle('board--zoom', state.fig === 'mandelbrot');
  FIGS.forEach((g, i) => figBtns[i].setAttribute('aria-pressed', String(g.id === state.fig)));
}

// 値を 1 つ変える。変わったら true
function setVal(i, v) {
  const fig = state.fig, f = FIG[fig], p = vals[fig], k = f.knobs[i];
  v = Math.min(knobMax(k, p), Math.max(knobMin(k), v));
  if (v === p[i]) return false;
  p[i] = v;
  if (fig === 'star') p[1] = Math.min(p[1], Math.floor(p[0] / 2));   // b を減らして a が上限を越えたら下げる
  state.p[fig] = p;
  store();
  updateKnobs();
  renderInfo();
  requestRender();
  return true;
}
const tickFor = (k, v) => sfx.tick((v - k.min) / (k.max - k.min));

let knobEls = [];
function buildKnobs() {
  const f = FIG[state.fig];
  knobEls = f.knobs.map((k, i) => {
    const box = document.createElement('div');
    box.className = 'knob';
    const label = Object.assign(document.createElement('span'), { className: 'knob__label', textContent: k.label });
    if (k.choices) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', k.label);
      const btns = k.choices.map((name, v) => {
        const b = Object.assign(document.createElement('button'), { className: 'btn', textContent: name });
        b.addEventListener('click', () => { if (setVal(i, v)) sfx.pop(); });
        return b;
      });
      seg.append(...btns);
      box.append(label, seg);
      return { box, k, btns };
    }
    const rowEl = document.createElement('div');
    rowEl.className = 'knob__row';
    const minus = Object.assign(document.createElement('button'), { className: 'step', textContent: '−' });
    const plus = Object.assign(document.createElement('button'), { className: 'step', textContent: '＋' });
    minus.setAttribute('aria-label', `${k.label}を 1 減らす`);
    plus.setAttribute('aria-label', `${k.label}を 1 増やす`);
    const out = document.createElement('output');
    const range = Object.assign(document.createElement('input'), { type: 'range', step: 1 });
    range.setAttribute('aria-label', k.label);
    holdStep(minus, i, -1);
    holdStep(plus, i, 1);
    range.addEventListener('input', () => {
      dragging = true;
      if (setVal(i, +range.value)) tickFor(k, +range.value);
    });
    range.addEventListener('change', () => { dragging = false; if (state.fig === 'mandelbrot') requestRender(); });
    rowEl.append(label, minus, out, plus);
    box.append(rowEl, range);
    return { box, k, minus, plus, out, range };
  });
  $('knobs').replaceChildren(...knobEls.map((e) => e.box));
  updateKnobs();
}

function updateKnobs() {
  const p = vals[state.fig];
  knobEls.forEach((e, i) => {
    const { k } = e;
    e.box.hidden = k.showIf ? !k.showIf(p) : false;
    if (e.btns) { e.btns.forEach((b, v) => b.setAttribute('aria-pressed', String(v === p[i]))); return; }
    const lo = knobMin(k), hi = knobMax(k, p);
    e.out.textContent = String(p[i]).replace('-', '−');
    e.range.min = lo; e.range.max = hi; e.range.value = p[i];
    e.minus.disabled = p[i] <= lo;
    e.plus.disabled = p[i] >= hi;
  });
}

// 「−」「＋」: 押すと 1 つ、押しっぱなしで続けて変わる
function holdStep(btn, i, d) {
  let timer = 0;
  const once = () => {
    const k = FIG[state.fig].knobs[i], v = vals[state.fig][i] + d;
    if (setVal(i, v)) tickFor(k, v); else stop();
  };
  const stop = () => clearTimeout(timer);
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    once();
    timer = setTimeout(function rep() { once(); timer = setTimeout(rep, 70); }, 400);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', (e) => { if (e.detail === 0) once(); });   // キーボード（Enter・Space）で押したとき
}

function selectFig(id) {
  state.fig = id;
  store();
  buildKnobs();
  renderInfo();
  render(true);
  figBtns[FIGS.findIndex((f) => f.id === id)].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

// ---- 操作 ----
$('redraw').addEventListener('click', () => { render(true); sfx.pop(); });
$('random').addEventListener('click', () => {
  vals[state.fig] = state.p[state.fig] = randomParams(state.fig);
  store();
  updateKnobs();
  renderInfo();
  render(true);
  sfx.random();
});
$('home').addEventListener('click', () => { view = { ...MB_START }; renderInfo(); render(false); sfx.pop(); });

// 図をタップ: もう一度描く。マンデルブロ集合は、そこを中心に 3 倍に拡大
$('board').addEventListener('click', (e) => {
  if (state.fig !== 'mandelbrot') { render(true); sfx.pop(); return; }
  if (view.zoom >= MB_MAX_ZOOM) { WebAppKit.toast('これ以上は拡大できない'); sfx.full(); return; }
  const r = art.getBoundingClientRect();
  const span = MB_SPAN / MB_FACTOR ** view.zoom;
  view = {
    cx: view.cx + ((e.clientX - r.left) / r.width - 0.5) * span,
    cy: view.cy - ((e.clientY - r.top) / r.height - 0.5) * span,
    zoom: view.zoom + 1,
  };
  renderInfo();
  render(false);
  sfx.zoom();
});

// 共有: webapp-kit が document で拾う前に、今の図と値を入れておく
$('share').addEventListener('click', () => {
  const fig = state.fig;
  WebAppKit.init({
    text: `数の模様「${FIG[fig].name}」${summary(fig, vals[fig], view)}`,
    url: shareUrl(location.origin + location.pathname, fig, vals[fig], view),
  });
});

// ---- 遊び方 ----
function openHelp() { $('help').hidden = false; $('helpClose').focus(); }
function closeHelp() {
  $('help').hidden = true;
  if (!state.seenHelp) { state.seenHelp = true; store(); }
}
$('helpBtn').addEventListener('click', openHelp);
$('helpClose').addEventListener('click', closeHelp);
$('help').addEventListener('click', (e) => { if (e.target === $('help')) closeHelp(); });

// PC: ← → で図を切り替え、R でもう一度描く（スライダーの上では ← → はスライダーのもの）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('help').hidden) { closeHelp(); return; }
  if (!$('help').hidden || e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = FIGS.findIndex((f) => f.id === state.fig);
    const next = FIGS[(i + (e.key === 'ArrowRight' ? 1 : FIGS.length - 1)) % FIGS.length];
    e.preventDefault();
    selectFig(next.id);
    sfx.pop();
  } else if (e.key === 'r' || e.key === 'R') {
    render(true);
    sfx.pop();
  }
});

// ---- はじめ ----
buildKnobs();
renderInfo();
if (!state.seenHelp) openHelp();
