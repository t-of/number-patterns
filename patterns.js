// 数の模様の中身（図ごとの数の計算・つまみの範囲・保存と URL の読み書き・値の要約）。
// DOM には触らない。ブラウザでは main.js から、テストでは node test.mjs から読む。

export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const fmt = (n) => n.toLocaleString('ja-JP');

// ---- 素数 ----
// エラトステネスのふるい。isPrime[n] が 1 なら素数（元の「√n 未満まで割る」だと 9・25 も素数になっていた）
export function sieve(n) {
  const p = new Uint8Array(n + 1).fill(1);
  p[0] = 0;
  if (n >= 1) p[1] = 0;
  for (let i = 2; i * i <= n; i++) if (p[i]) for (let j = i * i; j <= n; j += i) p[j] = 0;
  return p;
}
export const MAX_N = 100000;
let primeCache = null;
export const isPrimeTable = () => primeCache || (primeCache = sieve(MAX_N));
export function countPrimes(n) {
  const p = isPrimeTable();
  let c = 0;
  for (let i = 2; i <= n; i++) c += p[i];
  return c;
}

// 数字根: 各桁を足すことを 1 桁になるまでくり返した数
export const digitRoot = (n) => 1 + (n - 1) % 9;

// 四角いうずまき（1 が中心。左 1 → 下 1 → 右 2 → 上 2 → 左 3 → …）。
// xs[n - 1], ys[n - 1] が n のマス（右と下が +）
export function ulam(N) {
  const xs = new Int32Array(N), ys = new Int32Array(N);
  const DX = [-1, 0, 1, 0], DY = [0, 1, 0, -1];
  let x = 0, y = 0, d = 0, len = 1, n = 1;
  while (n < N) {
    for (let rep = 0; rep < 2 && n < N; rep++) {
      for (let k = 0; k < len && n < N; k++) {
        x += DX[d]; y += DY[d];
        xs[n] = x; ys[n] = y;
        n++;
      }
      d = (d + 1) & 3;
    }
    len++;
  }
  return { xs, ys };
}

// ---- コラッツ ----
export const collatzNext = (m) => (m % 2 === 0 ? m / 2 : 3 * m + 1);
export function collatzPath(n) {
  const path = [n];
  while (n !== 1) path.push(n = collatzNext(n));
  return path;
}
// 三角の番号づけ: m − 1 = (1 + 2 + … + c) + t（0 ≤ t ≤ c）→ 左下を原点に (c − t, t)。c も返す
export function triPos(m) {
  const c = Math.floor((Math.sqrt(8 * (m - 1) + 1) - 1) / 2);
  const t = m - 1 - c * (c + 1) / 2;
  return [c - t, t, c];
}
// 2〜n の道をまとめる。同じ数は 1 回だけ（道は途中で合流するので、通った数に来たらやめる）
export function collatzTree(n) {
  const seen = new Set([1]);
  const nums = [1];
  let max = 1;
  for (let s = 2; s <= n; s++) {
    for (let m = s; !seen.has(m); m = collatzNext(m)) {
      seen.add(m);
      nums.push(m);
      if (m > max) max = m;
    }
  }
  return { nums, max };
}

// ---- 星形 ----
// {b/a}: 円の上の b 点を a 個先へ結ぶ。公約数 g > 1 なら 1 つずつずらして g 回。
// 返すのは点の番号の並びの配列（1 周ぶん、始めに戻る点も入れる）
export function starLoops(b, a) {
  const g = gcd(a, b);
  const loops = [];
  for (let s = 0; s < g; s++) {
    const loop = [s];
    for (let k = 1; k <= b / g; k++) loop.push((s + k * a) % b);
    loops.push(loop);
  }
  return loops;
}
// 点 k の位置（中心 0・半径 1、y は下が +。1 つ目は真上）。角度は小数で計算する
export const starPoint = (b, k) => {
  const ang = -Math.PI / 2 + 2 * Math.PI * k / b;
  return [Math.cos(ang), Math.sin(ang)];
};

