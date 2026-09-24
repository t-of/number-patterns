// 中身のテスト。node test.mjs で走る（フレームワークなし）。
import assert from 'node:assert/strict';
import {
  gcd, sieve, countPrimes, digitRoot, ulam, collatzPath, collatzTree, triPos, starLoops, starPoint, mandelEscape,
  kochPoints, epicyclePeriod, epicycleJoints, chordsPeriod, FIGS, FIG, isValid, randomParams, readState, fromSearch,
  shareUrl, summary, DEFAULT_STATE, PRIME_N,
} from './patterns.js';

const test = (name, fn) => { fn(); console.log('✓', name); };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('ふるい: 1 は素数でない、素数の 2 乗（9・25・49）も素数でない', () => {
  const p = sieve(100);
  assert.deepEqual([...p.keys()].filter((i) => p[i]), [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]);
  for (const n of [0, 1, 4, 9, 25, 49, 91]) assert.equal(p[n], 0, n);
});

test('素数の個数: 1,000 まで 168、10,000 まで 1,229、100,000 まで 9,592', () => {
  assert.deepEqual(PRIME_N.map(countPrimes), [168, 1229, 9592]);
});

test('数字根: 3 より大きい素数は 3・6・9 にならない', () => {
  assert.deepEqual([1, 9, 10, 18, 19, 99, 12345].map(digitRoot), [1, 9, 1, 9, 1, 9, 6]);
  const p = sieve(100000);
  for (let n = 5; n <= 100000; n++) if (p[n]) assert.ok(![3, 6, 9].includes(digitRoot(n)), n);
});

test('四角いうずまき: 1 が中心、左 1 → 下 1 → 右 2 → 上 2 → 左 3', () => {
  const { xs, ys } = ulam(10);
  const at = (n) => [xs[n - 1], ys[n - 1]];
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(at),
    [[0, 0], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-2, -1]]);
  // 同じマスに 2 つの数が来ない
  const u = ulam(10000);
  assert.equal(new Set([...u.xs].map((x, i) => `${x},${u.ys[i]}`)).size, 10000);
});

test('コラッツ: 27 は 111 歩で 1 に着き、いちばん大きい数は 9,232', () => {
  const path = collatzPath(27);
  assert.equal(path.length - 1, 111);
  assert.equal(Math.max(...path), 9232);
  assert.deepEqual(collatzPath(6), [6, 3, 10, 5, 16, 8, 4, 2, 1]);
});

test('コラッツ: 2〜1,000 でいちばん大きい数は 250,504（703 から）、2〜100 では 9,232', () => {
  assert.equal(collatzTree(1000).max, 250504);
  assert.equal(Math.max(...collatzPath(703)), 250504);
  const t = collatzTree(100);
  assert.equal(t.max, 9232);
  assert.equal(new Set(t.nums).size, t.nums.length);   // 同じ数は 1 回だけ
  for (let s = 2; s <= 100; s++) for (const m of collatzPath(s)) assert.ok(t.nums.includes(m));
});

test('三角の番号づけ: 元の while ループと同じマス', () => {
  const orig = (m) => { let t = m - 1, c = 0; while (t > c) { c++; t -= c; } return [c - t, t, c]; };
  for (let m = 1; m <= 5000; m++) assert.deepEqual(triPos(m), orig(m), m);
  for (const m of [9232, 250504]) assert.deepEqual(triPos(m), orig(m), m);
  assert.deepEqual([1, 2, 3, 4].map((m) => triPos(m).slice(0, 2)), [[0, 0], [1, 0], [0, 1], [2, 0]]);
});

test('星形: {7/3} は 1 周で全部の点、{6/2} は三角形 2 つ', () => {
  assert.deepEqual(starLoops(7, 3), [[0, 3, 6, 2, 5, 1, 4, 0]]);
  assert.deepEqual(starLoops(6, 2), [[0, 2, 4, 0], [1, 3, 5, 1]]);
  assert.equal(starLoops(12, 4).length, 4);
  for (const [b, a] of [[7, 3], [12, 5], [60, 30], [9, 4]]) {
    const used = new Set(starLoops(b, a).flat());
    assert.equal(used.size, b, `{${b}/${a}}`);
  }
});

