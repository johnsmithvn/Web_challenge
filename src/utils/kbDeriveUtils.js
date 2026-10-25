/**
 * kbDeriveUtils.js — Pure utility functions for Knowledge Base.
 *
 * Wiki-link parsing, graph derivation, backlink extraction, filtering,
 * content kind / source, neighbors, topic suggestion, resurfacing.
 * No Supabase, no React — testable with node:assert.
 */
import { getMediaType, normalizeHttpUrl } from './mediaUtils.js';

const DAY_MS = 86400000;

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
    topic_id: a.topic_id || null,
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

/* ── Vietnamese-insensitive text ───────────────────────────── */
/**
 * Bỏ dấu tiếng Việt + chữ thường, để "tam ly" khớp "Tâm Lý".
 * @param {string} s
 * @returns {string}
 */
export function normalizeVi(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

/** Plain text of an item: body_text if saved, else derived from Tiptap JSON / Markdown. */
export function itemPlainText(item) {
  if (item.body_text) return item.body_text;
  return isTiptapBody(item) ? tiptapToPlainText(item.body) : markdownToPlainText(item.body || '');
}

/** Whole days since `created_at` (0 = today). */
export function ageDays(item, now = Date.now()) {
  return Math.floor((now - Date.parse(item.created_at)) / DAY_MS);
}

/** "Ghi chú của tôi": your own words — a note / quote without a link, or any bài you wrote notes on. */
export function isMine(item) {
  return !item.url || (item._noteCount || 0) > 0;
}

/* ── Filter & sort ─────────────────────────────────────────── */
/**
 * Filter and sort articles.
 * @param {Array} articles
 * @param {Object} params
 * @param {string} params.q - search query; '#x' searches tag names; else every word must match (accent-insensitive)
 * @param {string} params.type - type filter or 'all'
 * @param {string[]} params.tags - tag ids (AND logic)
 * @param {string} params.sort - 'new' | 'old' | 'long'
 * @param {string} params.taskId - filter by linked task
 * @param {string} params.topic - '' = all, 'none' = no topic, else topic id
 * @param {string} params.kind - contentKind() value, '' = all
 * @param {string} params.time - '' | '7' | '30' | '90' (saved within N days) | 'old' (> 90 days)
 * @param {boolean} params.mine - only "Ghi chú của tôi" (isMine)
 * @param {Set<string>|null} params.linked - keep only these ids ("Có liên kết"), null = no filter
 * @param {number} params.now - clock for `time` (ms)
 * @returns {Array}
 */
export function filterArticles(articles, {
  q = '', type = 'all', tags = [], sort = 'new', taskId = '',
  topic = '', kind = '', time = '', mine = false, linked = null, now = Date.now(),
} = {}) {
  let list = articles.filter(a => a.type !== 'inbox' && a.status !== 'archived');

  if (mine) list = list.filter(isMine);
  if (linked) list = list.filter(a => linked.has(a.id));

  // Type filter
  if (type && type !== 'all') {
    list = list.filter(a => a.type === type);
  }

  // Topic filter
  if (topic === 'none') list = list.filter(a => !a.topic_id);
  else if (topic) list = list.filter(a => a.topic_id === topic);

  // Kind filter
  if (kind) list = list.filter(a => contentKind(a) === kind);

  // Time filter
  if (time === 'old') list = list.filter(a => ageDays(a, now) > 90);
  else if (time) list = list.filter(a => ageDays(a, now) <= Number(time));

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
  const query = normalizeVi(q.trim());
  if (query.startsWith('#')) {
    const tagQ = query.slice(1);
    list = list.filter(a =>
      (a._tags || []).some(t => normalizeVi(typeof t === 'string' ? t : t.name).includes(tagQ))
    );
  } else if (query) {
    const words = query.split(/\s+/);
    list = list.filter(a => {
      const hay = normalizeVi([
        a.title,
        itemPlainText(a),
        a.url,
        a._topic?.name,
        ...(a._tags || []).map(t => (typeof t === 'string' ? t : t.name)),
        ...(a._notes || []).map(n => n.content),
      ].filter(Boolean).join(' '));
      return words.every(w => hay.includes(w));
    });
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

/* ── Group (Danh sách "Nhóm theo") ─────────────────────────── */
const monthKey = a => {
  const d = new Date(a.created_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Split an already sorted list into display groups; items keep their order inside a group.
 * month: local month of created_at, in list order · topic: topic order, "Chưa xếp" last ·
 * kind: KIND_META order · none: one group without a label.
 * @returns {Array<{ key: string, label: string, color?: string, items: Array }>}
 */
export function groupArticles(articles, by, { topics = [], now = Date.now() } = {}) {
  if (!by || by === 'none') return [{ key: 'all', label: '', items: articles }];
  const keyOf = { month: monthKey, topic: a => a.topic_id || 'none', kind: contentKind }[by];
  const groups = new Map();
  articles.forEach(a => {
    const k = keyOf(a);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  });

  if (by === 'month') {
    const year = new Date(now).getFullYear();
    return [...groups].map(([key, items]) => {
      const [y, m] = key.split('-').map(Number);
      return { key, label: y === year ? `Tháng ${m}` : `Tháng ${m}/${y}`, items };
    });
  }
  if (by === 'topic') {
    const byId = new Map(topics.map(t => [t.id, t]));
    const order = [...topics.map(t => t.id), 'none'];
    const rank = k => (order.includes(k) ? order.indexOf(k) : order.length);
    return [...groups]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([key, items]) => ({ key, label: byId.get(key)?.name || 'Chưa xếp', color: byId.get(key)?.color, items }));
  }
  const kinds = Object.keys(KIND_META);
  return [...groups]
    .sort(([a], [b]) => kinds.indexOf(a) - kinds.indexOf(b))
    .map(([key, items]) => ({ key, label: KIND_META[key].label, items }));
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

/* ── Content kind (derived from url + type) ────────────────── */
// glyph: text mark inside Knowledge; icon: AppIcon name for app-wide UI (e.g. LinkKBModal).
export const KIND_META = {
  repo:    { label: 'Repo',      glyph: '{ }', icon: 'code' },
  video:   { label: 'Video',     glyph: '▶',   icon: 'play' },
  fb:      { label: 'Bài FB',    glyph: 'f',   icon: 'users' },
  audio:   { label: 'Âm thanh',  glyph: '♪',   icon: 'headphones' },
  article: { label: 'Bài viết',  glyph: '≡',   icon: 'link' },
  note:    { label: 'Ghi chú',   glyph: '✎',   icon: 'pencil' },
  quote:   { label: 'Trích dẫn', glyph: '❝',   icon: 'quote' },
};

// Path segments on github.com that are not `<owner>/<repo>`.
const GITHUB_NON_OWNERS = new Set(['orgs', 'topics', 'collections', 'marketplace', 'sponsors', 'settings', 'features', 'trending', 'search', 'explore', 'login']);
// facebook.com/<segment> that is not a page or person.
const FB_NON_OWNERS = new Set(['share', 'watch', 'reel', 'photo', 'photo.php', 'story.php', 'permalink.php', 'events', 'marketplace']);

function parseLink(url) {
  const href = normalizeHttpUrl(url);
  if (!href) return null;
  const u = new URL(href);
  return {
    host: u.hostname.replace(/^(www|m|mobile)\./, '').toLowerCase(),
    segs: u.pathname.split('/').filter(Boolean),
  };
}

function githubRepo(link) {
  if (!link || link.host !== 'github.com' || link.segs.length < 2) return null;
  const [owner, repo] = link.segs;
  return GITHUB_NON_OWNERS.has(owner.toLowerCase()) ? null : `${owner}/${repo.replace(/\.git$/, '')}`;
}

const isFacebookHost = host => host === 'facebook.com' || host === 'fb.com' || host === 'fb.watch';

/**
 * What an item is, for icons and the "Loại" filter.
 * `quote` wins over the url; Drive links follow MediaPreview (audio unless #video).
 * @returns {'repo'|'video'|'fb'|'audio'|'article'|'note'|'quote'}
 */
export function contentKind(item) {
  if (item.type === 'quote') return 'quote';
  const link = parseLink(item.url);
  if (!link) return 'note';
  if (githubRepo(link)) return 'repo';
  const media = getMediaType(item.url);
  if (media === 'youtube' || media === 'video') return 'video';
  if (media === 'drive') return /#video/i.test(item.url) ? 'video' : 'audio';
  if (media === 'audio') return 'audio';
  if (isFacebookHost(link.host)) return 'fb';
  return 'article';
}

/**
 * Key for "Cùng nguồn": repo owner, Facebook page/group, else hostname.
 * YouTube returns null — a video URL carries no channel, and "all of YouTube" is not a source.
 * @param {string} url
 * @returns {string|null}
 */
export function sourceKey(url) {
  const link = parseLink(url);
  if (!link || link.host === 'youtube.com' || link.host === 'youtu.be') return null;
  const [first, second] = link.segs;
  if (link.host === 'github.com') {
    return first && !GITHUB_NON_OWNERS.has(first.toLowerCase()) ? `github.com/${first.toLowerCase()}` : null;
  }
  if (isFacebookHost(link.host)) {
    if (first === 'groups' && second) return `facebook.com/groups/${second}`;
    return first && !FB_NON_OWNERS.has(first) ? `facebook.com/${first.toLowerCase()}` : null;
  }
  return link.host;
}

/**
 * Title guessed from a pasted link, used only when the title box is empty.
 * @param {string} url
 * @returns {string} '' when the link is not usable
 */
export function guessTitle(url) {
  const link = parseLink(url);
  if (!link) return '';
  const repo = githubRepo(link);
  if (repo) return repo;
  const media = getMediaType(url);
  if (media === 'youtube') return 'Video YouTube';
  if (isFacebookHost(link.host)) return 'Bài Facebook';
  return link.host;
}

/**
 * "Xếp nhanh" queue: bài with no topic saved in the last `days` days, newest first.
 * Older unsorted bài stay out of Tổng quan (sorted in bulk from the list instead).
 */
export function quickSortQueue(items, now = Date.now(), days = 30) {
  return items
    .filter(a => a.type !== 'inbox' && a.status !== 'archived' && !a.topic_id && ageDays(a, now) <= days)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/* ── Neighbors ("Xung quanh") ──────────────────────────────── */
/**
 * Three groups, no item repeated across groups:
 * same topic (newest first) → same source → saved within ±nearDays in another topic (closest first).
 */
export function findNeighbors(item, all, { limit = 3, nearDays = 7 } = {}) {
  const others = all.filter(a => a.id !== item.id && a.type !== 'inbox' && a.status !== 'archived');
  const taken = new Set();
  const take = list => {
    const picked = list.slice(0, limit);
    picked.forEach(a => taken.add(a.id));
    return picked;
  };
  const byNewest = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at);

  const sameTopic = take(item.topic_id ? others.filter(a => a.topic_id === item.topic_id).sort(byNewest) : []);

  const key = sourceKey(item.url);
  const sameSource = take(key ? others.filter(a => !taken.has(a.id) && sourceKey(a.url) === key).sort(byNewest) : []);

  const t0 = Date.parse(item.created_at);
  const gap = a => Math.abs(Date.parse(a.created_at) - t0);
  const nearTime = take(others
    .filter(a => !taken.has(a.id) && (!item.topic_id || a.topic_id !== item.topic_id) && gap(a) <= nearDays * DAY_MS)
    .sort((a, b) => gap(a) - gap(b)));

  return { sameTopic, sameSource, nearTime };
}

/* ── Topic suggestion ──────────────────────────────────────── */
function dominantTopic(items, minCount, minShare) {
  const counts = new Map();
  items.forEach(a => { if (a.topic_id) counts.set(a.topic_id, (counts.get(a.topic_id) || 0) + 1); });
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  let best = null;
  counts.forEach((n, id) => { if (!best || n > best.n) best = { id, n }; });
  return best && best.n >= minCount && best.n / total >= minShare ? best.id : null;
}

/**
 * Suggest a topic id, or null when the evidence is thin — a wrong guess costs more than no guess.
 * 1. same source already filed somewhere ≥ 2 times
 * 2. same kind clearly concentrated in one topic (≥ 3 items, ≥ 60%) — e.g. repos
 * 3. a topic name phrase ("tâm lý", "giải trí"…) appears in the title/text, one topic only
 * @param {Object} item - title, url, type, body/body_text
 * @param {Array} all - items already saved (with topic_id)
 * @param {Array<{id,name}>} topics
 */
export function suggestTopic(item, all, topics) {
  const others = all.filter(a => a.id !== item.id);

  const key = sourceKey(item.url);
  if (key) {
    const bySource = dominantTopic(others.filter(a => sourceKey(a.url) === key), 2, 0.5);
    if (bySource) return bySource;
  }

  const kind = contentKind(item);
  if (kind !== 'note' && kind !== 'article') {
    const byKind = dominantTopic(others.filter(a => contentKind(a) === kind), 3, 0.6);
    if (byKind) return byKind;
  }

  const text = ` ${normalizeVi(`${item.title || ''} ${itemPlainText(item)}`).replace(/[^a-z0-9]+/g, ' ')} `;
  const hits = topics.filter(t =>
    normalizeVi(t.name).split('&').map(p => p.trim()).some(p => p.length >= 4 && text.includes(` ${p} `))
  );
  return hits.length === 1 ? hits[0].id : null;
}

/* ── Resurfacing ("Gặp lại hôm nay") ───────────────────────── */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Up to `n` items older than 30 days worth rereading: has notes, a quote, or your own note
 * (no bare links). Same `dateStr` → same picks all day.
 */
export function pickResurface(items, dateStr, n = 3, now = Date.now()) {
  return items
    .filter(a => a.type !== 'inbox' && a.status !== 'archived' && ageDays(a, now) > 30)
    .filter(a => isMine(a) || a.type === 'quote')
    .map(a => ({ a, h: hashStr(`${dateStr}|${a.id}`) }))
    .sort((x, y) => x.h - y.h)
    .slice(0, n)
    .map(x => x.a);
}

/** "Mở gần đây": put `id` first, drop duplicates, keep at most `max`. */
export function pushRecent(ids, id, max = 10) {
  return [id, ...ids.filter(x => x !== id)].slice(0, max);
}
