/**
 * creatureArt.test.js — con vật vẽ bằng code: 2 rồng (cảnh nháp dragon_v2 / dragon_v2_eu) + hồ ly 9 đuôi (kitsune, foxlant).
 * Chạy: `node src/__tests__/tasks/creatureArt.test.js`
 *
 * Trang vẽ lại path mỗi khung (rAF) theo thứ tự: số hình phải cố định ở mọi thời điểm, không NaN, gradient
 * nào được dùng phải có trong defs, và con vật phải nằm gọn trong khung (+ lề cho râu / cánh / đuôi).
 */
import assert from 'node:assert/strict';
import { DRAGON_EAST, DRAGON_WEST, FOX_9TAIL } from '../../utils/creatureArt.js';

const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);

for (const [name, C] of [['DRAGON_EAST', DRAGON_EAST], ['DRAGON_WEST', DRAGON_WEST], ['FOX_9TAIL', FOX_9TAIL]]) {
  assert.ok(C.w > 0 && C.h > 0 && C.period > 0 && Array.isArray(C.head || C.mouth), name + ' có w/h/period + mốc đầu/miệng');
  const times = Array.from({ length: 24 }, (_, i) => (i / 24) * C.period * 2.5);
  const frames = times.map((t) => C.frame(t));
  const n = frames[0].length;
  const all = [];
  for (const shapes of frames) {
    assert.equal(shapes.length, n, name + ': số hình cố định');
    for (const s of shapes) {
      assert.match(s.d, /^M/, name + ': path bắt đầu bằng M');
      assert.ok(!/NaN|Infinity|undefined/.test(s.d), name + ': không NaN ' + s.d.slice(0, 40));
      const g = /^url\(#(\w+)\)$/.exec(s.fill);
      if (g) assert.ok(C.defs.includes('id="' + g[1] + '"'), name + ': gradient ' + g[1] + ' có trong defs');
      all.push(...nums(s.d));
    }
  }
  const xs = all.filter((_, i) => i % 2 === 0), ys = all.filter((_, i) => i % 2 === 1), padX = C.w * 0.2, padY = C.h * 0.25;
  assert.ok(Math.min(...xs) > -padX && Math.max(...xs) < C.w + padX, name + ' x ' + Math.min(...xs) + '..' + Math.max(...xs));
  assert.ok(Math.min(...ys) > -padY && Math.max(...ys) < C.h + padY, name + ' y ' + Math.min(...ys) + '..' + Math.max(...ys));
  // Thực sự chuyển động: hình đổi theo thời gian
  assert.notEqual(frames[0].map((s) => s.d).join(), frames[5].map((s) => s.d).join(), name + ': có chuyển động');
  console.log(name + ': ' + n + ' hình, cố định, không NaN, gradient đủ, gọn khung, có chuyển động: OK');
}

// Cáo: chân chạm đúng mốc feet (cảnh đặt cáo theo mặt đất), không lún xuống dưới
const G = FOX_9TAIL.h / 2 + FOX_9TAIL.feet * FOX_9TAIL.h;
for (let i = 0; i < 12; i++) {
  const ys = FOX_9TAIL.frame(i * 0.05).flatMap((s) => nums(s.d)).filter((_, j) => j % 2 === 1);
  assert.ok(Math.max(...ys) < G + 9, 'cáo không lún dưới mặt đất ' + Math.max(...ys) + ' / ' + G);
}
console.log('FOX_9TAIL: chân bám mặt đất (feet): OK');

console.log('\n✅ creatureArt — 2 rồng + hồ ly 9 đuôi vẽ bằng code PASS');