test('星形: 1 つ目は真上、点は等しい間かく（角度を小数で計算）', () => {
  const [x0, y0] = starPoint(7, 0);
  close(x0, 0); close(y0, -1);
  const d = (k) => Math.hypot(starPoint(7, k + 1)[0] - starPoint(7, k)[0], starPoint(7, k + 1)[1] - starPoint(7, k)[1]);
  for (let k = 0; k < 7; k++) close(d(k), d(0));
});

test('マンデルブロ: |z|² > 4 で判定（元の |a + b| > 16 ではない）', () => {
  assert.equal(mandelEscape(0, 0, 100), 100);        // 中
  assert.equal(mandelEscape(-1, 0, 100), 100);       // 0, −1, 0, −1, …
  assert.equal(mandelEscape(0, 1, 100), 100);        // i は周期 2 に落ちる
  assert.equal(mandelEscape(-2, 0, 100), 100);       // |z|² = 4 のまま（ちょうど 4 は超えていない）
  assert.equal(mandelEscape(0.25, 0, 500), 500);     // くびれの先
  assert.ok(mandelEscape(0.26, 0, 500) < 500);
  assert.equal(mandelEscape(1, 0, 100), 2);          // 1, 2, 5 → 3 回目で超える
  assert.equal(mandelEscape(2, -2, 100), 0);         // a + b = 0 でも |c|² = 8 > 4
  assert.equal(mandelEscape(0.5, 0.5, 100) < 100, true);
});

test('コッホ曲線: 線の本数は 4^段階（雪の結晶は × 3）、端の点は動かない', () => {
  for (let k = 0; k <= 6; k++) {
    assert.equal(kochPoints(k, false).length / 2 - 1, 4 ** k);
    assert.equal(kochPoints(k, true).length / 2 - 1, 3 * 4 ** k);
  }
  const p = kochPoints(3, false);
  assert.deepEqual([p[0], p[1], p.at(-2), p.at(-1)], [-0.95, 0.27, 0.95, 0.27]);
  assert.ok(Math.min(...p.filter((_, i) => i % 2)) < 0.27 - 0.5);   // 山は上向き（y が小さい）
  // 雪の結晶は、山が外に出る（中心からの距離が 0.95 を超えない、1 段目の山の先はちょうど 0.95）
  const s = kochPoints(1, true);
  const r = [];
  for (let i = 0; i < s.length; i += 2) r.push(Math.hypot(s[i], s[i + 1]));
  close(Math.max(...r), 0.95);
  assert.ok(r.filter((v) => Math.abs(v - 0.95) < 1e-9).length >= 6);
});

test('円運動: 1 周の歩数', () => {
  assert.equal(epicyclePeriod([10, -3, 23]), 3600);
  assert.equal(epicyclePeriod([10, 20, 30]), 360);
  assert.equal(epicyclePeriod([7, 14, 0]), 3600);    // 3600 ÷ 7 は割り切れないので 3600
  assert.equal(epicyclePeriod([0, 0, 0]), 1);
  assert.equal(epicyclePeriod([45, -45, 0]), 80);
  // 1 周で先の点が元に戻る
  for (const sp of [[10, -3, 23], [7, 14, 0], [45, -45, 0], [-49, 48, 1]]) {
    const n = epicyclePeriod(sp), a = epicycleJoints(sp, 0)[3], b = epicycleJoints(sp, n)[3];
    close(a[0], b[0], 1e-9); close(a[1], b[1], 1e-9);
  }
  close(Math.hypot(...epicycleJoints([0, 0, 0], 0)[3]), 1);   // 腕 3 本で半径 1
});

test('円上の 2 点: 1 周の本数', () => {
  assert.equal(chordsPeriod(1, 2), 360);
  assert.equal(chordsPeriod(90, 180), 4);
  assert.equal(chordsPeriod(-180, 180), 2);
  assert.equal(chordsPeriod(0, 0), 1);
  assert.equal(chordsPeriod(7, 0), 360);
});

test('図は 8 つ、既定の値は正しい範囲', () => {
  assert.deepEqual(FIGS.map((f) => f.id), ['prime', 'multiples', 'collatz', 'star', 'mandelbrot', 'koch', 'epicycle', 'chords']);
  for (const f of FIGS) assert.ok(isValid(f.id, f.def), f.id);
});

