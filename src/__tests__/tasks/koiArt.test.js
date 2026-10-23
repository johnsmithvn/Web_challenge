/**
 * koiArt.test.js — cá koi uốn sóng của Rừng tiên đêm (SVG + SMIL morph path).
 * Chạy: `node src/__tests__/tasks/koiArt.test.js`
 *
 * SMIL chỉ nội suy được `d` khi mọi pha có cùng chuỗi lệnh (M/C/Z) và cùng số toạ độ; pha cuối phải
 * trùng pha đầu thì vòng quẫy mới liền. Hình học dùng lũy thừa số thực → canh NaN.
 */
import assert from 'node:assert/strict';
import { koiFrames, koiSvg, KOI_KEYS, KOI_CYCLE } from '../../utils/koiArt.js';

const groups = koiFrames();
assert.deepEqual(groups.map(([nm]) => nm), ['fin-tail', 'ray-tail', 'fin-pel', 'ray-pel', 'fin-pec', 'ray-pec', 'body', 'patch', 'sheen', 'ridge', 'eye', 'eye-hl']);
const paths = groups.flatMap(([, ps]) => ps);
assert.equal(paths.length, 49);

const cmds = (d) => d.replace(/[^MCZ]/g, '');
const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
for (const ds of paths) {
  assert.equal(ds.length, KOI_KEYS + 1);
  assert.equal(ds[KOI_KEYS], ds[0], 'pha cuối = pha đầu');
  for (const d of ds) {
    assert.equal(cmds(d), cmds(ds[0]), 'cùng chuỗi lệnh ở mọi pha');
    assert.equal(nums(d).length, nums(ds[0]).length);
    assert.ok(!d.includes('NaN') && !d.includes('Infinity'), d.slice(0, 40));
  }
}
console.log('koiFrames: 49 path × 13 pha, morph được, lặp liền: OK');

// Cá nằm trong khung 240×140 ở mọi pha (vây xoè tối đa, đuôi lắc tối đa)
const all = paths.flatMap((ds) => ds.flatMap(nums));
const xs = all.filter((_, i) => i % 2 === 0), ys = all.filter((_, i) => i % 2 === 1);
assert.ok(Math.min(...xs) > 0 && Math.max(...xs) < 240, `x ${Math.min(...xs)}..${Math.max(...xs)}`);
assert.ok(Math.min(...ys) > 0 && Math.max(...ys) < 140, `y ${Math.min(...ys)}..${Math.max(...ys)}`);
// Thân uốn thật: chóp đuôi lệch khỏi trục giữa ở ít nhất một pha
const tailTipY = groups[0][1][0].map((d) => nums(d)[1]);
assert.ok(Math.max(...tailTipY) - Math.min(...tailTipY) > 10, 'đuôi lắc');
console.log('koiFrames: nằm gọn trong khung, đuôi lắc: OK');

const svg = koiSvg({ width: 120, height: 70, css: 'position:absolute', begin: 0.3 });
assert.match(svg, /^<svg width="120" height="70" viewBox="0 0 240 140" style="position:absolute">/);
assert.equal(svg.match(/<animate /g).length, 49);
assert.equal(svg.match(/begin="-0\.30s"/g).length, 49);
assert.ok(svg.includes(`dur="${KOI_CYCLE}s"`) && !svg.includes('@B'));
assert.ok(koiSvg({ width: 1, height: 1, begin: 0.9 }).includes('begin="-0.90s"'), 'mỗi con lệch pha riêng');
console.log('koiSvg: kích thước, 49 animate, lệch pha: OK');

console.log('\n✅ koiArt — cá koi uốn sóng PASS');