// ---- マンデルブロ集合 ----
// z = 0 から z ← z² + c。|z|² > 4 になったら、そのときまでの回数（0 から）を返す。超えなければ maxIter
export function mandelEscape(cr, ci, maxIter) {
  let zr = 0, zi = 0;
  for (let k = 0; k < maxIter; k++) {
    const t = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = t;
    if (zr * zr + zi * zi > 4) return k;
  }
  return maxIter;
}
export const MB_START = { cx: -0.5, cy: 0, zoom: 0 };   // 実部 −2〜1、虚部 −1.5〜1.5
export const MB_SPAN = 3;
export const MB_MAX_ZOOM = 25;
export const MB_FACTOR = 3;

// ---- コッホ曲線 ----
// 点の並び [x0, y0, x1, y1, …]（中心 0・半径 1、y は下が +）。線の本数 = 点の数 − 1
export function kochPoints(stage, snow) {
  let pts;
  if (snow) {
    const R = 0.95;   // 山の先も R に届く
    const v = (deg) => [R * Math.cos(deg * Math.PI / 180), R * Math.sin(deg * Math.PI / 180)];
    pts = [...v(150), ...v(-90), ...v(30), ...v(150)];   // 左下 → 上 → 右下 → 左下（山が外を向く順）
  } else {
    pts = [-0.95, 0.27, 0.95, 0.27];   // 山は上向き。高さは長さの √3 / 6
  }
  const c = Math.cos(-Math.PI / 3), s = Math.sin(-Math.PI / 3);
  for (let k = 0; k < stage; k++) {
    const out = [pts[0], pts[1]];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
      const dx = (bx - ax) / 3, dy = (by - ay) / 3;
      const px = ax + dx, py = ay + dy;
      out.push(px, py, px + dx * c - dy * s, py + dx * s + dy * c, ax + 2 * dx, ay + 2 * dy, bx, by);
    }
    pts = out;
  }
  return pts;
}

// ---- 円運動 ----
// 腕 i は 1 歩に 速さ × 0.1° 回る。全部の腕が元の向きに戻るまでの歩数。
// 3600 と、0 でない速さの最大公約数 g を取って 3600 / g（3600 を入れないと、g が 3600 を割り切らないときにずれる）
export function epicyclePeriod(speeds) {
  let g = 3600;
  for (const v of speeds) g = gcd(g, v);
  return 3600 / g;
}
export const epicycleArm = 1 / 3;
// 歩 k での腕の関節と先の点（中心から順に 4 点。y は下が +、角度 0 は右、反時計回りが +）
export function epicycleJoints(speeds, k) {
  const pts = [[0, 0]];
  let x = 0, y = 0;
  for (const v of speeds) {
    const a = v * k * Math.PI / 1800;
    x += epicycleArm * Math.cos(a);
    y -= epicycleArm * Math.sin(a);
    pts.push([x, y]);
  }
  return pts;
}
// 円上の 2 点: 1 歩に 速さ 度進む。両方が元の位置に戻るまでの歩数
export const chordsPeriod = (s1, s2) => 360 / gcd(gcd(s1, s2), 360);

