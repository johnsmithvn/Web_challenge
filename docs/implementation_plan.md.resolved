# Knowledge Base — Dual Editor + Full AI Roadmap

## 🎯 Mục tiêu tổng thể

| Phase | Nội dung | Version |
|---|---|---|
| **Phase 1** | Dual-mode editor (Markdown default + Tiptap WYSIWYG) | v3.2.0 |
| **Phase 2** | AI infrastructure (schema, embeddings, Supabase pgvector) | v3.3.0 |
| **Phase 3** | AI features UI (auto-tag, summarize, semantic search, RAG) | v3.4.0 |

---

## 🧠 Design Decisions (Final)

| Decision | Choice | Lý do |
|---|---|---|
| Default mode | **Markdown** | Quen, portable, không cần library để đọc |
| Mode lock | Locked per-article sau khi save | Tránh data loss khi convert |
| Toggle availability | Chỉ khi **tạo bài mới** | Edit bài cũ = mở đúng mode gốc |
| Reader view | **Universal** — tự detect `content_format` | User đọc không cần biết format gốc |
| AI content source | `body_text` (plain text extracted) | Strip markdown/JSON syntax trước khi gửi AI |
| Embeddings | OpenAI `text-embedding-ada-002` (1536 dims) | Standard, rẻ, Supabase pgvector compatible |
| Vector DB | **Supabase pgvector** | Tránh thêm external service, unified auth |

---

## ⚠️ User Review Required

> [!IMPORTANT]
> **Phase 1 migration — chạy ngay:**
> ```sql
> ALTER TABLE collections
>   ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) DEFAULT 'markdown',
>   ADD COLUMN IF NOT EXISTS body_text      TEXT,
>   ADD COLUMN IF NOT EXISTS word_count     INT DEFAULT 0;
> ```

> [!IMPORTANT]
> **Phase 2 migration — cần Supabase Pro (pgvector):**
> ```sql
> CREATE EXTENSION IF NOT EXISTS vector;
> ALTER TABLE collections
>   ADD COLUMN IF NOT EXISTS embedding     VECTOR(1536),
>   ADD COLUMN IF NOT EXISTS ai_summary    TEXT,
>   ADD COLUMN IF NOT EXISTS ai_key_points TEXT[],
>   ADD COLUMN IF NOT EXISTS ai_tags       TEXT[],
>   ADD COLUMN IF NOT EXISTS embedded_at   TIMESTAMPTZ;
> ```
> → Supabase Free tier **không có pgvector**. Cần **Supabase Pro ($25/mo)** hoặc dùng **external vector DB** (Pinecone free tier).
> 
> **Fallback nếu không muốn Pro:** Dùng PostgreSQL full-text search (`to_tsvector`) — không có semantic nhưng vẫn search được.

> [!WARNING]
> **OpenAI API cost estimate:**
> - `text-embedding-ada-002`: $0.0001 / 1K tokens
> - Bài 500 chữ ≈ 750 tokens → ~$0.000075/bài
> - 1000 bài ≈ **$0.075** — gần như free
> - GPT-4o-mini cho summarize: ~$0.002/bài
> - 1000 bài summarize ≈ **$2** — rất rẻ

---

## 📐 Phase 1: Dual-Mode Editor

### DB Migration

**File:** `data/migration_v3.2.0_knowledge.sql` [NEW]
```sql
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) DEFAULT 'markdown',
  ADD COLUMN IF NOT EXISTS body_text      TEXT,
  ADD COLUMN IF NOT EXISTS word_count     INT DEFAULT 0;

COMMENT ON COLUMN collections.content_format IS 'markdown | tiptap';
COMMENT ON COLUMN collections.body_text IS 'Plain text extracted from body — no markdown/HTML syntax. For AI and search.';
COMMENT ON COLUMN collections.word_count IS 'Pre-computed from body_text';
```

### Editor Architecture

```
EditorView (shell — chung cho cả 2 mode)
  ├── bar: [← Hủy] [word count] [💾 Lưu]
  ├── meta: [Type dropdown] [Title input]
  ├── sub-meta: [TagInput] [URL input]
  │
  ├── mode toggle (CHỈ hiện khi tạo mới, ẩn khi edit bài cũ):
  │     [✍️ Markdown]  [🎨 Visual]
  │     └── saved to localStorage('kb_editor_mode') as default
  │
  └── body (conditional):
        content_format === 'markdown'
          → MarkdownEditor (hiện tại: textarea + ReactMarkdown preview)
        content_format === 'tiptap'
          → TiptapEditor (new: WYSIWYG, lazy-loaded)
```

```
ReaderView (universal)
  └── item.content_format === 'tiptap'
        → <TiptapReadOnly content={JSON.parse(item.body)} />
  └── item.content_format === 'markdown' | undefined (backward compat)
        → <ReactMarkdown components={mdComponents}>{item.body}</ReactMarkdown>
```

### Tiptap Extension List

