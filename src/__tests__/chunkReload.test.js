/**
 * Nhận diện lỗi "chunk cũ đã biến mất sau khi deploy".
 *
 * Regex này là thứ quyết định user thấy màn lỗi kỹ thuật hay được tự tải lại trang.
 * Mỗi trình duyệt viết một kiểu, nên phải giữ đủ cả ba biến thể — sai một chữ là
 * người dùng kẹt ở màn "Có lỗi xảy ra" cho tới khi tự F5.
 */
import assert from 'node:assert/strict';
import { isStaleChunkError } from '../utils/chunkReload.js';

// Chrome / Edge
assert.ok(isStaleChunkError(new Error(
  'Failed to fetch dynamically imported module: https://app.vercel.app/assets/AccountsPage-Bo0yTYUE.js')));
// Firefox
assert.ok(isStaleChunkError(new Error(
  'error loading dynamically imported module: https://app.vercel.app/assets/FinancePage-x1.js')));
// Safari
assert.ok(isStaleChunkError(new Error('Importing a module script failed.')));
// Chuỗi trần (một số đường ném ra string chứ không phải Error)
assert.ok(isStaleChunkError('Failed to fetch dynamically imported module'));

// KHÔNG được nuốt lỗi thật thành "app vừa cập nhật" rồi reload vô tận.
assert.equal(isStaleChunkError(new Error('Cannot read properties of undefined')), false);
assert.equal(isStaleChunkError(new Error('Network request failed')), false);
assert.equal(isStaleChunkError(new TypeError('fin.transactions is not iterable')), false);
assert.equal(isStaleChunkError(null), false);
assert.equal(isStaleChunkError(undefined), false);
assert.equal(isStaleChunkError({}), false);

console.log('chunkReload check: OK');
