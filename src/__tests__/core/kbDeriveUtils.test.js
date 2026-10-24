/**
 * kbDeriveUtils.test.js — Self-check for KB pure utilities.
 *
 * Run: node src/__tests__/core/kbDeriveUtils.test.js
 */
import assert from 'node:assert/strict';
import {
  parseWikiLinks,
  slugifyVi,
  deriveGraph,
  findBacklinks,
  extractContext,
  filterArticles,
  readTime,
  markdownToPlainText,
  extractHeadings,
  isTiptapBody,
  normalizeVi,
  contentKind,
  sourceKey,
  guessTitle,
  progressOf,
  isStale,
  findNeighbors,
  suggestTopic,
  pickResurface,
  pushRecent,
} from '../../utils/kbDeriveUtils.js';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const daysAgo = d => new Date(NOW - d * 86400000).toISOString();

/* ── parseWikiLinks ────────────────────────────────────────── */
{
  const r1 = parseWikiLinks('Hello [[World]] and [[Test]]');
  assert.deepEqual(r1, ['World', 'Test']);

  // Dedup
  const r2 = parseWikiLinks('[[A]] then [[A]] again');
  assert.deepEqual(r2, ['A']);

  // Empty
  assert.deepEqual(parseWikiLinks(''), []);
  assert.deepEqual(parseWikiLinks('no links here'), []);

  // Nested brackets — should NOT match
  assert.deepEqual(parseWikiLinks('[not a link]'), []);

  // Trims whitespace
  const r3 = parseWikiLinks('[[ Spaced Title ]]');
  assert.deepEqual(r3, ['Spaced Title']);

  console.log('parseWikiLinks: OK');
}

/* ── slugifyVi ─────────────────────────────────────────────── */
{
  assert.equal(slugifyVi('Xin Chào Thế Giới'), 'xin-chào-thế-giới');
  assert.equal(slugifyVi('Hello World!'), 'hello-world');
  assert.equal(slugifyVi('  leading and trailing  '), 'leading-and-trailing');
  assert.equal(slugifyVi('Phần Mềm & Công Nghệ'), 'phần-mềm--công-nghệ'.replace('--', '-'));
  console.log('slugifyVi: OK');
}

/* ── deriveGraph ───────────────────────────────────────────── */
{
  const arts = [
    { id: '1', title: 'Alpha', type: 'note', body: 'Intro to [[Beta]]', _tags: [{ name: 'learn', id: 't1' }] },
    { id: '2', title: 'Beta', type: 'note', body: 'About [[Alpha]]', _tags: [{ name: 'learn', id: 't1' }] },
    { id: '3', title: 'Gamma', type: 'quote', body: 'Standalone', _tags: [{ name: 'other', id: 't2' }] },
  ];

  const g = deriveGraph(arts, { inferTagLinks: true });
  assert.equal(g.nodes.length, 3);
  // Wiki edge: Alpha ↔ Beta (deduped to 1)
  const wikiEdges = g.edges.filter(e => e.kind === 'wiki');
  assert.equal(wikiEdges.length, 1);
  // Tag edge: Alpha ↔ Beta share 'learn'
  const tagEdges = g.edges.filter(e => e.kind === 'tag');
  // Wiki already connected Alpha ↔ Beta, tag edge should be deduped
  assert.equal(tagEdges.length, 0);

  // Gamma should have degree 0
  const gamma = g.nodes.find(n => n.id === '3');
  assert.equal(gamma.degree, 0);

  // Without tag links
  const g2 = deriveGraph(arts, { inferTagLinks: false });
  assert.equal(g2.edges.filter(e => e.kind === 'tag').length, 0);

  console.log('deriveGraph: OK');
}

/* ── findBacklinks + extractContext ─────────────────────────── */
{
  const arts = [
    { id: '1', title: 'Target', body: 'I am the target' },
    { id: '2', title: 'Source', body: 'Look at [[Target]] for more info' },
    { id: '3', title: 'Other', body: 'Nothing relevant' },
  ];

  const bl = findBacklinks('Target', arts);
  assert.equal(bl.length, 1);
  assert.equal(bl[0].article.id, '2');
  assert.ok(bl[0].context.includes('[[Target]]'));

  // No backlinks
  assert.deepEqual(findBacklinks('Nonexistent', arts), []);

  // extractContext
  const ctx = extractContext('prefix text [[Link]] suffix text', 'Link');
  assert.ok(ctx.includes('[[Link]]'));

  console.log('findBacklinks + extractContext: OK');
}

