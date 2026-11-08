/**
 * snippetUtils.test.js — Sổ lệnh: kiểm dữ liệu, tìm, nhóm, Hay dùng, chip công cụ.
 *
 * Run: node src/__tests__/core/snippetUtils.test.js
 */
import assert from 'node:assert/strict';
import { cleanSnippet, filterSnippets, groupSnippets, topSnippets, countTools, UNGROUPED_LABEL } from '../../utils/snippetUtils.js';

const s = (id, title, extra = {}) => ({
  id, title, code: 'echo', tool: '', group_name: '', note: '', warning: '', copy_count: 0, ...extra,
});

// cleanSnippet
assert.deepEqual(cleanSnippet({ title: '  ', code: 'x' }), { error: 'Ghi tên việc cần làm.' });
assert.deepEqual(cleanSnippet({ title: 'A', code: ' \n  ' }), { error: 'Dán lệnh hoặc code vào.' });
{
  const { value } = cleanSnippet({ title: ' Đổi đuôi ', code: '\n  Sub A()\n    x\nEnd Sub\n\n', tool: ' CMD ', group_name: ' Tên file ' });
  assert.equal(value.title, 'Đổi đuôi');
  assert.equal(value.code, '  Sub A()\n    x\nEnd Sub', 'giữ thụt lề dòng đầu, bỏ dòng trống hai đầu');
  assert.equal(value.tool, 'cmd');
  assert.equal(value.group_name, 'Tên file');
  assert.equal(value.note, '');
}
assert.match(cleanSnippet({ title: 'A', code: 'x', group_name: 'x'.repeat(41) }).error, /nhóm quá dài/);
assert.equal(cleanSnippet({ title: 'A', code: 'x', note: '\n Sửa:\n- D:\\media\n- "Xem"\n\n' }).value.note,
  'Sửa:\n- D:\\media\n- "Xem"', 'ghi chú giữ xuống dòng bên trong, bỏ khoảng trống hai đầu');

// filterSnippets
const list = [
  s(1, 'Đổi đuôi hàng loạt file', { code: 'ren *.png *.jpg', tool: 'cmd', group_name: 'Tên file' }),
  s(2, 'Ghép audio vào video', { code: 'ffmpeg -i 1.mp4 -i 2.ts', tool: 'ffmpeg', group_name: 'Video', copy_count: 3 }),
  s(3, 'Xoá hết ảnh', { code: 'del /s /f *.jpg', tool: 'cmd', warning: 'Xoá thật', copy_count: 3 }),
  s(4, 'Bật tắt gì đó', { tool: 'cmd', group_name: 'Tên file', copy_count: 9 }),
];
assert.deepEqual(filterSnippets(list, { q: 'doi duoi' }).map(x => x.id), [1], 'không dấu');
assert.deepEqual(filterSnippets(list, { q: 'jpg' }).map(x => x.id), [1, 3], 'khớp cả nội dung lệnh');
assert.deepEqual(filterSnippets(list, { q: 'xoa that' }).map(x => x.id), [3], 'khớp cảnh báo');
assert.deepEqual(filterSnippets(list, { q: 'video ffmpeg' }).map(x => x.id), [2], 'mọi từ phải khớp');
assert.deepEqual(filterSnippets(list, { q: 'jpg', tool: 'ffmpeg' }), []);
assert.deepEqual(filterSnippets(list, { tool: 'cmd' }).map(x => x.id), [1, 3, 4]);
assert.equal(filterSnippets(list).length, 4);

// groupSnippets: nhóm theo tên, Chưa xếp cuối, lệnh trong nhóm theo tên
const groups = groupSnippets(list);
assert.deepEqual(groups.map(g => g.label), ['Tên file', 'Video', UNGROUPED_LABEL]);
assert.deepEqual(groups[0].items.map(x => x.id), [4, 1]);
assert.equal(groups[2].name, '');

// topSnippets: nhiều trước, hoà thì theo tên, bỏ lệnh chưa copy
assert.deepEqual(topSnippets(list).map(x => x.id), [4, 2, 3]);
assert.deepEqual(topSnippets(list, 1).map(x => x.id), [4]);
assert.deepEqual(topSnippets([s(9, 'A')]), []);

// countTools
assert.deepEqual(countTools(list), [{ tool: 'cmd', count: 3 }, { tool: 'ffmpeg', count: 1 }]);
assert.deepEqual(countTools([s(9, 'A')]), []);

console.log('snippetUtils check: OK');