```js
// @tiptap/starter-kit includes: Bold, Italic, Strike, Code, CodeBlock,
//   Heading (H1-H6), BulletList, OrderedList, Blockquote, HorizontalRule, History
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
```

### Content Storage Contract

```js
// Markdown article:
{
  body: "# Tiêu đề\n**bold** text\n- item 1",
  content_format: "markdown",
  body_text: "Tiêu đề bold text item 1",  // stripped
  word_count: 5
}

// Tiptap article:
{
  body: JSON.stringify({ type: "doc", content: [...] }),  // Tiptap JSON
  content_format: "tiptap",
  body_text: "Tiêu đề bold text item 1",  // editor.getText()
  word_count: 5
}
```

### Helper: body_text extraction

```js
// Markdown → plain text
export function markdownToPlainText(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, '')         // code blocks
    .replace(/`[^`]+`/g, '')                 // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')         // images
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')      // links → text
    .replace(/^#{1,6}\s+/gm, '')             // headings
    .replace(/[*_~>|]/g, '')                 // syntax chars
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tiptap → plain text (built-in)
// editor.getText()  — returns clean text automatically
```

### Files (Phase 1)

| File | Action |
|---|---|
| `data/migration_v3.2.0_knowledge.sql` | NEW — DB migration |
| `src/components/TiptapEditor.jsx` | NEW — WYSIWYG editor component |
| `src/styles/tiptap.css` | NEW — Tiptap dark theme |
| `src/pages/CollectPage.jsx` | MODIFY — add mode toggle, Tiptap integration |
| `src/hooks/useCollections.js` | MODIFY — addItem/updateItem include new fields |

### Install (Phase 1)

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-link @tiptap/extension-table \
  @tiptap/extension-table-row @tiptap/extension-table-header \
  @tiptap/extension-table-cell @tiptap/extension-task-list \
  @tiptap/extension-task-item @tiptap/extension-highlight \
  @tiptap/extension-typography @tiptap/extension-placeholder \
  @tiptap/extension-character-count
```

---

## 📐 Phase 2: AI Infrastructure

### DB Migration

**File:** `data/migration_v3.3.0_ai.sql` [NEW]
```sql
-- Requires Supabase pgvector (Pro plan or self-hosted)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS embedding     VECTOR(1536),   -- OpenAI ada-002
  ADD COLUMN IF NOT EXISTS ai_summary    TEXT,           -- GPT-generated
  ADD COLUMN IF NOT EXISTS ai_tags       TEXT[],         -- AI-suggested tags
  ADD COLUMN IF NOT EXISTS ai_key_points TEXT[],         -- bullet points
  ADD COLUMN IF NOT EXISTS embedded_at   TIMESTAMPTZ;    -- last embedding time

-- Vector similarity search index (cosine distance)
CREATE INDEX IF NOT EXISTS idx_collections_embedding
  ON collections USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index (fallback if no pgvector)
CREATE INDEX IF NOT EXISTS idx_collections_fts
  ON collections USING gin(to_tsvector('english', COALESCE(body_text, '')));
```

### Supabase Edge Function: `embed-article`

Mỗi khi article được save → trigger Supabase Edge Function để:
1. Gọi OpenAI Embeddings API với `body_text`
2. Lưu `embedding VECTOR(1536)` vào DB
3. Optional: gọi GPT-4o-mini để generate `ai_summary`, `ai_tags`, `ai_key_points`

```typescript
// supabase/functions/embed-article/index.ts
import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "@supabase/supabase-js"

serve(async (req) => {
  const { articleId, bodyText } = await req.json()

  // 1. Generate embedding
  const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: JSON.stringify({ input: bodyText, model: "text-embedding-ada-002" })
  })
  const { data } = await embeddingRes.json()
  const embedding = data[0].embedding

  // 2. Optional: Generate summary + tags
  // (separate call to gpt-4o-mini)

  // 3. Update DB
  const supabase = createClient(...)
  await supabase.from("collections").update({
    embedding,
    embedded_at: new Date().toISOString()
  }).eq("id", articleId)
})
```

### Hook Extension: `useCollections.js`

```js
// Trigger embedding after save (non-blocking)
const triggerEmbedding = useCallback(async (articleId, bodyText) => {
  if (!bodyText || bodyText.length < 50) return; // skip empty
  try {
    await supabase.functions.invoke('embed-article', {
      body: { articleId, bodyText }
    })
  } catch (err) {
    console.warn('[embedding] failed, will retry later:', err.message)
    // Non-critical — article is saved, embedding just won't exist yet
  }
}, [])
```

---

## 📐 Phase 3: AI Features UI

### 3.1 Auto-Tag Suggestions

```
EditorView
  └── After typing 100+ words, show button: [✨ Gợi ý tag từ AI]
      → Call edge function with body_text
      → GPT-4o-mini: "Suggest 5 tags for this article: ..."
      → Show tag chips, user clicks to accept
```

### 3.2 Article Summarize

```
ReaderView
  └── Show [✨ Tóm tắt] button (if ai_summary is null)
      → Call edge function
      → GPT-4o-mini: "Summarize in 3 bullet points: ..."
      → Display collapsed summary box at top of article
      → Save to ai_summary column
```

### 3.3 Semantic Search

```
List view search bar
  └── [🔍 Tìm thường] vs [🧠 Tìm ngữ nghĩa (AI)] toggle
      → Semantic mode:
          1. Embed query text (OpenAI)
          2. Supabase RPC: match_documents(query_embedding, threshold=0.78, limit=10)
          3. Show results sorted by cosine similarity

-- Supabase RPC function:
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE(id UUID, title TEXT, body_text TEXT, similarity FLOAT)
AS $$
  SELECT id, title, body_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM collections
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
```

### 3.4 RAG — Q&A từ Knowledge Base

```
New page or modal: /knowledge/chat hoặc floating chat button

Flow:
  User: "Mình đã học gì về React hooks?"
  
  1. Embed câu hỏi (OpenAI)
  2. Tìm top-5 articles liên quan (semantic search)
  3. Build context:
       "Based on these articles:\n[article excerpts]\n\nAnswer: ..."
  4. Gửi cho GPT-4o-mini (hoặc GPT-4o)
  5. Stream response về UI
  6. Show source articles dưới câu trả lời
```

**Edge function: `knowledge-chat`**
```typescript
serve(async (req) => {
  const { question, userId } = await req.json()

  // 1. Embed question
  const qEmbedding = await embedText(question)

  // 2. Find relevant articles
  const { data: articles } = await supabase.rpc('match_documents', {
    query_embedding: qEmbedding,
    match_threshold: 0.75,
    match_count: 5
  }).eq('user_id', userId)

  // 3. Build context
  const context = articles.map(a => `[${a.title}]\n${a.body_text}`).join('\n\n')

  // 4. GPT call (streaming)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Answer based ONLY on the provided knowledge base articles.' },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
    ]
  })

  // 5. Stream back
  return new Response(response.body, { headers: { 'Content-Type': 'text/event-stream' } })
})
```

---

## ✅ Implementation Order

### Phase 1 (thực hiện ngay)
- [ ] Chạy migration v3.2.0 trên Supabase
- [ ] `npm install @tiptap/react @tiptap/pm @tiptap/starter-kit ...`
- [ ] Tạo `TiptapEditor.jsx` — lazy loaded, dark styled
- [ ] Tạo `tiptap.css` — dark theme, match .kb-prose style
- [ ] Update `EditorView`: mode toggle (chỉ khi tạo mới), conditional render
- [ ] Update `handleSave`: include `body_text`, `word_count`, `content_format`
- [ ] Update `ReaderView`: conditional render Markdown vs Tiptap
- [ ] Update `useCollections.js`: thêm fields vào addItem/updateItem
- [ ] Test backward compat (old items without content_format)

### Phase 2 (sau khi có Supabase Pro)
- [ ] Enable pgvector extension
- [ ] Chạy migration v3.3.0
- [ ] Tạo Supabase Edge Function `embed-article`
- [ ] Set OPENAI_API_KEY secret trên Supabase
- [ ] Update `useCollections.triggerEmbedding` sau mỗi lần save
- [ ] Backfill embeddings cho existing articles

### Phase 3 (sau Phase 2)
- [ ] Auto-tag button trong EditorView
- [ ] Summarize button trong ReaderView
- [ ] Semantic search toggle trong list view
- [ ] RAG chat interface (modal hoặc page mới)

---

## 🌿 Git Workflow

```
Phase 1:
  Branch:  feat/knowledge-dual-editor
  Commit:  feat(knowledge): dual-mode editor markdown+tiptap with AI-ready schema
  PR:      feat(knowledge): Dual-mode Editor (Markdown + WYSIWYG) v3.2.0

Phase 2:
  Branch:  feat/knowledge-ai-infra
  Commit:  feat(knowledge): add embedding pipeline and pgvector search
  PR:      feat(knowledge): AI Infrastructure — embeddings + semantic search v3.3.0

Phase 3:
  Branch:  feat/knowledge-ai-features
  Commit:  feat(knowledge): auto-tag, summarize, semantic search, RAG Q&A
  PR:      feat(knowledge): Full AI Features v3.4.0
```

## 🔢 Version Roadmap

| Version | Feature |
|---|---|
| v3.2.0 | Dual-mode editor |
| v3.3.0 | AI infrastructure (embeddings) |
| v3.4.0 | AI features (auto-tag, summarize, search, RAG) |

## ⚠️ Technical Debt / Risks

- **pgvector**: Free tier không hỗ trợ → cần upgrade Supabase hoặc dùng Pinecone
- **Mode conversion**: Không support chuyển đổi bài cũ từ Markdown sang Tiptap (data loss risk)
- **Embedding cost**: Mỗi lần edit bài = 1 API call → cần debounce, chỉ embed khi save
- **RAG context limit**: GPT-4o-mini context 128K tokens → đủ cho ~100 bài, nhưng cần chunk nếu bài dài
- **Offline**: AI features cần internet → graceful degradation nếu offline