/* ── filterArticles ────────────────────────────────────────── */
{
  const arts = [
    { id: '1', title: 'Learn React', type: 'learn', status: 'unread', body: 'React hooks', created_at: '2026-01-02', word_count: 500, _tags: [{ id: 't1', name: 'code' }], _linkedTaskIds: [] },
    { id: '2', title: 'Quote of day', type: 'quote', status: 'read', body: 'Be kind', created_at: '2026-01-01', word_count: 10, _tags: [{ id: 't2', name: 'wisdom' }], _linkedTaskIds: [] },
    { id: '3', title: 'Inbox item', type: 'inbox', status: 'inbox', body: '', created_at: '2026-01-03', word_count: 0, _tags: [], _linkedTaskIds: [] },
    { id: '4', title: 'Archived', type: 'note', status: 'archived', body: '', created_at: '2026-01-04', word_count: 0, _tags: [], _linkedTaskIds: [] },
  ];

  // Default: exclude inbox + archived
  const all = filterArticles(arts);
  assert.equal(all.length, 2);

  // Type filter
  const quotes = filterArticles(arts, { type: 'quote' });
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].id, '2');

  // Search
  const search = filterArticles(arts, { q: 'react' });
  assert.equal(search.length, 1);
  assert.equal(search[0].id, '1');

  // Tag search with #
  const tagSearch = filterArticles(arts, { q: '#wis' });
  assert.equal(tagSearch.length, 1);

  // Sort newest
  const newest = filterArticles(arts, { sort: 'new' });
  assert.equal(newest[0].id, '1');

  // Sort oldest
  const oldest = filterArticles(arts, { sort: 'old' });
  assert.equal(oldest[0].id, '2');

  // Sort longest
  const longest = filterArticles(arts, { sort: 'long' });
  assert.equal(longest[0].id, '1');

  console.log('filterArticles: OK');
}

/* ── readTime ──────────────────────────────────────────────── */
{
  assert.equal(readTime(''), 1);
  assert.equal(readTime('word '.repeat(220)), 1);
  assert.equal(readTime('word '.repeat(440)), 2);
  console.log('readTime: OK');
}

/* ── markdownToPlainText ───────────────────────────────────── */
{
  const md = '# Title\n\n**Bold** and *italic*\n\n[[Wiki Link]]\n\n```\ncode\n```';
  const plain = markdownToPlainText(md);
  assert.ok(!plain.includes('#'));
  assert.ok(!plain.includes('**'));
  assert.ok(!plain.includes('[['));
  assert.ok(plain.includes('Wiki Link'));
  console.log('markdownToPlainText: OK');
}

/* ── extractHeadings ───────────────────────────────────────── */
{
  const md = '# Title\n## Section 1\n### Sub 1.1\n## Section 2\n```\n## Not a heading\n```';
  const h = extractHeadings(md);
  assert.equal(h.length, 4);
  assert.equal(h[0].level, 1);
  assert.equal(h[1].level, 2);
  assert.equal(h[2].level, 3);
  console.log('extractHeadings: OK');
}

/* ── isTiptapBody ──────────────────────────────────────────── */
{
  assert.equal(isTiptapBody({ content_format: 'tiptap', body: '' }), true);
  assert.equal(isTiptapBody({ content_format: 'markdown', body: '' }), false);
  assert.equal(isTiptapBody({ body: '{"type":"doc","content":[]}' }), true);
  assert.equal(isTiptapBody({ body: '## Hello' }), false);
  console.log('isTiptapBody: OK');
}

/* ── normalizeVi ───────────────────────────────────────────── */
{
  assert.equal(normalizeVi('Tâm Lý'), 'tam ly');
  assert.equal(normalizeVi('Đường đi'), 'duong di');
  assert.equal(normalizeVi('Học tập & Năng suất'), 'hoc tap & nang suat');
  assert.equal(normalizeVi(), '');
  console.log('normalizeVi: OK');
}