// ---- 図とつまみ ----
// つまみ: { label, choices } か { label, min, max }。def は既定値。p（値の並び）の順番はこの順
export const FIGS = [
  {
    id: 'prime', name: '素数の模様',
    desc: '1, 2, 3, … と並べて、素数だけに点を打つ。ばらばらに見える素数が、斜めの線や腕の形に集まる',
    knobs: [
      { label: '並べ方', choices: ['うずまき', 'らせん', '横に並べる'] },
      { label: '色', choices: ['ひといろ', '数字根'] },
      { label: '数の多さ', choices: ['1,000', '10,000', '100,000'] },
      { label: '1 行の数', min: 2, max: 120, showIf: (p) => p[0] === 2 },
    ],
    def: [0, 0, 1, 80],
  },
  {
    id: 'multiples', name: '倍数の模様',
    desc: '3 つの数の倍数を赤・緑・青に塗る。重なった所は色が混ざり、花火のような模様になる',
    knobs: [
      { label: '並べ方', choices: ['らせん', 'うずまき'] },
      { label: 'a（赤）', min: 0, max: 30, rand: [1, 19] },
      { label: 'b（緑）', min: 0, max: 30, rand: [1, 19] },
      { label: 'c（青）', min: 0, max: 30, rand: [1, 19] },
      { label: '数の多さ', choices: ['1,000', '3,000', '10,000'] },
    ],
    def: [0, 3, 5, 7, 1],
  },
  {
    id: 'collatz', name: 'コラッツの道',
    desc: '偶数なら半分、奇数なら 3 倍して 1 足す。どの数から始めても 1 にたどり着く（と信じられているが、まだ証明されていない）',
    knobs: [
      { label: '見せ方', choices: ['ひとつの道', 'ぜんぶの点', 'ぜんぶの線'] },
      { label: 'はじめの数 n', min: 2, max: 1000 },
    ],
    def: [0, 27],
  },
  {
    id: 'star', name: '星形',
    desc: '円の上の点を、決まった数ずつ飛ばして結ぶ',
    knobs: [
      { label: '点の数 b', min: 3, max: 60 },
      { label: '飛ばす数 a', min: 1, max: 30, maxOf: (p) => Math.floor(p[0] / 2) },
    ],
    def: [7, 3],
  },
  {
    id: 'mandelbrot', name: 'マンデルブロ集合',
    desc: '2 乗して足す、をくり返しても遠くへ飛んでいかない数の集まり。タップすると拡大する',
    knobs: [
      { label: 'くり返しの回数', min: 20, max: 500 },
    ],
    def: [50],
  },
  {
    id: 'koch', name: 'コッホ曲線',
    desc: '線を 3 つに分けて、真ん中に山を立てる、をくり返す',
    knobs: [
      { label: '段階', min: 0, max: 6 },
      { label: '形', choices: ['線', '雪の結晶'] },
    ],
    def: [3, 0],
  },
  {
    id: 'epicycle', name: '円運動の合成',
    desc: '3 本の腕を違う速さで回すと、先の点がこんな形を描く',
    knobs: [
      { label: '腕 1 の速さ', min: -49, max: 49, rand: 'pm49' },
      { label: '腕 2 の速さ', min: -49, max: 49, rand: 'pm49' },
      { label: '腕 3 の速さ', min: -49, max: 49, rand: 'pm49' },
      { label: '腕を見せる', choices: ['オフ', 'オン'] },
    ],
    def: [10, -3, 23, 1],
  },
  {
    id: 'chords', name: '円上の 2 点',
    desc: '円の上を違う速さで回る 2 つの点を、線で結び続ける',
    knobs: [
      { label: '点 1 の速さ', min: -180, max: 180 },
      { label: '点 2 の速さ', min: -180, max: 180 },
    ],
    def: [1, 2],
  },
];
export const FIG = Object.fromEntries(FIGS.map((f) => [f.id, f]));
export const PRIME_N = [1000, 10000, 100000];
export const MULT_N = [1000, 3000, 10000];

export const knobMin = (k) => (k.choices ? 0 : k.min);
export const knobMax = (k, p) => (k.choices ? k.choices.length - 1 : k.maxOf ? k.maxOf(p) : k.max);

// 値の並びが正しいか（数・整数・範囲）
export function isValid(id, p) {
  const f = FIG[id];
  if (!f || !Array.isArray(p) || p.length !== f.knobs.length) return false;
  return f.knobs.every((k, i) => Number.isInteger(p[i]) && p[i] >= knobMin(k) && p[i] <= knobMax(k, p));
}

// おまかせ
export function randomParams(id, rand = Math.random) {
  const f = FIG[id];
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const p = [];
  for (const k of f.knobs) {
    if (k.rand === 'pm49') p.push(pick(1, 49) * (rand() < 0.5 ? -1 : 1));
    else if (k.rand) p.push(pick(...k.rand));
    else p.push(pick(knobMin(k), knobMax(k, p)));   // maxOf は前のつまみの値で決まる
  }
  return p;
}

// ---- 保存（number-patterns.state）と URL ----

export const DEFAULT_STATE = { v: 1, fig: 'prime', p: {}, sound: true, seenHelp: false };

