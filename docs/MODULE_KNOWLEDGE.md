# Module Knowledge (Kiến Thức) — Báo cáo chi tiết

> Phạm vi: toàn bộ module Knowledge Base của app Life Hub — route `/collect`.
> Nguồn: đọc trực tiếp source code tại thời điểm 2026-08-31, nhánh `main`.
> Tài liệu này chi tiết hơn `docs/FEATURES.md` §5 (bản tóm tắt).

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Mô hình dữ liệu](#2-mô-hình-dữ-liệu)
3. [Ba view của CollectPage](#3-ba-view-của-collectpage)
4. [Hai chế độ soạn thảo](#4-hai-chế-độ-soạn-thảo)
5. [Media layer](#5-media-layer)
6. [Sub-note (Ghi chú cá nhân)](#6-sub-note-ghi-chú-cá-nhân)
7. [Hệ thống Tag](#7-hệ-thống-tag)
8. [Liên kết sang các module khác](#8-liên-kết-sang-các-module-khác)
9. [Database](#9-database)
10. [Chiến lược query & fallback](#10-chiến-lược-query--fallback)
11. [Kiểm thử](#11-kiểm-thử)
12. [Điểm cần lưu ý / nợ kỹ thuật](#12-điểm-cần-lưu-ý--nợ-kỹ-thuật)

---

## 1. Tổng quan

| Thuộc tính | Giá trị |
|---|---|
| Route | `/collect` (khai báo tại `src/App.jsx:72`) |
| Code-splitting | Lazy chunk: `const CollectPage = lazy(() => import('./pages/CollectPage'))` (`src/App.jsx:22`) |
| SEO meta | `ROUTE_META['/collect']` → title "Knowledge Base — Life Hub" (`src/App.jsx:33`) |
| Tên hiển thị | Section label "Knowledge Base", H1 "Kho Tàng **Kiến Thức**" (gradient text) |
| Điều hướng vào | Navbar `{ to: '/collect', icon: 'brain', label: 'Knowledge' }` (`src/components/Navbar.jsx:21`); card trên Landing (`src/pages/LandingPage.jsx:44`, accent `#a78bfa`); nhắc trong Onboarding (`src/components/OnboardingModal.jsx:38`) |
| Yêu cầu đăng nhập | **Bắt buộc**. Không có guest fallback: `if (!user)` → render "🔒 Đăng nhập để dùng Knowledge Base" rồi dừng (`CollectPage.jsx:1096`) |
| CSS | `src/styles/collect.css` (2116 dòng), `src/styles/tiptap.css`, `src/styles/quote-widget.css`, `src/styles/url-input-popover.css` |

### 1.1. Bản đồ file

| Vai trò | File |
|---|---|
| Trang chính (list / reader / editor) | `src/pages/CollectPage.jsx` — 1473 dòng |
| Seed 7 loại kiến thức | `src/data/knowledge.json` |
| CRUD bảng `collections` | `src/hooks/useCollections.js` |
| CRUD sub-note | `src/hooks/useCollectionNotes.js` |
| Tag trung tâm (dùng chung 3 domain) | `src/hooks/useTags.js` |
| Rich-text editor | `src/components/TiptapEditor.jsx` (589 dòng) |
| Slash menu `/` cho Tiptap | `src/components/SlashCommand.jsx` |
| Node media tuỳ biến cho Tiptap | `src/extensions/MediaNode.jsx` |
| Render media (YT / Drive / audio / video) | `src/components/MediaPreview.jsx` |
| Player audio tuỳ biến | `src/components/CustomAudioPlayer.jsx` |
| Tiện ích nhận diện URL media | `src/utils/mediaUtils.js` |
| Popover nhập URL + upload file | `src/components/UrlInputPopover.jsx` |
| Modal liên kết bài viết ↔ task | `src/components/LinkKBModal.jsx` |
| Widget quote | `src/components/QuoteWidget.jsx` + `src/data/quotes.json` |
| Player podcast nổi toàn app | `src/components/GlobalAudioPlayer.jsx` + `src/hooks/useRandomPodcast.js` |
| Backend upload / stream | `api/upload.js`, `api/stream.js`, `api/_lib/verifyAuth.js`, `api/_lib/driveToken.js` |
| Schema | `supabase/migrations/20260802000000_base_v5_0_0.sql` (mục 16, 17, 21, 21b, 21c, 25) |
| Self-check | `src/__tests__/core/tagsAndKnowledgeContract.test.js` |

### 1.2. Hook mà CollectPage sử dụng

```js
const { items, isLoading, fetchItems, addItem, updateItem, deleteItem } = useCollections();
const { addTask, linkCollection, pendingTasks }                        = useUserTasks();
const { tags: centralTags, addTag: addCentralTag, linkTag, unlinkTag } = useTags();
const notesHook                                                       = useCollectionNotes();
const { confirm, ConfirmModal }                                       = useConfirm();
const { showToast }                                                   = useToast();
```

---

## 2. Mô hình dữ liệu

### 2.1. Bảy loại kiến thức

Định nghĩa **duy nhất** ở `src/data/knowledge.json`, nạp vào `TYPE_META` (`CollectPage.jsx:27`):

| key | label | màu | icon | mô tả |
|---|---|---|---|---|
| `note` | Ghi chú | `#8b5cf6` tím | `file` | Ghi chú chung — **mặc định** của `EMPTY_DRAFT` |
| `quote` | Trích dẫn | `#f59e0b` vàng | `quote` | Câu nói hay — có view gallery riêng |
| `learn` | Học | `#22c55e` lục | `book` | Khóa học |
| `idea` | Ý tưởng | `#f97316` cam | `lightbulb` | Ý tưởng cá nhân |
| `ai` | AI | `#a855f7` tím sáng | `robot` | Prompt, công cụ AI |
| `entertainment` | Giải trí | `#ef4444` đỏ | `game` | Phim ảnh, game |
| `podcast` | Podcast | `#0ea5e9` lam | `headphones` | Âm thanh, Radio |

Chính file JSON này cũng được **InboxPage dùng lại** (`const TYPES = KNOWLEDGE_DATA.types`) để render
dropdown phân loại. Thêm một loại vào JSON là cả hai màn hình đều có ngay — **nhưng phải nới
`CHECK` constraint trong DB**, nếu không insert/update sẽ bị Postgres chặn (xem §9.1).

Loại thứ 8 trong DB là `inbox` — không nằm trong JSON, và CollectPage **luôn lọc bỏ**.

### 2.2. Trạng thái

`collections.status ∈ {unread, read, archived}` (CHECK ở DB).

| Giá trị | Ai đặt |
|---|---|
| `unread` | Mặc định của `useCollections.addItem` và của cột trong DB; `classifyItem` cũng set về giá trị này |
| `read` | CollectPage set cứng khi **tạo bài mới**: `addItem({ ...payload, status: 'read' })` |
| `archived` | CollectPage lọc bỏ khỏi danh sách nhưng **không có nút archive nào trong UI Knowledge** (xem §12) |

### 2.3. Quan hệ Inbox ↔ Knowledge

Cả hai dùng **chung một bảng `collections`**, phân nhánh bằng cột `type`:

```
collections
├── type = 'inbox'      → InboxPage   (/inbox)
└── type ∈ 7 loại KB    → CollectPage (/collect)
```

Chuyển Inbox → Knowledge chính là `classifyItem(id, newType)`, tương đương
`updateItem(id, { type: newType, status: 'unread' })`.

---

## 3. Ba view của CollectPage

`CollectPage` là **một component với 3 nhánh render**, điều khiển bằng state `view ∈ {'list','reader','editor'}`
và `selected` (item đang chọn). Không dùng router con ⇒ nút Back/Forward của trình duyệt **không** đi
qua 3 view này (Back từ reader sẽ rời hẳn khỏi trang `/collect`).

```
view='list'   → danh sách / gallery
view='reader' → đọc bài (cần selected)
view='editor' → soạn bài (selected=null ⇒ tạo mới)
```

Handler điều hướng: `openReader(item)`, `openEditor(item = null)`, `goList()`.

State của trang:

```js
view, selected, isSaving                                  // điều hướng + cờ lưu
search, activeTag, sort, showSortDropdown, typeFilter     // bộ lọc
filterTaskId, showTaskFilter, taskSearch                  // lọc theo task
bulkMode, bulkSelected (Set)                              // chọn nhiều
```

Nạp dữ liệu: `useEffect(() => { if (user) fetchItems({}) }, [user])` — **fetch không filter**, lấy về
cả item Inbox rồi lọc ở client (xem §10).

### 3.1. List view

#### a) Header

- Section label `🧠 Knowledge Base` + H1 "Kho Tàng Kiến Thức".
- Subtitle: `{filtered.length} bài viết`, thêm hậu tố `· #<tên tag>` khi đang lọc theo tag.
- Nút **"Chọn nhiều" / "Thoát"** — chỉ hiện khi `filtered.length > 0`; bật `bulkMode` và reset `bulkSelected`.
- Nút **"Viết bài mới"** → `openEditor(null)`.

#### b) QuoteWidget

```jsx
<QuoteWidget pageKey="knowledge" kbQuotes={items.filter(i => i.type === 'quote' && i.status !== 'archived')} />
```

- Trộn quote hệ thống (`src/data/quotes.json` → `dailyQuotes`) với các item KB `type='quote'`.
- Item KB được map: `text = body_text || title`, `author = body_text ? title : null`, cắt còn 200 ký tự (thêm `…`).
- Quote mở đầu chọn theo seed **tất định** `hash("YYYY-MM-DD|knowledge") % pool.length` → cùng ngày vào lại vẫn ra câu đó.
- Nút 🔀 shuffle random trong phiên (crossfade 250ms khớp CSS transition).
- Nút 🎧 phát audio chỉ hiện khi quote có `audio_url` — quote từ KB luôn `audio_url: null`, nên nút này thực tế chỉ dành cho quote hệ thống.
- **Không đọc bảng `inspirational_quotes`** (bảng đã DROP ở migration `20260818000000_drop_inspirational_quotes_v6_10_0.sql`). Muốn thêm quote riêng ⇒ tạo item Knowledge loại `quote`.

#### c) Toolbar

| Thành phần | Chi tiết |
|---|---|
| Ô search | Lọc theo `title`, `body`, và `tags`. Không debounce — lọc client-side ngay mỗi ký tự. ⚠️ xem §12.1 |
| Sort dropdown | 4 lựa chọn: `newest` (mặc định), `oldest`, `alpha` (A→Z), `rev-alpha` (Z→A). Mục đang chọn có dấu ✓. Đóng khi click ra ngoài (`sortRef` + listener `mousedown`). |
| Lọc theo Task | Nút 📌 **chỉ hiện khi** `pendingTasks.length > 0`. Popover gồm: header có nút "Xóa bộ lọc", ô search task (autoFocus), danh sách tối đa **10** task, dòng "Hiện tối đa 10 · thu hẹp từ khoá" nếu vượt, và "Không tìm thấy task" khi rỗng. Chọn task ⇒ lọc `_linkedTaskIds.includes(filterTaskId)`; bấm lại chính task đó ⇒ bỏ lọc. Đóng khi click ra ngoài. |

#### d) Pill lọc theo loại

"Tất cả" + 7 pill sinh từ `TYPE_META` (icon + label, màu truyền qua CSS var `--pill-color` khi active).
Bấm lại pill đang active để bỏ lọc.

#### e) Hàng lọc theo tag

- `allTags` = **merge** tag nhúng trong item (`item._tags`, chỉ lấy item không phải inbox) với `centralTags`
  từ `useTags`, rồi sort theo `name`.
- Ưu tiên bản `centralTags` (query `select('*')`, đủ field); bản nhúng từ join của `useCollections` chỉ
  select `id, name, color` nên thiếu `description` — chỉ dùng làm fallback cho tag lạ.
- Chip "Tất cả" + từng tag (chấm màu + `#name`). Lọc theo **tag id**, không phải tên.
- Cả hàng bị ẩn nếu `allTags.length === 0`.

#### f) Pipeline lọc & sắp xếp

`useMemo` tại `CollectPage.jsx:991`:

```
items
 → bỏ type='inbox' và status='archived'
 → lọc typeFilter        (i.type === typeFilter)
 → lọc activeTag         (_tags[].id === activeTag)
 → lọc filterTaskId      (_linkedTaskIds.includes(filterTaskId))
 → lọc search            (title | body | tags chứa từ khoá, lowercase)
 → sort theo `sort`      (created_at desc/asc | title localeCompare asc/desc)
```

#### g) Hai kiểu render danh sách

**Kiểu 1 — `typeFilter === 'quote'` → Postcard gallery (`PostcardCard`)**

- Grid `kb-postcard-grid`, 8 gradient luân phiên: `kb-postcard--g{index % 8}`.
- Lấy text theo thứ tự: `body_text` → nếu trống và là Tiptap thì **duyệt đệ quy cây JSON** gom `node.text`
  → nếu là Markdown thì `markdownToPlainText(body)`.
- **`title` đóng vai tác giả** (hiện `— {title}` bên dưới), body mới là nội dung quote.
- Class phụ: `--short` (< 120 ký tự, chữ to hơn), `--truncated` (> 250 ký tự); cắt hiển thị ở 350 ký tự.
- Badge 🎧 Audio nếu regex `detectAudioUrl()` dò được URL `.mp3|.m4a|.ogg|.wav|.aac|.flac` trong `body`.
- Footer: tag chip + ngày tạo.

**Kiểu 2 — còn lại → List (`ArticleCard`)**

- Icon loại bên trái (20px, `weight="duotone"`, màu qua CSS var `--type-color`).
- Meta trên: nhãn loại (màu type) · link nguồn hiện `hostname` (có `stopPropagation` để không mở reader) ·
  badge định dạng **Visual / MD** · ngày tạo.
- Tiêu đề + excerpt **180 ký tự** (nguồn text giống PostcardCard) + `…` nếu bị cắt.
- Footer: tag chip + badge `📌 N task(s)` khi `_linkedTaskCount > 0` (màu cyan) + `⏱ N phút đọc`.
- Phút đọc: `ceil(word_count / 200)` tối thiểu 1; nếu thiếu `word_count` thì đếm từ trong plain text.
- Thẻ có `role="button"`, `tabIndex=0`, Enter để mở.

`safeHostname()` bọc `new URL()` trong try/catch — URL rác/tương đối không làm crash thẻ.

#### h) Chế độ chọn nhiều (bulk)

- Áp dụng cho **cả hai** kiểu render.
- Thanh `inbox-bulk-bar` (dùng lại CSS của Inbox): nút "Chọn tất cả" / "Bỏ chọn" + nút "Xóa (N)" (chỉ hiện khi đã chọn ≥ 1).
- Xóa có `confirm()` danger; nội dung khác nhau theo ngữ cảnh ("Xóa N bài viết?" vs "Xóa N trích dẫn?").
- Sau khi xoá: clear `bulkSelected`, tắt `bulkMode`, `fetchItems({})`.
- Chỉ **list view** render checkbox từng dòng; gallery quote chỉ có nút chọn-tất-cả (xem §12.6).

#### i) Trạng thái rỗng / loading

- Loading: `<SkeletonList rows={5} label="Đang tải kho kiến thức" />`.
- Rỗng: icon `quote` nếu đang lọc `quote`, ngược lại `brain`; câu chữ và nút CTA đổi theo
  ("Tạo trích dẫn đầu tiên" / "Tạo bài đầu tiên"); có chèn từ khoá search nếu đang tìm.

### 3.2. Reader view

Component `ReaderView` (`CollectPage.jsx:490`).

#### a) Thanh trên

`← Quay lại` | `📌 Task` | `✏️ Sửa` | `🗑 Xóa` (danger).

- **Task** — tạo task mới từ bài viết:
  ```js
  const result = await addTask({
    title: item.title,
    description: item.url || (item.body_text || '').slice(0, 200) || '',
  });
  if (result) {
    await linkCollection(result.id, item.id);   // junction task_collections
    showToast(`Task "${item.title}" đã được tạo!`, { icon: 'pushPin' });
  }
  ```
  Ghi liên kết qua junction `task_collections`, **không** dùng cột `user_tasks.collection_id`
  (deprecated từ v4.5.0, DROP ở v5.0.0). Nhờ vậy badge "🔗 N bài" trên task card và filter "📌 Task"
  ở Knowledge mới nhận ra liên kết này.
- **Xóa** — `confirm()` danger "Hành động này không thể hoàn tác" → `deleteItem(item.id)` → `goList()`.

#### b) Hero

- Icon loại 32px duotone, màu theo type.
- H1 tiêu đề (có attr `title` để hover xem full khi bị cắt).
- Meta: nhãn loại · ngày `updated_at || created_at` · `⏱ N phút đọc` · badge **Visual / Markdown**.
- Hàng tag chip (chấm màu + `#name`), ẩn nếu không có tag.
- Nếu có `url`:
  - `<MediaPreview url={item.url} type={item.type} onToggleFormat={onUpdateUrl} />`
  - Link "Xem nguồn: {url}" đã `stripMediaTag()` (bỏ `#audio` / `#video`).
  - `onUpdateUrl` **ghi thẳng vào DB**: `updateItem(selected.id, { url: newUrl })` → cập nhật `selected`
    → `fetchItems({})`. Tức là bấm nút "Dạng audio / Dạng video" ở reader là **thay đổi dữ liệu**, không chỉ đổi hiển thị.

#### c) Nội dung

- **Tiptap**: `<Suspense fallback="Đang tải nội dung..."><TiptapReadOnly content={item.body} /></Suspense>` — lazy chunk riêng.
- **Markdown**: `<ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>`
  - `mdComponents` inject `id={slugify(text)}` cho `h1..h4` để TOC nhảy được.
  - `img` → `className="kb-md-image" loading="lazy"`.
  - `a` → tự nhận diện và thay bằng `<MediaPreview>`:
    - YouTube: `youtube.com/watch`, `youtu.be/`, `youtube.com/embed/`
    - File audio: `.mp3 .m4a .ogg .wav .aac .flac`
    - Google Drive: mọi URL `drive.google.com/`
    - Còn lại: link thường `target="_blank" rel="noopener noreferrer"`
- Body rỗng → "Bài viết này chưa có nội dung. Chọn Sửa để thêm."

#### d) Table of Contents

- **Chỉ cho Markdown** (Tiptap có cấu trúc riêng nên bị bỏ qua).
- `extractHeadings()` quét `#`, `##`, `###` và **bỏ qua nội dung trong code fence** (toggle cờ `inCode` mỗi lần gặp ```` ``` ````).
- Ẩn hoàn toàn nếu có **dưới 2** heading.
- Click → `scrollIntoView({ behavior: 'smooth', block: 'start' })` tới phần tử `#slug`.

#### e) Sub-note

`<SubNotesSection collectionId={item.id} notesHook={notesHook} />` — chi tiết ở §6.

### 3.3. Editor view

Component `EditorView` (`CollectPage.jsx:758`).

#### a) Xác định định dạng khởi tạo

```
isNew  → localStorage['kb_editor_mode']  (mặc định 'markdown')
sửa    → detectFormat(item):
           content_format === 'tiptap'    → tiptap
           content_format === 'markdown'  → VẪN kiểm body: bắt đầu bằng {"type":"doc" ⇒ tiptap
                                            (vá bug cũ: từng có bài Tiptap bị lưu nhầm cờ markdown)
           không có content_format        → đoán từ hình dạng body
```

#### b) Thanh trên

`← Hủy` | `{n} từ · {n} ký tự · {n} phút đọc` | nút **Lưu**.

Nút Lưu `disabled` khi tiêu đề rỗng (`canSave = title.trim().length > 0`) hoặc đang lưu;
icon đổi sang `clock` + chữ "Đang lưu...".

#### c) Hàng meta

- `CustomSelect` chọn loại — 7 lựa chọn sinh từ `TYPE_META`, có icon.
- Input tiêu đề, `maxLength={200}`.

#### d) Hàng meta phụ

**TagInput** (component nội bộ, `CollectPage.jsx:93`):

- Nhận cả tag object `{id, name, color}` lẫn string (tương thích ngược với dữ liệu cũ).
- Dropdown gợi ý: lọc theo text đang gõ, **loại bỏ tag đã thêm**, tối đa **10** mục.
- Mục "➕ Tạo tag mới "\<slug\>"" khi từ khoá chưa khớp tag nào.
- Phím tắt: `↓`/`↑` di chuyển, `Enter` hoặc `,` thêm tag, `Esc` đóng dropdown,
  `Backspace` (khi ô trống) xoá tag cuối cùng.
- Tên tag luôn qua `slugify()`: `trim` → `lowercase` → bỏ ký tự không phải `\w\s-` → space thành `-`.
- Màu mặc định `#8b5cf6`.
- Đóng dropdown khi click ra ngoài (`containerRef` + listener `mousedown`).
- Dùng `onMouseDown` + `preventDefault` cho nút xoá/chọn để không mất focus khỏi input.

**Input URL nguồn** (tuỳ chọn). Khi đã có URL, hiện thêm pill **Audio / Video** — ghi hậu tố
`#audio` / `#video` vào chính URL (`url.split('#')[0] + '#audio'`). Đây là nguồn của "quy ước hash" ở §5.2.

**Mode toggle Markdown ↔ Visual** — **chỉ hiện khi tạo bài mới** (`isNew`):
- Đổi mode khi body đã có nội dung ⇒ hỏi xác nhận ("Nội dung hiện tại sẽ bị xóa. Tiếp tục?") rồi xoá `body` và `body_text`.
- Lựa chọn được nhớ vào `localStorage['kb_editor_mode']` (hằng `EDITOR_MODE_KEY`).
- Bài **đang sửa không đổi mode được** — cố ý, tránh mất nội dung khi convert 2 chiều.

#### e) Thống kê

- Markdown: đếm từ `markdownToPlainText(body)` — bỏ code fence, inline code, ảnh; giữ text của link; bỏ heading marker và ký hiệu `*_~>|`; gộp whitespace.
- Tiptap: dùng `_tiptapWordCount` / `_tiptapCharCount` do editor trả về (extension `CharacterCount`).
- `phút đọc = max(1, ceil(words / 200))`.

#### f) Lưu (`handleSave`, `CollectPage.jsx:1031`)

```js
payload = { title, body, body_text, word_count, content_format, type, url: url || null }

selected?.id ? await updateItem(selected.id, payload)
             : savedId = (await addItem({ ...payload, status: 'read' }))?.id

// Đồng bộ tag qua junction — DIFF, không xoá-ghi lại toàn bộ:
for (t of draft.tags   không có trong selected._tags) { addCentralTag(name, color) → linkTag(savedId, tagId, 'collection') }
for (t of selected._tags không có trong draft.tags)   { unlinkTag(savedId, t.id, 'collection') }

await fetchItems({});
goList();
```

`isSaving` chặn double-submit; khối `finally` luôn tắt cờ kể cả khi lỗi.

---

## 4. Hai chế độ soạn thảo

Cột `content_format VARCHAR(20) DEFAULT 'markdown'` quyết định editor nào được dùng.

### 4.1. Cơ chế nhận diện định dạng (2 nơi)

| Hàm | Vị trí | Dùng cho |
|---|---|---|
| `isTiptapBody(item)` | `CollectPage.jsx:84` | Card, badge, ReaderView |
| `detectFormat(item)` | `CollectPage.jsx:761` | EditorView khi mở bài để sửa |

Cả hai đều có **fallback đoán từ hình dạng body**: nếu chuỗi bắt đầu bằng `{"type":"doc"` thì coi là
Tiptap, bất kể `content_format` ghi gì. Lý do lịch sử: từng có giai đoạn cột `content_format` chưa được
migrate / bị lưu sai, dẫn tới bài Tiptap render ra JSON thô. Fallback này giữ dữ liệu cũ hiển thị đúng.

### 4.2. Markdown — split-pane tự viết (`MarkdownEditor`)

Không dùng thư viện editor nào; chỉ là `<textarea id="kb-md-textarea">` + preview `ReactMarkdown` cạnh nhau.

**Toolbar 17 nút** (`tools[]`, `CollectPage.jsx:668`):

| Nhóm | Nút |
|---|---|
| Inline | `B`, `I`, `S` (strike), `` ` `` (inline code) |
| Heading | `H1`, `H2`, `H3` |
| Khối | ```` ``` ```` (code block), `>` (blockquote), `—` (divider `\n---\n`) |
| List | `[ ]` (task), `•` (bullet), `1.` (ordered) |
| Chèn | 🔗 Link, 🖼 Ảnh, ▶️ YouTube, 🎵 Audio |

Hai hàm chèn:
- `insert(before, after, placeholder)` — bọc quanh vùng chọn (hoặc chèn placeholder), khôi phục selection trong `requestAnimationFrame`.
- `insertLine(prefix)` — chèn tiền tố ở đầu dòng hiện tại, giữ vị trí con trỏ.

**Phím tắt** (`handleKeyDown`, chỉ khi giữ Ctrl/Cmd):

| Phím | Tác dụng |
|---|---|
| `Ctrl+S` | Lưu bài (gọi `onSave`) |
| `Ctrl+P` | **Chặn** hộp thoại Print của trình duyệt |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+E` | Bold / Italic / inline code |
| `Ctrl+K` | Link `[text](url)` |
| `Ctrl+1/2/3` | Heading 1/2/3 |
| `Ctrl+Shift+X` | Strikethrough |
| `Ctrl+Shift+B` | Blockquote |
| `Ctrl+Shift+C` | Code block |
| `Ctrl+Shift+8 / 7 / 9` | Bullet / Ordered / Task list |
| `Ctrl+Shift+Z` | Bỏ qua để trình duyệt xử lý redo |

**Preview realtime**: cùng bộ `mdComponents` với ReaderView, cộng thêm khả năng **toggle định dạng media
ngay trong preview** — `handleUrlToggle(oldUrl, newUrl)` replace toàn bộ chuỗi URL cũ trong `value`
(có escape regex) rồi `onChange`. Được giữ qua `useRef` để `previewComponents` chỉ tạo một lần (`useMemo([])`).

**Popover chèn media**: dùng chung `UrlInputPopover`, neo vào toolbar (`anchorRef`):

| Loại | Chuỗi chèn |
|---|---|
| Ảnh | `\n![mô tả ảnh](URL)\n` |
| YouTube | `\n[Video](URL)\n` |
| Audio | `\n[Audio](URL#audio)\n` — **tự gắn `#audio`** nếu URL chưa có `#audio`/`#video` |

Ảnh và Audio bật `allowUpload` (accept `image/*` / `audio/*`).

### 4.3. Tiptap — Visual editor (`TiptapEditor.jsx`)

**20 extension** đăng ký ở `useEditor`:

`StarterKit` (đã tắt `link` và `underline` bản bundle v3 để tự cấu hình), `Link` (`openOnClick:false`,
`autolink:true`), `Table` (resizable), `TableRow`, `TableHeader`, `TableCell`, `TaskList`,
`TaskItem` (nested), `Highlight`, `Typography`, `Underline`, `TextAlign` (heading + paragraph),
`TextStyle`, `Color`, `Placeholder`, `CharacterCount`, `SlashCommandExtension`, `Image` (allowBase64),
`Youtube` (nocookie), `MediaNode`.

**Toolbar** (`TiptapToolbar`) — nhóm bằng divider:

| Nhóm | Nút |
|---|---|
| History | Undo, Redo (disabled theo `editor.can()`) |
| Heading | Normal text, H1, H2, H3 |
| Text | Bold, Italic, Underline, Strikethrough, **color picker** (`<input type="color">` → `setColor`), Highlight |
| Align | Left, Center, Right, Justify |
| List | Bullet, Ordered, Task |
| Khối & chèn | Link (popover inline), Table 3×3 có header, Inline code, Blockquote, Horizontal rule, Ảnh, YouTube, Audio, Clear formatting |

`LinkPopover` là popover inline thay cho `window.prompt`: tự thêm `https://` nếu thiếu, có nút gỡ link
khi con trỏ đang ở trong link, `Esc` để đóng.

**Slash menu `/` — 15 lệnh** (`SLASH_ITEMS`, `SlashCommand.jsx`), mỗi lệnh có icon, mô tả tiếng Việt và alias:

| # | Lệnh | Alias |
|---|---|---|
| 1 | Paragraph | text, plain, p |
| 2 | Heading 1 | h1, title |
| 3 | Heading 2 | h2, subtitle |
| 4 | Heading 3 | h3 |
| 5 | Bullet List | ul, unordered, list |
| 6 | Numbered List | ol, ordered, number |
| 7 | Task List | todo, check, task |
| 8 | Image | img, image, picture, photo, anh |
| 9 | YouTube | video, yt, youtube |
| 10 | Audio | audio, music, mp3, sound, nhac |
| 11 | Blockquote | quote, bq |
| 12 | Code Block | code, pre, snippet |
| 13 | Divider | hr, line, rule |
| 14 | Table (3×3) | grid, table |
| 15 | Highlight | mark, color, hl |

- 3 lệnh media **không chèn trực tiếp** mà `dispatchEvent(new CustomEvent('tiptap:open-media', { detail: { type } }))`;
  toolbar lắng nghe sự kiện này rồi mở `UrlInputPopover`.
- Menu render bằng **React Portal** (`createRoot` vào `document.body`), định vị `fixed` theo `clientRect` của con trỏ, `zIndex: 9999`.
- Điều hướng: `↑`/`↓` (vòng lại), `Enter` chọn, `Esc` đóng; item active tự `scrollIntoView({ block:'nearest' })`.

**Modal phím tắt** (`ShortcutsModal`) — 2 tab:
- Tab **Visual Editor**: 4 nhóm (Văn bản / Khối & List / Gõ tắt Markdown / Chung), bao gồm cả các
  input-rule kiểu Notion (`# ` → H1, `- ` → bullet, ` ``` ` → code block, `---` → divider, `[] ` → task list).
- Tab **Markdown**: bảng phím tắt của split-pane editor.
- Đóng bằng `Esc` hoặc click overlay.

**Bàn phím ở tầng editor** (`editorProps.handleKeyDown`): `Ctrl+S` gọi `onSave` (chặn Save Page của
trình duyệt), `Ctrl+P` bị chặn; mọi phím khác pass-through.

**Auto-upload ảnh**:
- `handlePaste` — duyệt `clipboardData.items`, gặp `image/*` là chặn paste mặc định và upload.
- `handleDrop` — tương tự với `dataTransfer.files`.
- `uploadAndInsertImage()` lấy `access_token` từ `supabase.auth.getSession()`, POST `multipart/form-data`
  tới `/api/upload` với `folder=images`, rồi chèn node `image` với `src` server trả về.
- Chưa đăng nhập → toast "Cần đăng nhập để tải ảnh lên."; lỗi mạng/local → toast hướng dẫn dùng nút chèn URL.

**Footer**: số từ realtime + gợi ý "Gõ `/` để chèn khối · `Ctrl+Shift+V` paste không format".

**`onUpdate`** trả về 4 giá trị cho CollectPage: `(json, text, words, chars)` — JSON stringify của
`editor.getJSON()`, plain text, số từ, số ký tự.

**`TiptapReadOnly`** (export phụ): cùng bộ extension nhưng bỏ `Placeholder`, `CharacterCount`,
`SlashCommand`; `Link` bật `openOnClick: true`; `editable: false`.

### 4.4. `MediaNode` — node media tuỳ biến

`src/extensions/MediaNode.jsx` — node `mediaBlock`, `group: 'block'`, `atom: true`.

- **Attributes**: `src`, `title`.
- **NodeView React**: render `<MediaPreview>` bên trong `NodeViewWrapper`, có `onToggleFormat` ghi ngược vào attrs.
- **`renderHTML`**: sinh HTML tĩnh khác nhau theo `getMediaType(src)` — iframe YouTube / iframe Drive preview
  (cao 360px nếu `#video`, 80px nếu audio) / thẻ `<audio>` / thẻ `<video>` / fallback là thẻ `<a>`.
- **`parseHTML`**: đọc lại từ `div[data-media-block]`, và **tương thích ngược** với `div[data-audio-block]` cũ.
- **Commands**: `setMediaBlock(attrs)`, và alias cũ `setAudioBlock(attrs)`.
- **4 paste rule** (`nodePasteRule`) — dán URL vào là tự thành block media:

| Regex | Xử lý |
|---|---|
| Google Drive (`/file/d/ID`, `open?id=ID`) | Chuyển sang `drive.google.com/uc?id=ID`, title "Google Drive Media" |
| YouTube (watch / youtu.be / embed / shorts) | Giữ URL, title "YouTube Video" |
| Audio (`.mp3 .m4a .ogg .wav .aac .flac .webm`) | **Gắn thêm `#audio`**, title = tên file |
| Video (`.mp4 .webm .ogg .ogv .mov .mkv`) | **Gắn thêm `#video`**, title = tên file |

- **Migration `audioBlock` → `mediaBlock`**: `migrateTiptapContent()` / `migrateJson()` duyệt đệ quy cây
  JSON trước khi nạp vào editor, đổi mọi `type: 'audioBlock'` thành `'mediaBlock'`. Áp dụng cho **cả**
  `TiptapEditor` và `TiptapReadOnly`, nên bài cũ vẫn mở được mà không cần migrate dữ liệu trong DB.

---

## 5. Media layer

### 5.1. Bảng nhận diện — `getMediaType(url)` (`src/utils/mediaUtils.js`)

Thứ tự kiểm tra (dừng ở cái đầu tiên khớp):

| Kết quả | Điều kiện | Render thành |
|---|---|---|
| `youtube` | `extractYoutubeId()` ra ID — hỗ trợ `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, cộng regex fallback cho URL copy-paste lệch chuẩn | `<iframe>` `youtube-nocookie.com/embed/ID` |
| `drive` | `extractDriveFileId()` ra ID — hỗ trợ `/file/d/ID/view`, `/file/d/ID/preview`, `/open?id=`, `/uc?id=`, và `googleusercontent.com?id=` | Mặc định: `CustomAudioPlayer` qua proxy; có `#video`: iframe Drive preview 360px |
| `audio` | hash `#audio` / `#podcast`, hoặc `type=audio`, hoặc `?mime=audio/*`, hoặc đuôi `.mp3 .m4a .ogg .wav .aac .flac .webm` | `CustomAudioPlayer` |
| `video` | hash `#video`, hoặc `type=video`, hoặc `?mime=video/*`, hoặc đuôi `.mp4 .webm .ogg .ogv .mov .mkv` | `<video controls>` max-height 400px |
| `link` | không khớp gì | `MediaPreview` trả `null` (không render) |

`isMediaUrl()` bọc `new URL()` trong try/catch; URL tương đối/không hợp lệ thì chỉ dựa vào regex đuôi file.

### 5.2. Quy ước hash

| Hash | Ý nghĩa |
|---|---|
| `#audio` | Ép hiển thị dạng audio player |
| `#video` | Ép hiển thị dạng video |
| `#podcast` | **Alias lịch sử** của `#audio` (chỉ được `isAudioUrl` chấp nhận) |

Hash được ghi vào **chính cột `collections.url`** hoặc vào Markdown/JSON body — tức là lựa chọn hiển thị
được lưu bền, không phải state UI. Ba nơi ghi hash:
1. Pill Audio/Video ở EditorView.
2. Thanh toggle "Định dạng: Dạng audio / Dạng video" trong `MediaPreview` (`renderToggleBar`), chỉ hiện
   cho `drive`, `audio`, `video` và chỉ khi có `onToggleFormat`.
3. Paste rule của `MediaNode`.

`stripMediaTag(url)` = `url.split('#')[0]` — dùng khi cần URL sạch để mở tab mới.

### 5.3. `/api/stream` — proxy Google Drive

`GET /api/stream?id={driveFileId}` (`api/stream.js`). Lý do tồn tại: Drive không cho phát trực tiếp
vì CORS, mà iframe preview của Drive thì xấu và không tuỳ biến được. Proxy cho phép dùng
`CustomAudioPlayer` tự viết.

Bảo mật:
- **Chỉ phục vụ file nằm trong `DRIVE_FOLDER_ID`** (thư mục upload gốc của app) hoặc thư mục con trực tiếp
  — chặn IDOR biến service account thành "read-oracle" cho mọi file ID.
- CORS giới hạn theo env `ALLOWED_ORIGIN` (same-origin `<audio src>` không cần CORS).
- Rate limit token-bucket theo IP: burst 100, hồi 2 req/s, tối đa 5000 key.
- Cache authorization mỗi warm instance, TTL 5 phút.
- Hỗ trợ header `Range` để tua.

`getDriveStreamUrl(url)` → `/api/stream?id=ID`.

### 5.4. `/api/upload` — upload lên Google Drive

`POST /api/upload`, body `multipart/form-data { file, folder? }` (`api/upload.js`).

- **Bắt buộc đăng nhập**: `verifyAuth(req)` xác thực Bearer token của Supabase; không có → 401.
- Whitelist thư mục: `images | audio | video | documents | uploads`; giá trị khác bị ép về `uploads`
  (chống Drive query injection).
- Giới hạn **4 MB** (`MAX_UPLOAD_BYTES`) — do Vercel Function cap body ở 4.5 MB; kiểm tra cả
  `content-length` lẫn số byte thực nhận.
- CORS theo `ALLOWED_ORIGIN`.
- Trả về `{ url, provider, id, size }`.
- Env cần: `GOOGLE_SERVICE_ACCOUNT_JSON`, `DRIVE_FOLDER_ID`.

Hai nơi gọi upload: `UrlInputPopover.handleFileUpload` (tự chọn folder theo MIME) và
`TiptapEditor.uploadAndInsertImage` (paste/drop ảnh, folder cố định `images`).

### 5.5. `MediaPreview` — memo hoá

`React.memo` với comparator tuỳ biến: chỉ re-render khi `url`, `type`, `className`, `style` (so sánh
JSON) hoặc `title` (đã `stringifyChildren` để so text từ React node) thay đổi. Quan trọng vì component
này nằm trong `ReactMarkdown` — mỗi lần gõ ký tự ở preview mà không memo thì iframe YouTube sẽ reload liên tục.

---

## 6. Sub-note (Ghi chú cá nhân)

Hook `src/hooks/useCollectionNotes.js`, UI `SubNotesSection` (`CollectPage.jsx:243`).

Dùng cho: ghi chú khi đọc sách, chú thích cá nhân, suy nghĩ bổ sung — tách khỏi `body` của bài viết.

### API của hook

| Hàm | Mô tả |
|---|---|
| `fetchNotes(collectionId)` | Lấy note của 1 bài, lọc thêm `user_id`, sort `created_at` **tăng dần** |
| `addNote(collectionId, content)` | Insert, trim nội dung, optimistic append vào state |
| `updateNote(noteId, content)` | Optimistic update, **backup lấy từ state mới nhất** trong callback của `setNotes` để rollback chính xác |
| `deleteNote(noteId)` | Optimistic remove (không rollback nếu lỗi) |
| `getNoteCount(collectionId)` | Đếm nhẹ bằng `select('id', { count:'exact', head:true })` — **hiện chưa được gọi ở đâu** |

Mọi query đều `.eq('user_id', user.id)` bên cạnh RLS.

### UI

- Header `📝 Ghi Chú Cá Nhân` + badge số lượng (ẩn khi 0).
- Loading: `<SkeletonList rows={3} icon={false} right={false} gap="6px" />`.
- Mỗi note: nội dung plain text + ngày giờ (`formatDateTime`) + nút ✏️ Sửa / 🗑 Xóa.
- Sửa tại chỗ: đổi sang `<textarea>` autofocus, `Ctrl+Enter` lưu, `Esc` huỷ.
- Form thêm mới: textarea thu gọn, `onFocus` mới bung nút Hủy/Lưu; `Ctrl+Enter` lưu, `Esc` thu gọn và xoá nội dung.
- Nút Lưu `disabled` khi nội dung rỗng.
- `useEffect` gọi `fetchNotes(collectionId)` mỗi khi `collectionId` đổi.

**Cascade**: xoá bài viết ⇒ `collection_notes.collection_id ... ON DELETE CASCADE` xoá sạch note của bài đó ở tầng DB.

---

## 7. Hệ thống Tag

Hook `src/hooks/useTags.js` — **dùng chung cho 3 domain**, không riêng Knowledge.

### 7.1. `ENTITY_CONFIG`

```js
const ENTITY_CONFIG = {
  finance:    { table: 'finance_transaction_tags', fk: 'transaction_id' },
  collection: { table: 'collection_tags',          fk: 'collection_id' },
  task:       { table: 'task_tags',                fk: 'task_id' },
};
```

Ba junction riêng thay vì một bảng polymorphic — để giữ được **foreign key thật** ở cả hai phía và RLS chặt.

### 7.2. Hành vi

| Hàm | Chi tiết |
|---|---|
| `fetchTags()` | `select('*')` theo `user_id`, order `name`. Gọi 1 lần khi đăng nhập (cờ `fetchedRef`), reset khi logout |
| `addTag(name, color='#8b5cf6')` | Chuẩn hoá `trim().toLowerCase()`; kiểm trùng client-side trước; nếu Postgres trả **`23505`** (vi phạm UNIQUE) thì `ilike` lấy bản ghi đã có và trả về thay vì báo lỗi |
| `updateTag(id, {name?, color?})` | Đổi tên/màu, chuẩn hoá tên, optimistic + rollback |
| `deleteTag(id)` | Optimistic remove, khôi phục nếu lỗi |
| `linkTag(entityId, tagId, entityType)` | `upsert` với `onConflict: '<fk>,tag_id'` — link lại không lỗi |
| `unlinkTag(entityId, tagId, entityType)` | `delete` theo cặp khoá |
| `getTagsForEntity(entityId, entityType)` | `select('tag_id, tags(id,name,color)')` |
| `getTagUsageBreakdown(tagId)` | 3 count song song → `{ finance, collection, task }` |
| `getTagUsageCount(tagId)` | Tổng của breakdown |
| `getAllTagUsageCounts()` | Kéo toàn bộ 3 junction rồi đếm ở client |

⚠️ `entityType` mặc định là `'expense'` — **không có trong `ENTITY_CONFIG`**, nên gọi thiếu tham số
thứ 3 sẽ log lỗi và trả `false`. CollectPage luôn truyền `'collection'` nên không ảnh hưởng.

### 7.3. Luồng tag trong Knowledge

```
Người dùng gõ tag ở TagInput
        │
        ├─ chọn từ gợi ý  → tag object có sẵn {id,name,color}
        └─ tạo mới        → { name: slugify(input), color:'#8b5cf6' }
        │
   Bấm Lưu bài
        │
   addCentralTag(name,color)   → insert vào `tags` (hoặc trả bản đã có nếu 23505)
   linkTag(collectionId, tagId, 'collection') → upsert `collection_tags`
   unlinkTag(...)                             → delete các tag bị gỡ
```

Tag được **quản lý tập trung** ở `/settings` tab Chung (`SettingsPage.jsx`): tạo, đổi tên, đổi màu,
xem breakdown usage (nhãn: `task → nhiệm vụ`, `finance → giao dịch`, `collection → bài viết`),
và xoá có xác nhận hiển thị rõ tag đang được dùng ở đâu.

Xoá tag ở Settings ⇒ `collection_tags ... ON DELETE CASCADE` gỡ tag khỏi mọi bài viết.

---

## 8. Liên kết sang các module khác

### 8.1. Bảng tổng hợp

| Module | Chiều | Cơ chế | File |
|---|---|---|---|
| **Inbox** | Inbox → KB | `classifyItem(id, type)` đổi `type` của cùng một hàng `collections` | `InboxPage.jsx`, `useCollections.js` |
| **QuickCapture** | → Inbox → KB | FAB nổi toàn app, `addItem({ type:'inbox' })` | `QuickCapture.jsx` |
| **Tasks** | KB → Task | Nút "📌 Task" ở Reader: `addTask()` + `linkCollection()` | `CollectPage.jsx:1155` |
| **Tasks** | Task → KB | `LinkKBModal` chọn/bỏ chọn bài viết cho task | `LinkKBModal.jsx`, `TaskListSection.jsx` |
| **Tasks** | Hiển thị 2 chiều | Badge "🔗 N bài" trên task card; badge "📌 N tasks" trên KB card; filter "📌 Task" ở KB | `TaskListSection.jsx`, `ArticleCard` |
| **Tasks** | Activity log | `task_link_add` / `task_link_remove` ghi vào `activity_logs` | `useUserTasks.js`, `taskFields.js` |
| **Settings** | Settings → KB | Tag manager (đổi tên/màu/xoá tag ảnh hưởng trực tiếp bài viết) | `SettingsPage.jsx`, `useTags.js` |
| **GlobalAudioPlayer** | KB → toàn app | Đọc `collections` `type='podcast'` có `url`, phát ngẫu nhiên | `useRandomPodcast.js`, `GlobalAudioPlayer.jsx` |
| **QuoteWidget** | KB → Inbox + KB | Item `type='quote'` trộn vào pool quote hệ thống | `QuoteWidget.jsx` |
| **Finance** | Chỉ gián tiếp | Finance nhận handoff **từ Inbox** (`sessionStorage`), rồi xoá item Inbox nguồn. **Không đụng item KB** | `finance/AddScreen.jsx:243` |
| **Navbar / Landing / Onboarding** | → KB | Link điều hướng | `Navbar.jsx:21`, `LandingPage.jsx:44`, `OnboardingModal.jsx:38` |

### 8.2. Inbox → Knowledge (nạp liệu)

Hai cửa vào:
1. **QuickCapture** — nút `+` nổi ở mọi trang (trừ `/finance` và landing). Tự tách: text > 25 từ hoặc
   > 100 ký tự thì cắt 25 từ đầu làm `title`, giữ nguyên văn vào `body`; chuỗi bắt đầu bằng `http(s)://`
   thì vào cột `url`. Guest thấy lời mời đăng nhập.
2. **Form nhập nhanh trong InboxPage** — logic tách title/body **giống hệt**.

Từ Inbox, dropdown `CustomSelect` (options sinh từ `KNOWLEDGE_DATA.types`) xuất hiện ở 3 chỗ
(card, detail view, bulk classify) → `classifyItem()` biến item thành bài Knowledge.

### 8.3. Knowledge ↔ Tasks (M:N)

Bảng nối `task_collections (task_id, collection_id)`.

**Chiều KB → Task**: nút "📌 Task" ở Reader tạo task mới rồi link ngay. `description` của task lấy
`item.url`, nếu không có thì 200 ký tự đầu của `body_text`.

**Chiều Task → KB**: `LinkKBModal` (`src/components/LinkKBModal.jsx`)
- Mở từ `TaskListSection` (nút "Liên kết bài viết" / "N bài viết liên kết" trong menu tuỳ chọn của task).
- `useCollections` trong `TaskListSection` là **lazy** — chỉ `fetchCollections({})` khi modal mở.
- Loại bỏ item `type='inbox'`; search theo `title` + `body_text || body`; **item đã link xếp lên đầu**, còn lại sort theo title; hiển thị tối đa **10** kết quả.
- Bấm để toggle link/unlink, truyền kèm `title` để activity log ghi được tên bài (sau khi bài bị xoá thì không tra ngược được nữa).
- Footer hiện "{N} bài đã liên kết".
- ⚠️ `TYPE_ICONS` trong modal chỉ map 4 key cũ (`link/quote/learn/idea`) → 4 loại còn lại rơi về icon `file` (xem §12.5).

**Hiển thị**:
- KB card: badge `📌 N tasks` (từ `_linkedTaskCount`).
- Task card: badge `🔗 N bài` + nút mở modal đổi màu cyan khi đã có link (`TaskListSection.jsx:528,566`).
- `TaskDetailModal` hiện dòng "Bài viết: N bài viết".
- Filter "📌 Task" ở KB list lọc theo `_linkedTaskIds`.

**Activity log**: `linkCollection` / `unlinkCollection` gọi `logTaskRelation()` với action
`task_link_add` / `task_link_remove`; render thành "Liên kết bài viết: {tên}" / "Bỏ liên kết: {tên}"
(`src/utils/taskFields.js:227`).

**RLS 2 phía**: policy `task_collections_own` kiểm cả `user_tasks.user_id` lẫn `collections.user_id`
(vá lỗi P0-2 ở v4.28.0 — trước đó chỉ kiểm 1 phía nên ghi được rác cross-user).

### 8.4. Knowledge → GlobalAudioPlayer

`useRandomPodcast` query `collections` với `type='podcast'` và `url IS NOT NULL`, rồi chọn ngẫu nhiên
ở JS (Supabase JS client không có `RANDOM()` nếu không viết RPC).

`GlobalAudioPlayer` render ở `App.jsx` cạnh Navbar ⇒ **có mặt ở mọi trang**. Player nổi có: play/pause,
skip (đổi bài khác), thu nhỏ thành nút tròn, đóng hẳn. Hết bài thì tự `fetchRandomPodcast()` bài kế tiếp.
Không autoplay (trình duyệt chặn) — chỉ nạp sẵn `preload="none"`.

Nguồn phát: `getDriveStreamUrl(podcast.url) || podcast.url` — tức là podcast lưu trên Drive sẽ đi qua
proxy `/api/stream`.

⚠️ Query này **không lọc `user_id`** — hoàn toàn dựa vào RLS (xem §12.3).

### 8.5. Knowledge → QuoteWidget

`QuoteWidget` xuất hiện ở **2 trang**: Inbox (`pageKey` riêng) và Knowledge (`pageKey="knowledge"`).
Chỉ Knowledge truyền `kbQuotes` (Inbox dùng quote hệ thống). Chi tiết ở §3.1.b.

### 8.6. Không có liên kết trực tiếp với Finance

Finance chỉ đụng bảng `collections` ở đúng một chỗ: `finance/AddScreen.jsx:243` xoá item **Inbox**
nguồn sau khi ghi giao dịch thành công (handoff qua `sessionStorage`, key `lh_inbox_to_finance`).
Bài viết Knowledge không tham gia luồng này. Điểm chung duy nhất giữa Finance và Knowledge là **bảng `tags`**.

---

## 9. Database

Nguồn: `supabase/migrations/20260802000000_base_v5_0_0.sql`.

### 9.1. `collections` — bảng chính (mục 16)

```sql
CREATE TABLE IF NOT EXISTS collections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'inbox',
  title          TEXT NOT NULL,
  url            TEXT,
  body           TEXT DEFAULT '',
  body_text      TEXT,
  word_count     INT DEFAULT 0,
  content_format VARCHAR(20) DEFAULT 'markdown',
  source         TEXT,
  status         TEXT NOT NULL DEFAULT 'unread',
  snoozed_until  DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Cột | Vai trò trong Knowledge |
|---|---|
| `type` | 1 trong 7 loại KB (hoặc `inbox`) |
| `title` | Tiêu đề bài; với loại `quote` thì đóng vai **tác giả** |
| `url` | URL nguồn, kèm hash `#audio`/`#video` |
| `body` | Markdown thô **hoặc** JSON Tiptap (stringify) |
| `body_text` | Plain text — dùng cho excerpt, search, đếm từ, quote |
| `word_count` | Cache để tính phút đọc mà không phải đếm lại |
| `content_format` | `markdown` \| `tiptap` |
| `source` | Chỉ có trong `addItem`, **KB không ghi giá trị** |
| `snoozed_until` | Chỉ Inbox dùng |

**CHECK constraints**
```sql
CHECK (type IN ('inbox','note','quote','learn','idea','ai','entertainment','podcast'))
CHECK (status IN ('unread','read','archived'))
```
Migration còn chạy `UPDATE` dọn dữ liệu cũ trước khi áp CHECK: `want→idea`, `link→note`,
`experience→learn`, `knowledge→learn`, `emotion→note`, `status='inbox'|NULL → 'unread'`.

**Cột đã DROP** (dọn ở v5.0.0): `resolved`, `course_name`, `duration_min`, `reviewed_at`, `priority`.
Cũng không còn cột `tags TEXT[]` — tag đã chuyển hẳn sang junction từ v4.1.0.

**Trigger**: `trg_collections_updated_at` BEFORE UPDATE → `updated_at = NOW()`.

**Index**
```
idx_collections_user_type     (user_id, type)
idx_collections_user_status   (user_id, status)
idx_collections_user_created  (user_id, created_at DESC)
idx_collections_snooze        (user_id, snoozed_until) WHERE snoozed_until IS NOT NULL
```

**RLS**: 4 policy riêng (`select` / `insert` / `update` / `delete`), tất cả `user_id = auth.uid()`.

### 9.2. `collection_tags` — junction KB ↔ Tag (mục 21)

```sql
CREATE TABLE IF NOT EXISTS collection_tags (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tag_id        UUID NOT NULL REFERENCES tags(id)        ON DELETE CASCADE,
  PRIMARY KEY (collection_id, tag_id)
);
```
- Index: `idx_collection_tags_coll`, `idx_collection_tags_tag`.
- RLS `collection_tags_own` **kiểm ownership CẢ HAI phía** (`collections.user_id` và `tags.user_id`),
  cả trong `USING` lẫn `WITH CHECK` — vá lỗi P0-2 v4.28.0.

### 9.3. `collection_notes` — sub-note (mục 25)

```sql
CREATE TABLE IF NOT EXISTS collection_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  content       TEXT NOT NULL,
  sort_order    SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```
- Index: `idx_cnotes_collection`.
- RLS `cnotes_own`: `user_id = auth.uid()`.
- ⚠️ Cột `sort_order` tồn tại nhưng **code không dùng** — hook sort theo `created_at ASC`.
- ⚠️ Không có `updated_at` — sửa note không có dấu vết thời gian.

### 9.4. `task_collections` — junction Task ↔ KB (mục 17)

```sql
CREATE TABLE IF NOT EXISTS task_collections (
  task_id       UUID NOT NULL REFERENCES user_tasks(id)  ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, collection_id)
);
```
- Index: `idx_task_collections_coll`.
- RLS `task_collections_own`: kiểm cả `user_tasks` lẫn `collections` ở cả 2 vế.
- Thay thế cột `user_tasks.collection_id` (quan hệ 1:1 cũ, deprecated v4.5.0, DROP v5.0.0).

### 9.5. `tags` + view `tagged_items` (mục 21, 21c)

```sql
CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)          -- nguồn của lỗi 23505 mà useTags bắt
);
```

```sql
CREATE VIEW tagged_items WITH (security_invoker = true) AS
      SELECT tag_id, 'collection'::text  AS kind, collection_id   AS item_id FROM collection_tags
UNION ALL SELECT tag_id, 'task',                  task_id                    FROM task_tags
UNION ALL SELECT tag_id, 'expense',               expense_id                 FROM expense_tags
UNION ALL SELECT tag_id, 'subscription',          subscription_id            FROM subscription_tags;
```
`security_invoker = true` là **bắt buộc** (cần PostgreSQL ≥ 15): mặc định view chạy bằng quyền OWNER và
bỏ qua RLS của bảng dưới ⇒ leak dữ liệu mọi user. Hiện code frontend chưa query view này.

Lưu ý: base migration tạo `expense_tags` / `subscription_tags`, còn `useTags` dùng
`finance_transaction_tags` — bảng đó đến từ migration Finance v6.0.0.

### 9.6. Sơ đồ quan hệ

```
                          auth.users
                               │ (user_id, CASCADE ở mọi bảng)
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   user_tasks              collections               tags
        │                   │      │                   │
        │  task_collections │      │  collection_tags  │
        └───────◇───────────┘      └─────────◇─────────┘
           (task_id,               (collection_id, tag_id)
            collection_id)               │
                                         │  collection_notes
                                         └──────────< (collection_id, user_id)

◇ = junction, PK ghép, FK 2 phía, ON DELETE CASCADE, RLS kiểm ownership 2 phía
```

Hệ quả cascade khi **xoá 1 bài viết**: tự động mất `collection_tags` của bài, `task_collections` của bài,
và toàn bộ `collection_notes` của bài. Tag trong bảng `tags` thì **không** bị xoá (đúng ý — tag dùng chung).

### 9.7. GRANT

Base migration `GRANT SELECT, INSERT, UPDATE, DELETE` cho role `authenticated` trên các bảng gồm
`collections`, `task_collections`, `collection_tags`, `collection_notes`, `tags`. Cần thiết vì
Supabase project mới không tự grant quyền cho object do `postgres` tạo; RLS vẫn quyết định thấy hàng nào.

---

## 10. Chiến lược query & fallback

### 10.1. `fetchItems(filters)` — 3 tầng join

```
Tầng 1 (full):      select('*, collection_tags(tag_id, tags(id,name,color)), task_collections(task_id)')
        ↓ lỗi
Tầng 2 (tags-only): select('*, collection_tags(tag_id, tags(id,name,color))')
        ↓ lỗi
Tầng 3 (none):      select('*')
```

Mục đích: DB chưa chạy migration mới (thiếu `task_collections` hoặc `collection_tags`) thì trang vẫn
mở được, chỉ mất tính năng phụ. Mỗi lần rớt tầng đều `logger.warn`.

Kết quả được map thêm 3 field ảo rồi **xoá dữ liệu junction thô**:

| Field ảo | Nguồn | Ghi chú |
|---|---|---|
| `_tags` | `collection_tags[].tags` | Tầng 3 fallback về `item.tags` (cột đã bỏ) → thực tế là `[]` |
| `_linkedTaskIds` | `task_collections[].task_id` | Chỉ có ở tầng 1 |
| `_linkedTaskCount` | `_linkedTaskIds.length` | |

Bộ lọc phía server (`applyFilters`): `type`, `status`; nếu có `type` khác `inbox` và không truyền
`status` thì tự thêm `neq('status','archived')`; nếu `type='inbox'` thì thêm điều kiện snooze.

**Giới hạn 500 hàng**, order `created_at DESC`.

⚠️ CollectPage gọi `fetchItems({})` — **không truyền filter** — nên kéo về cả item Inbox rồi lọc ở client.
Đơn giản hoá được việc dùng chung `items` cho cả QuoteWidget và filter, đổi lại tốn băng thông khi
Inbox nhiều item. Với trần 500 hàng, Inbox nhiều có thể **đẩy bài KB cũ ra khỏi kết quả**.

### 10.2. Optimistic update

| Thao tác | Optimistic | Rollback |
|---|---|---|
| `addItem` | Prepend vào `items` với `_tags: []` | Không (trả `null` nếu lỗi) |
| `updateItem` | Merge `updates` vào item trong state | `fetchItems()` (refetch toàn bộ) |
| `deleteItem` | Lọc item khỏi state | `fetchItems()` |
| `addNote` | Append vào `notes` | Không |
| `updateNote` | Thay `content` | Khôi phục bản backup |
| `deleteNote` | Lọc khỏi `notes` | Không |
| `linkTag`/`unlinkTag` | Không optimistic (chờ kết quả rồi refetch) | — |
| `linkCollection` | Thêm vào `task._collections` | Lọc lại nếu lỗi |
| `unlinkCollection` | Xoá khỏi `task._collections` | Khôi phục mảng backup |

Mọi mutation đều `.eq('user_id', user.id)` bên cạnh RLS (defense-in-depth).

### 10.3. Tối ưu render

- `TiptapEditor` và `TiptapReadOnly` **lazy import** — Tiptap + 20 extension là chunk nặng, chỉ tải khi thực sự soạn/đọc bài Visual.
- `MediaPreview` bọc `React.memo` với comparator tuỳ biến.
- `REMARK_PLUGINS`, `mdComponents`, `headingComponents` là hằng module-level, không tạo lại mỗi render.
- `filtered` và `allTags` bọc `useMemo`; các handler bọc `useCallback`.

---

## 11. Kiểm thử

File: `src/__tests__/core/tagsAndKnowledgeContract.test.js` — plain `node:assert/strict`, không framework.
Đã wire vào script `test` trong `package.json`.

Chạy riêng:

```bash
node src/__tests__/core/tagsAndKnowledgeContract.test.js
```

Nội dung kiểm:
1. **`ENTITY_CONFIG`** — 3 junction đúng tên bảng + đúng FK; thêm assert regex trên chính source
   `useTags.js` để đảm bảo 3 tên bảng còn tồn tại trong code.
2. **Chuẩn hoá tên tag** — `trim` + `toLowerCase` (có case tiếng Việt có dấu).
3. **Xử lý 23505** — assert source `useTags.js` có nhánh `error.code === '23505'`.
4. **Sub-note** — mô phỏng sort theo `sort_order`; assert `useCollectionNotes.js` lọc theo `collection_id`
   và `useCollections.js` thao tác đúng bảng `collections`.

Đây là **contract test đọc source**, không mock Supabase — đúng quy ước trong `CLAUDE.md`
(logic chạm Supabase/React thì test tay trên Supabase).

Toàn bộ suite:

```bash
npm test
```

---

## 12. Điểm cần lưu ý / nợ kỹ thuật

Những điểm dưới đây là quan sát trực tiếp từ code, không phải suy đoán.

### 12.1. Tìm theo tag trong ô search **không hoạt động**

`CollectPage.jsx:1008`:
```js
(i.tags || []).some(t => t.includes(q))
```
Cột `collections.tags TEXT[]` đã bị bỏ từ v4.1.0 (không còn trong `CREATE TABLE`), và `useCollections`
chỉ map `_tags` chứ không dựng lại `tags`. Nên `i.tags` luôn `undefined` ⇒ nhánh này luôn rỗng.
Muốn lọc theo tag phải **bấm chip tag**. Ô search thực tế chỉ tìm `title` + `body`.

Ngoài ra search trên `i.body`: với bài Tiptap, `body` là JSON stringify ⇒ gõ từ khoá có thể khớp
tên node (`"paragraph"`, `"doc"`, `"heading"`) chứ không phải nội dung. Đúng ra nên tìm trên `body_text`.

### 12.2. Không có nút Archive trong UI Knowledge

`filtered` loại `status === 'archived'` và `QuoteWidget` cũng lọc như vậy, nhưng CollectPage **không có
hành động nào set `archived`**. Trạng thái này chỉ đến từ Inbox hoặc từ thao tác trực tiếp trên DB.
Hệ quả: bài đã archived biến mất khỏi Knowledge mà không có cách nào khôi phục qua UI.

### 12.3. `useRandomPodcast` không lọc `user_id`

```js
supabase.from('collections').select('id,title,url,body,type,content_format')
  .eq('type','podcast').not('url','is',null);
```
Không có `.eq('user_id', ...)`. An toàn nhờ RLS `collections_select_own`, nhưng đây là **ngoại lệ duy nhất**
trong module — mọi query khác đều lọc `user_id` thêm một lớp. Nếu RLS bị tắt/sửa nhầm thì đây là chỗ rò đầu tiên.

Đồng thời hook này chạy `useEffect` ngay khi `GlobalAudioPlayer` mount — tức là **mỗi lần vào app**,
kể cả khi người dùng chưa đăng nhập (trả về rỗng).

### 12.4. Bài mới lưu với `status: 'read'`

`handleSave` truyền `status: 'read'` khi tạo bài, trong khi mặc định của `useCollections.addItem` và của
cột DB là `'unread'`. Chưa có màn nào phân biệt read/unread trong Knowledge nên hiện không ảnh hưởng,
nhưng là điểm không nhất quán nếu sau này làm tính năng "chưa đọc".

### 12.5. `TYPE_ICONS` trong `LinkKBModal` đã lạc hậu

```js
const TYPE_ICONS = { link: 'link', quote: 'quote', learn: 'book', idea: 'lightbulb' };
```
`link` không còn là loại hợp lệ (đã migrate thành `note`), còn `note`, `ai`, `entertainment`, `podcast`
thì thiếu ⇒ rơi về icon mặc định `file`. Không lỗi, chỉ là icon không khớp với `TYPE_META`.
Sửa đúng là đọc thẳng từ `knowledge.json` như CollectPage.

### 12.6. Chọn nhiều ở gallery quote thiếu checkbox từng thẻ

Nhánh render gallery có thanh bulk (chọn tất cả / xoá) nhưng `PostcardCard` **không render checkbox**
và click vào thẻ vẫn mở reader. Nên trong `bulkMode` ở view quote, người dùng chỉ có thể "Chọn tất cả"
rồi xoá, không chọn lẻ được.

### 12.7. Xoá hàng loạt chạy tuần tự

```js
for (const id of bulkSelected) { await deleteItem(id); }
```
N request tuần tự, mỗi request kèm một lần cập nhật state. Chọn 50 bài là 50 vòng chờ. Có thể gộp thành
một `.in('id', [...])` — nhưng phải sửa `deleteItem` (hoặc thêm hàm mới) nên chưa làm.

### 12.8. Ba view không có URL riêng

Reader và Editor chỉ là state trong component ⇒ không share link tới một bài viết, không mở tab mới,
F5 là về list, và nút Back của trình duyệt rời hẳn `/collect`. Đây là lựa chọn thiết kế có chủ đích
(giữ page đơn giản, không cần route con), nhưng đáng biết khi cần deep-link.

### 12.9. Cột `collection_notes.sort_order` là cột chết

Có trong schema, được test nhắc tới, nhưng hook sắp xếp theo `created_at ASC` và không ghi/đọc
`sort_order` ở đâu. Muốn kéo-thả sắp xếp note thì cột đã sẵn sàng; hiện tại nó chỉ tồn tại.

### 12.10. `word_count` chỉ được cập nhật khi lưu qua editor

Các đường ghi khác (`classifyItem` từ Inbox, `updateItem({url})` từ Reader) không tính lại `word_count`.
Bài chuyển từ Inbox sang Knowledge sẽ giữ `word_count = 0` ⇒ card rơi về nhánh đếm từ text runtime
(vẫn hiển thị đúng, chỉ tốn thêm chút CPU mỗi lần render).

---

*Tài liệu này mô tả trạng thái code tại 2026-08-31. Khi sửa module Knowledge, cập nhật cả file này và
`docs/FEATURES.md` §5.*
