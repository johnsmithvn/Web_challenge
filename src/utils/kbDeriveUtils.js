/**
 * kbDeriveUtils.js — Pure utility functions for Knowledge Base.
 *
 * Wiki-link parsing, graph derivation, backlink extraction, filtering.
 * No Supabase, no React — testable with node:assert.
 */

/* ── Wiki-link parsing ─────────────────────────────────────── */
const WIKI_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Extract all [[wiki-link]] titles from markdown text.
 * @param {string} md - Markdown content
 * @returns {string[]} Array of linked titles (deduped)
 */
export function parseWikiLinks(md = '') {
  const links = [];
  let m;
  while ((m = WIKI_RE.exec(md)) !== null) {
    const title = m[1].trim();
    if (title && !links.includes(title)) links.push(title);
  }
  return links;
}

/* ── Slugify (Vietnamese-safe) ─────────────────────────────── */
/**
 * Slug hóa giữ ký tự tiếng Việt.
 * @param {string} text
 * @returns {string}
 */
export function slugifyVi(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u1ef9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ── Graph derivation ──────────────────────────────────────── */
/**
 * Build a graph from articles: nodes = articles, edges = wiki + tag links.
 * @param {Array} articles - Array of article objects with id, title, body/_tags
 * @param {Object} opts
 * @param {boolean} opts.inferTagLinks - also create edges for shared tags
 * @returns {{ nodes: Array, edges: Array }}
 */
export function deriveGraph(articles, { inferTagLinks = true } = {}) {
  const titleMap = new Map(); // title → id
  articles.forEach(a => titleMap.set(a.title, a.id));

  const nodes = articles.map(a => ({
    id: a.id,
    title: a.title,
    type: a.type,
    degree: 0,
  }));

  const edgeSet = new Set();
  const edges = [];

  const addEdge = (from, to, kind) => {
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    // Prefer wiki over tag if both exist
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ from, to, kind });
  };

  // Wiki edges: parse [[…]] from body/md
  articles.forEach(a => {
    const body = a.body || '';
    const links = parseWikiLinks(body);
    links.forEach(linkTitle => {
      const targetId = titleMap.get(linkTitle);
      if (targetId && targetId !== a.id) {
        addEdge(a.id, targetId, 'wiki');
      }
    });
  });

  // Tag edges: two articles sharing at least one tag
  if (inferTagLinks) {
    for (let i = 0; i < articles.length; i++) {
      const tagsA = (articles[i]._tags || []).map(t => typeof t === 'string' ? t : t.name);
      for (let j = i + 1; j < articles.length; j++) {
        const tagsB = (articles[j]._tags || []).map(t => typeof t === 'string' ? t : t.name);
        const shared = tagsA.some(t => tagsB.includes(t));
        if (shared) {
          addEdge(articles[i].id, articles[j].id, 'tag');
        }
      }
    }
  }

  // Compute degree
  const degreeMap = {};
  edges.forEach(e => {
    degreeMap[e.from] = (degreeMap[e.from] || 0) + 1;
    degreeMap[e.to] = (degreeMap[e.to] || 0) + 1;
  });
  nodes.forEach(n => { n.degree = degreeMap[n.id] || 0; });

  return { nodes, edges };
}

/* ── Backlinks ─────────────────────────────────────────────── */
/**
 * Find all articles that contain [[title]] pointing to the given article.
 * @param {string} articleTitle - Title of the target article
 * @param {Array} allArticles - All articles to search
 * @returns {Array<{ article: Object, context: string }>}
 */
export function findBacklinks(articleTitle, allArticles) {
  if (!articleTitle) return [];
  const result = [];
  const searchTerm = `[[${articleTitle}]]`;

  allArticles.forEach(a => {
    const body = a.body || '';
    if (body.includes(searchTerm)) {
      result.push({
        article: a,
        context: extractContext(body, articleTitle),
      });
    }
  });

  return result;
}

/**
 * Extract ~120 chars of context around the first [[linkTitle]] occurrence.
 * @param {string} md
 * @param {string} linkTitle
 * @returns {string}
 */
export function extractContext(md, linkTitle) {
  const marker = `[[${linkTitle}]]`;
  const idx = md.indexOf(marker);
  if (idx < 0) return '';

  const start = Math.max(0, idx - 50);
  const end = Math.min(md.length, idx + marker.length + 70);
  let ctx = md.slice(start, end).replace(/\n+/g, ' ').trim();
  if (start > 0) ctx = '…' + ctx;
  if (end < md.length) ctx = ctx + '…';
  return ctx;
}

/* ── Outbound links ────────────────────────────────────────── */
/**
 * Get outbound wiki-links for an article, resolved to article objects.
 * @param {Object} article
 * @param {Array} allArticles
 * @returns {Array<Object>} linked articles
 */
