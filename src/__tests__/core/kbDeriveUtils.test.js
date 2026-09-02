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
  getOutboundLinks,
  filterArticles,
  readTime,
  markdownToPlainText,
  extractHeadings,
  isTiptapBody,
} from '../../utils/kbDeriveUtils.js';

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

console.log('\n✅ All kbDeriveUtils checks passed.');
