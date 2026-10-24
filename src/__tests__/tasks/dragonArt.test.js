/**
 * dragonArt.test.js — 2 rồng vẽ bằng code (cảnh nháp dragon_v2 / dragon_v2_eu của Rừng tiên đêm).
 * Chạy: `node src/__tests__/tasks/dragonArt.test.js`
 *
 * Trang vẽ lại path mỗi khung (rAF) theo thứ tự: số hình phải cố định ở mọi thời điểm, không NaN, gradient
 * nào được dùng phải có trong defs, và rồng phải nằm gọn trong khung (+ lề cho râu / cánh).
 */
import assert from 'node:assert/strict';
import { DRAGON_EAST, DRAGON_WEST } from '../../utils/dragonArt.js';

for (const [name, C] of [['DRAGON_EAST', DRAGON_EAST], ['DRAGON_WEST', DRAGON_WEST]]) {
  assert.ok(C.w > 0 && C.h > 0 && C.period > 0 && Array.isArray(C.head), name + ' có w/h/period/head');
  const times = Array.from({ length: 24 }, (_, i) => (i / 24) * C.period * 2.5);
  const frames = times.map((t) => C.frame(t));
  const n = frames[0].length;
  const nums = [];
  for (const shapes of frames) {
    assert.equal(shapes.length, n, name + ': số hình cố định');
    for (const s of shapes) {
      assert.match(s.d, /^M/, name + ': path bắt đầu bằng M');
      assert.ok(!/NaN|Infinity|undefined/.test(s.d), name + ': không NaN ' + s.d.slice(0, 40));
      const g = /^url\(#(\w+)\)$/.exec(s.fill);
      if (g) assert.ok(C.defs.includes('id="' + g[1] + '"'), name + ': gradient ' + g[1] + ' có trong defs');
      nums.push(...s.d.match(/-?\d+(\.\d+)?/g).map(Number));
    }
  }
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1), padX = C.w * 0.2, padY = C.h * 0.25;
  assert.ok(Math.min(...xs) > -padX && Math.max(...xs) < C.w + padX, name + ' x ' + Math.min(...xs) + '..' + Math.max(...xs));
  assert.ok(Math.min(...ys) > -padY && Math.max(...ys) < C.h + padY, name + ' y ' + Math.min(...ys) + '..' + Math.max(...ys));
  // Thực sự chuyển động: thân (hình lớn nhất) đổi theo thời gian
  assert.notEqual(frames[0].map((s) => s.d).join(), frames[5].map((s) => s.d).join(), name + ': có chuyển động');
  console.log(name + ': ' + n + ' hình, cố định, không NaN, gradient đủ, gọn khung, có chuyển động: OK');
}

console.log('\n✅ dragonArt — 2 rồng vẽ bằng code PASS');