/* ── contentKind ───────────────────────────────────────────── */
{
  const k = (url, type = 'note') => contentKind({ url, type });
  assert.equal(k('https://github.com/browser-use/browser-use'), 'repo');
  assert.equal(k('github.com/owner/repo'), 'repo', 'link thiếu https vẫn nhận');
  assert.equal(k('https://github.com/topics/ai'), 'article', '/topics không phải repo');
  assert.equal(k('https://youtu.be/dQw4w9WgXcQ'), 'video');
  assert.equal(k('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'video');
  assert.equal(k('https://drive.google.com/file/d/XYZ/view'), 'audio', 'Drive mặc định audio như MediaPreview');
  assert.equal(k('https://drive.google.com/file/d/XYZ/view#video'), 'video');
  assert.equal(k('https://cdn.example.com/ep1.mp3'), 'audio');
  assert.equal(k('https://www.facebook.com/tuan.nguyen/posts/123'), 'fb');
  assert.equal(k('https://fb.watch/abc'), 'fb');
  assert.equal(k('https://m.facebook.com/story.php?id=1'), 'fb');
  assert.equal(k('https://spiderum.com/bai-dang/x'), 'article');
  assert.equal(k(''), 'note');
  assert.equal(k('', 'quote'), 'quote');
  assert.equal(k('https://example.com', 'quote'), 'quote', 'quote thắng url');
  console.log('contentKind: OK');
}

/* ── sourceKey ─────────────────────────────────────────────── */
{
  assert.equal(sourceKey('https://github.com/browser-use/web-ui'), 'github.com/browser-use');
  assert.equal(sourceKey('https://github.com/Browser-Use/browser-use'), 'github.com/browser-use');
  assert.equal(sourceKey('https://github.com/topics/ai'), null);
  assert.equal(sourceKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), null, 'YouTube không có kênh trong URL');
  assert.equal(sourceKey('https://www.facebook.com/groups/123/posts/9'), 'facebook.com/groups/123');
  assert.equal(sourceKey('https://facebook.com/share/p/xyz'), null);
  assert.equal(sourceKey('https://www.facebook.com/tuan.nguyen/posts/1'), 'facebook.com/tuan.nguyen');
  assert.equal(sourceKey('https://www.spiderum.com/a'), 'spiderum.com');
  assert.equal(sourceKey('%% not a url'), null);
  assert.equal(sourceKey(''), null);
  console.log('sourceKey: OK');
}

/* ── guessTitle ────────────────────────────────────────────── */
{
  assert.equal(guessTitle('https://github.com/browser-use/browser-use'), 'browser-use/browser-use');
  assert.equal(guessTitle('https://github.com/a/b.git'), 'a/b');
  assert.equal(guessTitle('https://youtu.be/dQw4w9WgXcQ'), 'Video YouTube');
  assert.equal(guessTitle('https://www.facebook.com/x/posts/1'), 'Bài Facebook');
  assert.equal(guessTitle('https://www.fs.blog/feynman-technique/'), 'fs.blog');
  assert.equal(guessTitle(''), '');
  console.log('guessTitle: OK');
}

/* ── progressOf + isStale ──────────────────────────────────── */
{
  const pending = new Set(['t1']);
  assert.equal(progressOf({ status: 'archived', _linkedTaskIds: ['t1'] }, pending), 'archived');
  assert.equal(progressOf({ status: 'read', _linkedTaskIds: ['t1', 't2'] }, pending), 'practicing');
  assert.equal(progressOf({ status: 'read', _linkedTaskIds: ['t2'] }, pending), 'practiced', 'task nối mà không còn chưa xong ⇒ đã xong');
  assert.equal(progressOf({ status: 'read', _noteCount: 1 }, pending), 'noted');
  assert.equal(progressOf({ status: 'unread', _noteCount: 2 }), 'noted', 'có ghi chú tính là đã rút ra');
  assert.equal(progressOf({ status: 'read' }), 'read');
  assert.equal(progressOf({ status: 'unread' }), 'unread');

  assert.equal(isStale({ status: 'unread', created_at: daysAgo(30) }, NOW), false, 'đúng 30 ngày chưa tính là lâu');
  assert.equal(isStale({ status: 'unread', created_at: daysAgo(31) }, NOW), true);
  assert.equal(isStale({ status: 'read', created_at: daysAgo(40) }, NOW), false);
  console.log('progressOf + isStale: OK');
}

/* ── filterArticles: search, topic, kind, time, archived ───── */
{
  const tiptap = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung' }] }] });
  const arts = [
    { id: 'a', title: 'Tâm lý học hành vi', type: 'note', status: 'read', body: '', created_at: daysAgo(5), topic_id: 'T1', _topic: { name: 'Tâm lý & Con người' } },
    { id: 'b', title: 'Bài Visual', type: 'note', status: 'read', body: tiptap, body_text: 'Nội dung', content_format: 'tiptap', created_at: daysAgo(8), topic_id: null },
    { id: 'c', title: 'Kỹ thuật', type: 'note', status: 'unread', url: 'https://github.com/x/y', body: '', created_at: daysAgo(100), topic_id: 'T2', _notes: [{ content: 'Giảng lại như Feynman' }] },
    { id: 'd', title: 'Đã cất', type: 'note', status: 'archived', body: '', created_at: daysAgo(3), topic_id: 'T1' },
  ];
  const ids = list => list.map(a => a.id).sort().join(',');
  const f = (opts) => ids(filterArticles(arts, { now: NOW, ...opts }));

  assert.equal(f({ q: 'tam ly' }), 'a', 'không dấu khớp có dấu');
  assert.equal(f({ q: 'TÂM hanh' }), 'a', 'nhiều từ, mọi từ phải khớp');
  assert.equal(f({ q: 'tam react' }), '', 'một từ không khớp là loại');
  assert.equal(f({ q: 'paragraph' }), '', 'không tìm trong JSON thô của bài Visual');
  assert.equal(f({ q: 'noi dung' }), 'b', 'tìm trên body_text');
  assert.equal(f({ q: 'feynman' }), 'c', 'tìm trong ghi chú cá nhân');
  assert.equal(f({ q: 'con nguoi' }), 'a', 'tìm theo tên chủ đề');
  assert.equal(f({ topic: 'T1' }), 'a', 'lọc chủ đề, bỏ bài lưu trữ');
  assert.equal(f({ topic: 'none' }), 'b');
  assert.equal(f({ kind: 'repo' }), 'c');
  assert.equal(f({ time: '7' }), 'a');
  assert.equal(f({ time: '30' }), 'a,b');
  assert.equal(f({ time: 'old' }), 'c');
  assert.equal(f({ archived: true, topic: 'T1' }), 'a,d', 'gồm cả đã lưu trữ');
  console.log('filterArticles (v2): OK');
}

/* ── findNeighbors ─────────────────────────────────────────── */
{
  const all = [
    { id: 'A', topic_id: 'T1', url: 'https://github.com/x/one', created_at: daysAgo(10) },
    { id: 'B', topic_id: 'T1', url: 'https://github.com/x/two', created_at: daysAgo(9) },
    { id: 'C', topic_id: 'T2', url: 'https://github.com/x/three', created_at: daysAgo(30) },
    { id: 'D', topic_id: 'T2', url: 'https://other.com/a', created_at: daysAgo(12) },
    { id: 'E', topic_id: 'T1', url: '', created_at: daysAgo(50) },
    { id: 'F', topic_id: 'T2', url: '', created_at: daysAgo(40) },
    { id: 'G', topic_id: 'T2', url: '', created_at: daysAgo(11), status: 'archived' },
  ];
  const n = findNeighbors(all[0], all);
  assert.deepEqual(n.sameTopic.map(a => a.id), ['B', 'E'], 'cùng chủ đề, mới trước');
  assert.deepEqual(n.sameSource.map(a => a.id), ['C'], 'cùng chủ repo, trừ bài đã ở nhóm trên');
  assert.deepEqual(n.nearTime.map(a => a.id), ['D'], '±7 ngày, khác chủ đề, bỏ bài lưu trữ');

  const loose = findNeighbors({ id: 'Z', topic_id: null, url: '', created_at: daysAgo(10) }, all);
  assert.deepEqual(loose.sameTopic, []);
  assert.deepEqual(loose.nearTime.map(a => a.id), ['A', 'B', 'D'], 'bài chưa có chủ đề: gần thời điểm, gần nhất trước');
  console.log('findNeighbors: OK');
}

/* ── suggestTopic ──────────────────────────────────────────── */
{
  const topics = [
    { id: 'AI', name: 'Công nghệ & AI' },
    { id: 'TL', name: 'Tâm lý & Con người' },
    { id: 'GT', name: 'Giải trí' },
  ];
  const repo = (id, owner, topic) => ({ id, url: `https://github.com/${owner}/r${id}`, topic_id: topic, type: 'note' });

  const bySource = [repo('1', 'x', 'TL'), repo('2', 'x', 'TL'), repo('3', 'y', 'AI')];
  assert.equal(suggestTopic({ url: 'https://github.com/x/new', type: 'note' }, bySource, topics), 'TL', 'cùng nguồn thắng');

  const byKind = [repo('1', 'a', 'AI'), repo('2', 'b', 'AI'), repo('3', 'c', 'AI'), repo('4', 'd', 'TL')];
  assert.equal(suggestTopic({ url: 'https://github.com/new/thing', type: 'note' }, byKind, topics), 'AI', 'repo dồn ở một chủ đề');

  const split = [repo('1', 'a', 'AI'), repo('2', 'b', 'TL'), repo('3', 'c', 'AI'), repo('4', 'd', 'TL')];
  assert.equal(suggestTopic({ url: 'https://github.com/new/thing', type: 'note' }, split, topics), null, 'chia đều thì không đoán');

  assert.equal(suggestTopic({ title: 'Một bài tâm lý hay', type: 'note' }, [], topics), 'TL', 'tên chủ đề xuất hiện trong tiêu đề');
  assert.equal(suggestTopic({ title: 'Tâm lý khi giải trí', type: 'note' }, [], topics), null, 'khớp hai chủ đề thì không đoán');
  assert.equal(suggestTopic({ title: 'Ai cũng biết', type: 'note' }, [], topics), null, 'chữ "ai" quá ngắn, không tính');
  assert.equal(suggestTopic({ title: 'Không liên quan', type: 'note' }, [], topics), null);
  console.log('suggestTopic: OK');
}

/* ── pickResurface ─────────────────────────────────────────── */
{
  const items = [
    { id: 'own', url: '', type: 'note', created_at: daysAgo(60) },
    { id: 'bare', url: 'https://x.com', type: 'note', created_at: daysAgo(60) },
    { id: 'noted', url: 'https://x.com/2', type: 'note', _noteCount: 1, created_at: daysAgo(90) },
    { id: 'quote', url: 'https://x.com/3', type: 'quote', created_at: daysAgo(45) },
    { id: 'fresh', url: '', type: 'note', created_at: daysAgo(5) },
    { id: 'gone', url: '', type: 'note', status: 'archived', created_at: daysAgo(70) },
  ];
  const day1 = pickResurface(items, '2026-10-24', 3, NOW).map(a => a.id);
  assert.deepEqual([...day1].sort(), ['noted', 'own', 'quote'], 'chỉ bài cũ đáng đọc lại, không link trơn');
  assert.deepEqual(pickResurface(items, '2026-10-24', 3, NOW).map(a => a.id), day1, 'cùng ngày cùng kết quả');
  assert.equal(pickResurface(items, '2026-10-24', 2, NOW).length, 2);
  console.log('pickResurface: OK');
}

/* ── pushRecent ────────────────────────────────────────────── */
{
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
  assert.deepEqual(pushRecent(['a', 'b'], 'z', 2), ['z', 'a']);
  assert.deepEqual(pushRecent([], 'a'), ['a']);
  console.log('pushRecent: OK');
}

console.log('\n✅ All kbDeriveUtils checks passed.');