test('値の検査: 数が合わない・整数でない・範囲の外はだめ。星形の a は b / 2 まで', () => {
  assert.ok(isValid('star', [7, 3]));
  assert.ok(!isValid('star', [7, 4]));
  assert.ok(isValid('star', [8, 4]));
  assert.ok(!isValid('star', [7]));
  assert.ok(!isValid('star', [7, 1.5]));
  assert.ok(!isValid('star', ['7', 3]));
  assert.ok(!isValid('collatz', [0, 1001]));
  assert.ok(!isValid('prime', [3, 0, 1, 80]));
  assert.ok(isValid('epicycle', [-49, 0, 49, 0]));
  assert.ok(!isValid('nope', [1]));
});

test('おまかせ: どの図も正しい値。倍数は 1〜19、円運動は ±1〜49', () => {
  let n = 7;
  const rand = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
  for (let i = 0; i < 300; i++) {
    for (const f of FIGS) assert.ok(isValid(f.id, randomParams(f.id, rand)), f.id);
    const m = randomParams('multiples', rand);
    assert.ok(m.slice(1, 4).every((v) => v >= 1 && v <= 19));
    const e = randomParams('epicycle', rand);
    assert.ok(e.slice(0, 3).every((v) => v !== 0 && Math.abs(v) <= 49));
  }
});

test('保存の読み書き: 正しい図の値は残し、おかしい図だけ既定に', () => {
  const s = { v: 1, fig: 'star', p: { star: [7, 3], prime: [0, 0, 1, 80] }, sound: false, seenHelp: true };
  assert.deepEqual(readState(JSON.stringify(s)), s);
  assert.deepEqual(readState(null), DEFAULT_STATE);
  assert.deepEqual(readState('こわれた{'), DEFAULT_STATE);
  assert.deepEqual(readState('"star"'), DEFAULT_STATE);
  const bad = readState(JSON.stringify({ fig: 'x', p: { star: [7, 9], koch: [2, 1], nope: [1] }, sound: 'no' }));
  assert.deepEqual(bad, { v: 1, fig: 'prime', p: { koch: [2, 1] }, sound: true, seenHelp: false });
});

test('URL: 共有した URL を開くと同じ図と値', () => {
  const base = 'https://t-of.github.io/number-patterns/';
  const url = shareUrl(base, 'star', [7, 3]);
  assert.equal(url, `${base}?f=star&p=7,3`);
  assert.deepEqual(fromSearch(new URL(url).search), { fig: 'star', p: [7, 3] });
  const m = shareUrl(base, 'mandelbrot', [120], { cx: -0.743, cy: 0.131, zoom: 5 });
  assert.deepEqual(fromSearch(new URL(m).search), { fig: 'mandelbrot', p: [120], view: { cx: -0.743, cy: 0.131, zoom: 5 } });
  assert.deepEqual(fromSearch('?f=mandelbrot&p=80'), { fig: 'mandelbrot', p: [80], view: null });
  for (const q of ['', '?f=star', '?f=star&p=7', '?f=star&p=7,4', '?f=x&p=1', '?f=star&p=7,3,1', '?f=star&p=%3Cb%3E',
    '?f=mandelbrot&p=80,0,0,26', '?f=mandelbrot&p=80,9,0,1', '?f=mandelbrot&p=80,0,0']) assert.equal(fromSearch(q), null, q);
});

test('表示の要約', () => {
  assert.equal(summary('prime', FIG.prime.def), '10,000 までの素数 1,229 個');
  assert.equal(summary('multiples', [0, 3, 0, 7, 1]), '3・7 の倍数');
  assert.equal(summary('collatz', [0, 27]), '27 から 1 まで 111 歩。いちばん大きい数 9,232');
  assert.equal(summary('collatz', [1, 100]), '2〜100 の道。いちばん大きい数 9,232');
  assert.equal(summary('star', [7, 3]), '{7/3}');
  assert.equal(summary('star', [6, 2]), '{6/2}（三角形 2 つ）');
  assert.equal(summary('star', [10, 4]), '{10/4}（{5/2} 2 つ）');
  assert.equal(summary('star', [6, 3]), '{6/3}（直線 3 本）');
  assert.equal(summary('mandelbrot', [50], { cx: 0, cy: 0, zoom: 3 }), '拡大 ×27');
  assert.equal(summary('koch', [3, 0]), '段階 3・線 64 本');
  assert.equal(summary('koch', [3, 1]), '段階 3・線 192 本');
  assert.equal(summary('epicycle', [10, -3, 23, 1]), '1 周 3,600 歩');
  assert.equal(summary('chords', [1, 2]), '線 360 本');
  assert.equal(gcd(-12, 18), 6);
});