// 保存した文字列を読む。読めない・範囲の外の値は、その図だけ既定に戻す（p に入れない）
export function readState(raw) {
  let o;
  try { o = JSON.parse(raw); } catch { o = null; }
  if (!o || typeof o !== 'object') return { ...DEFAULT_STATE, p: {} };
  const p = {};
  if (o.p && typeof o.p === 'object') for (const id in o.p) if (isValid(id, o.p[id])) p[id] = o.p[id];
  return {
    v: 1,
    fig: FIG[o.fig] ? o.fig : DEFAULT_STATE.fig,
    p,
    sound: o.sound !== false,
    seenHelp: o.seenHelp === true,
  };
}

// マンデルブロ集合の拡大の位置（共有のときだけ URL に入れる）
const isView = (cx, cy, zoom) => Number.isFinite(cx) && Number.isFinite(cy) && Math.abs(cx) <= 3 && Math.abs(cy) <= 3
  && Number.isInteger(zoom) && zoom >= 0 && zoom <= MB_MAX_ZOOM;

// location.search の ?f=&p= を読む。合わなければ null（無視する）。
// マンデルブロ集合は p = くり返し, 中心の実部, 中心の虚部, 拡大の回数 → { fig, p: [くり返し], view }
export function fromSearch(search) {
  const q = new URLSearchParams(search);
  const fig = q.get('f'), ps = q.get('p');
  if (!FIG[fig] || !ps || !/^[-0-9.,e]+$/.test(ps)) return null;
  const nums = ps.split(',').map(Number);
  if (fig === 'mandelbrot') {
    if (nums.length === 4) {
      const [it, cx, cy, zoom] = nums;
      return isValid(fig, [it]) && isView(cx, cy, zoom) ? { fig, p: [it], view: { cx, cy, zoom } } : null;
    }
    return isValid(fig, nums) ? { fig, p: nums, view: null } : null;
  }
  return isValid(fig, nums) ? { fig, p: nums } : null;
}

export function shareUrl(base, fig, p, view) {
  const vals = fig === 'mandelbrot' && view ? [...p, view.cx, view.cy, view.zoom] : p;
  return `${base}?f=${fig}&p=${vals.join(',')}`;
}

// ---- 表示（今の値の要約） ----
const KANJI = ['', '', '', '三', '四', '五', '六', '七', '八', '九'];
export function summary(fig, p, view = MB_START) {
  switch (fig) {
    case 'prime': {
      const N = PRIME_N[p[2]];
      return `${fmt(N)} までの素数 ${fmt(countPrimes(N))} 個`;
    }
    case 'multiples': {
      const used = p.slice(1, 4).filter((v) => v > 0);
      return used.length ? `${used.join('・')} の倍数` : 'どれも 0（点なし）';
    }
    case 'collatz': {
      if (p[0] === 0) {
        const path = collatzPath(p[1]);
        return `${fmt(p[1])} から 1 まで ${fmt(path.length - 1)} 歩。いちばん大きい数 ${fmt(Math.max(...path))}`;
      }
      return `2〜${fmt(p[1])} の道。いちばん大きい数 ${fmt(collatzTree(p[1]).max)}`;
    }
    case 'star': {
      const [b, a] = p, g = gcd(a, b);
      if (g === 1) return `{${b}/${a}}`;
      const bb = b / g, aa = a / g;
      const part = bb === 2 ? '直線' : aa === 1 ? (KANJI[bb] ? `${KANJI[bb]}角形` : `${bb} 角形`) : `{${bb}/${aa}}`;
      return `{${b}/${a}}（${part} ${g} ${bb === 2 ? '本' : 'つ'}）`;
    }
    case 'mandelbrot': return `拡大 ×${fmt(MB_FACTOR ** view.zoom)}`;
    case 'koch': return `段階 ${p[0]}・線 ${fmt(4 ** p[0] * (p[1] ? 3 : 1))} 本`;
    case 'epicycle': return `1 周 ${fmt(epicyclePeriod(p.slice(0, 3)))} 歩`;
    case 'chords': return `線 ${fmt(chordsPeriod(p[0], p[1]))} 本`;
  }
  return '';
}
