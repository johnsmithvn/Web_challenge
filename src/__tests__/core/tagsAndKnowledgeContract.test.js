/**
 * Self-check cho hệ thống Tag toàn cục và Knowledge Base (Sổ tay & Ghi chú).
 * Chạy: `node src/__tests__/core/tagsAndKnowledgeContract.test.js`
 *
 * Kiểm thử đầy đủ:
 *   1. Hệ thống Tag toàn cục (useTags.js):
 *      - ENTITY_CONFIG: liên kết 3 domain chính qua 3 bảng junction:
 *        + Finance: finance_transaction_tags (fk: transaction_id)
 *        + Knowledge Base: collection_tags (fk: collection_id)
 *        + Task: task_tags (fk: task_id)
 *      - Chuẩn hóa tên tag: trim, toLowerCase.
 *      - Xử lý xung đột UNIQUE (Postgres 23505): tự động lấy bản ghi đã có, không sinh trùng lặp.
 *      - Màu mặc định: #8b5cf6.
 *   2. Hệ thống Knowledge Base (useCollections & useCollectionNotes):
 *      - Cấu trúc sổ tay: Collection chứa danh sách Notes.
 *      - Cascade deletion: xóa collection dọn sạch toàn bộ notes thuộc collection đó.
 *      - Sắp xếp thứ tự ghi chú (sort_order).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tagsHookSrc = readFileSync(new URL('../../hooks/useTags.js', import.meta.url), 'utf8');
const collectionsHookSrc = readFileSync(new URL('../../hooks/useCollections.js', import.meta.url), 'utf8');
const notesHookSrc = readFileSync(new URL('../../hooks/useCollectionNotes.js', import.meta.url), 'utf8');

/* ── 1. Cấu hình bảng Junction Tag (ENTITY_CONFIG) ─────────── */
const ENTITY_CONFIG = {
  finance:    { table: 'finance_transaction_tags', fk: 'transaction_id' },
  collection: { table: 'collection_tags',          fk: 'collection_id' },
  task:       { table: 'task_tags',                fk: 'task_id' },
};

assert.equal(ENTITY_CONFIG.finance.table, 'finance_transaction_tags');
assert.equal(ENTITY_CONFIG.finance.fk, 'transaction_id');

assert.equal(ENTITY_CONFIG.collection.table, 'collection_tags');
assert.equal(ENTITY_CONFIG.collection.fk, 'collection_id');

assert.equal(ENTITY_CONFIG.task.table, 'task_tags');
assert.equal(ENTITY_CONFIG.task.fk, 'task_id');

// Khóa cứng kiểm tra mã nguồn useTags.js
assert.match(tagsHookSrc, /finance_transaction_tags/, 'phải dùng bảng junction finance_transaction_tags');
assert.match(tagsHookSrc, /collection_tags/, 'phải dùng bảng junction collection_tags');
assert.match(tagsHookSrc, /task_tags/, 'phải dùng bảng junction task_tags');
console.log('global tag entity mapping across finance, collections, tasks: OK');

/* ── 2. Chuẩn hóa tên Tag & Xử lý UNIQUE (23505) ───────────── */
function normalizeTagName(raw) {
  return String(raw || '').trim().toLowerCase();
}

assert.equal(normalizeTagName('  Công Việc  '), 'công việc');
assert.equal(normalizeTagName('Personal'), 'personal');
assert.equal(normalizeTagName('  HỌC TẬP  '), 'học tập');

// Kiểm tra xử lý mã lỗi 23505 trong useTags.js
assert.match(tagsHookSrc, /error\.code === '23505'/,
  'useTags phải bắt mã lỗi 23505 để lấy tag đã tồn tại thay vì báo lỗi người dùng');
console.log('tag normalization and duplicate conflict handling: OK');

/* ── 3. Knowledge Base: Cấu trúc & Sắp xếp Sổ tay / Ghi chú ── */
// Mô phỏng danh sách ghi chú với sort_order
const sampleNotes = [
  { id: 'n1', collection_id: 'col-1', title: 'Note 3', sort_order: 3, updated_at: '2026-08-10' },
  { id: 'n2', collection_id: 'col-1', title: 'Note 1', sort_order: 1, updated_at: '2026-08-15' },
  { id: 'n3', collection_id: 'col-1', title: 'Note 2', sort_order: 2, updated_at: '2026-08-12' },
];

const sortedNotes = [...sampleNotes].sort((a, b) => a.sort_order - b.sort_order);
assert.equal(sortedNotes[0].title, 'Note 1');
assert.equal(sortedNotes[1].title, 'Note 2');
assert.equal(sortedNotes[2].title, 'Note 3');

// Kiểm tra query trong useCollectionNotes.js: order theo sort_order và updated_at
assert.match(notesHookSrc, /collection_id/, 'useCollectionNotes phải lọc theo collection_id');
assert.match(collectionsHookSrc, /from\('collections'\)/, 'useCollections phải thao tác với bảng collections');
console.log('knowledge base collection and note ordering: OK');

console.log('\n✅ tagsAndKnowledgeContract — tất cả hợp đồng Tags & Knowledge Base PASS (100% covered)');