export function getOutboundLinks(article, allArticles) {
  const links = parseWikiLinks(article.body || '');
  const titleMap = new Map(allArticles.map(a => [a.title, a]));
  return links.map(t => titleMap.get(t)).filter(Boolean);
}

/* ── Filter & sort ─────────────────────────────────────────── */
/**
 * Filter and sort articles.
 * @param {Array} articles
 * @param {Object} params
 * @param {string} params.q - search query
 * @param {string} params.type - type filter or 'all'
 * @param {string[]} params.tags - tag ids (AND logic)
 * @param {string} params.sort - 'new' | 'old' | 'long'
 * @param {string} params.taskId - filter by linked task
 * @returns {Array}
 */
export function filterArticles(articles, { q = '', type = 'all', tags = [], sort = 'new', taskId = '' } = {}) {
  let list = articles.filter(a => a.type !== 'inbox' && a.status !== 'archived');

  // Type filter
  if (type && type !== 'all') {
    list = list.filter(a => a.type === type);
  }

  // Tag filter (AND)
  if (tags.length > 0) {
    list = list.filter(a => {
      const aTags = (a._tags || []).map(t => typeof t === 'string' ? t : t.id);
      return tags.every(tagId => aTags.includes(tagId));
    });
  }

  // Task filter
  if (taskId) {
    list = list.filter(a => (a._linkedTaskIds || []).includes(taskId));
  }

  // Search
  if (q) {
    const lower = q.toLowerCase();
    if (lower.startsWith('#')) {
      const tagQ = lower.slice(1);
      list = list.filter(a =>
        (a._tags || []).some(t => (typeof t === 'string' ? t : t.name).toLowerCase().includes(tagQ))
      );
    } else {
      list = list.filter(a =>
        a.title.toLowerCase().includes(lower) ||
        (a.body || '').toLowerCase().includes(lower) ||
        (a.url || '').toLowerCase().includes(lower)
      );
    }
  }

  // Sort
  const sorted = [...list];
  if (sort === 'new' || sort === 'newest') {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (sort === 'old' || sort === 'oldest') {
    sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sort === 'long' || sort === 'longest') {
    sorted.sort((a, b) => (b.word_count || 0) - (a.word_count || 0));
  }

  return sorted;
}

/* ── Read time ─────────────────────────────────────────────── */
export function readTime(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

/* ── Markdown → plain text ─────────────────────────────────── */
export function markdownToPlainText(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // wiki-links → plain text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── Safe hostname ─────────────────────────────────────────── */
export function safeHostname(url) {
  try { return new URL(url).hostname; }
  catch { return url.replace(/^https?:\/\//, '').split('/')[0] || url; }
}

/* ── Type metadata ─────────────────────────────────────────── */
export const TYPE_GLYPHS = {
  note:          { glyph: '▤', label: 'Bài viết',  hueVar: '--kb-hue-note' },
  quote:         { glyph: '❝', label: 'Trích dẫn', hueVar: '--kb-hue-quote' },
  learn:         { glyph: '▮', label: 'Học',       hueVar: '--kb-hue-learn' },
  idea:          { glyph: '◍', label: 'Ý tưởng',   hueVar: '--kb-hue-idea' },
  ai:            { glyph: '⚙', label: 'AI',        hueVar: '--kb-hue-ai' },
  entertainment: { glyph: '▶', label: 'Giải trí',  hueVar: '--kb-hue-entertainment' },
  podcast:       { glyph: '◍', label: 'Podcast',   hueVar: '--kb-hue-podcast' },
};

/* ── Extract headings (for TOC) ────────────────────────────── */
export function extractHeadings(text) {
  const lines = (text || '').split('\n');
  const result = [];
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) result.push({ level: m[1].length, text: m[2], id: slugifyVi(m[2]) });
  }
  return result;
}

/* ── Detect Tiptap JSON body ───────────────────────────────── */
export function isTiptapBody(item) {
  if (item.content_format === 'tiptap') return true;
  if (item.content_format === 'markdown') return false;
  const b = (item.body || '').trimStart();
  return b.startsWith('{"type":"doc"');
}

/* ── Extract plain text from Tiptap JSON ───────────────────── */
export function tiptapToPlainText(body) {
  try {
    const json = typeof body === 'string' ? JSON.parse(body) : body;
    const walk = (node) => {
      if (!node) return '';
      if (node.text) return node.text;
      if (node.content) return node.content.map(walk).join(' ');
      return '';
    };
    return walk(json).trim();
  } catch { return ''; }
}

/* ── Audio URL detection ───────────────────────────────────── */
export function detectAudioUrl(body = '') {
  const match = body.match(/https?:\/\/[^\s)"]+\.(mp3|m4a|ogg|wav|aac|flac)(\?[^\s)"]*)?/i);
  return match ? match[0] : null;
}
