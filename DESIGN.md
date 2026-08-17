---
version: 6.2.0
name: Life Hub
description: >-
  Dark-first glassmorphic design system for Life Hub (Personal Life OS).
  Midnight-navy surfaces, translucent blurred cards, purple/cyan gradient
  accents and neon-green success signals. A light theme is provided as a
  token override on [data-theme="light"].

# ─────────────────────────────────────────────────────────────────
# COLORS
# Source: src/styles/global.css (:root = dark default,
#         [data-theme="light"] = light override)
# Semantic aliases (primary/secondary/... ) are references to existing
# CSS variables only; no new colour values are introduced here.
# ─────────────────────────────────────────────────────────────────
colors:
  # Semantic roles — aliases over real tokens
  primary: "{colors.purple}"
  secondary: "{colors.cyan}"
  tertiary: "{colors.green}"
  neutral: "{colors.bg-primary}"
  surface: "{colors.bg-secondary}"
  on-surface: "{colors.text-primary}"
  error: "{colors.red}"

  # Brand — dark theme (--purple … --orange)
  purple: "#8b5cf6"
  purple-light: "#a78bfa"
  purple-dark: "#6d28d9"
  blue: "#6366f1"
  cyan: "#06b6d4"
  cyan-light: "#22d3ee"
  green: "#00ff88"
  green-dim: "#00cc6e"
  gold: "#ffd700"
  gold-dim: "#f59e0b"
  red: "#ef4444"
  orange: "#f97316"

  # Backgrounds — dark theme (--bg-*)
  bg-primary: "#08080f"
  bg-secondary: "#0d0d1a"
  bg-tertiary: "#111125"
  bg-card: "rgba(255, 255, 255, 0.04)"
  bg-card-hover: "rgba(255, 255, 255, 0.07)"
  bg-glass: "rgba(255, 255, 255, 0.05)"
  bg-glass-border: "rgba(255, 255, 255, 0.1)"

  # Text — dark theme (--text-*)
  text-primary: "#f0f0ff"
  text-secondary: "#a0a0c0"
  text-muted: "#5a5a80"
  text-accent: "#a78bfa"

  # Light theme overrides — [data-theme="light"]
  light-bg-primary: "#f4f6fb"
  light-bg-secondary: "#ffffff"
  light-bg-tertiary: "#eef1f8"
  light-bg-card: "rgba(255, 255, 255, 0.85)"
  light-bg-card-hover: "rgba(255, 255, 255, 1)"
  light-bg-glass: "rgba(255, 255, 255, 0.7)"
  light-bg-glass-border: "rgba(99, 102, 241, 0.15)"
  light-text-primary: "#0f172a"
  light-text-secondary: "#475569"
  light-text-muted: "#94a3b8"
  light-text-accent: "#6366f1"
  light-purple: "#7c3aed"
  light-purple-light: "#6366f1"
  light-cyan: "#0891b2"
  light-green: "#16a34a"
  light-green-dim: "#15803d"
  light-gold: "#d97706"
  light-gold-dim: "#b45309"
  light-red: "#dc2626"
  light-orange: "#ea580c"

  # Literal colours hard-coded in components (not CSS variables)
  cm-confirm-text: "#c4b5fd"
  cm-confirm-text-hover: "#ede9fe"
  cm-danger-text: "#fca5a5"
  cm-danger-text-hover: "#fee2e2"
  overflow-danger-text: "#f87171"
  on-gradient: "#ffffff"
  on-gold: "#000000"

# ─────────────────────────────────────────────────────────────────
# TYPOGRAPHY
# Source: index.html (Google Fonts), src/styles/global.css,
#         navbar.css, generic-modal.css, confirm-modal.css
# NOTE: display-1 … h3 use CSS clamp() in global.css. The DESIGN.md
# Dimension type cannot express clamp(), so fontSize below records the
# clamp UPPER bound. Full fluid ranges are listed in the Typography
# section prose. See TODO in "Do's and Don'ts".
# ─────────────────────────────────────────────────────────────────
typography:
  display-1:
    fontFamily: Plus Jakarta Sans
    fontSize: 5rem # clamp upper bound; clamp(2.5rem, 6vw, 5rem)
    fontWeight: 900
    lineHeight: 1.2
  display-2:
    fontFamily: Plus Jakarta Sans
    fontSize: 3.5rem # clamp upper bound; clamp(2rem, 4vw, 3.5rem)
    fontWeight: 800
    lineHeight: 1.2
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.5rem # clamp upper bound; clamp(1.8rem, 3vw, 2.5rem) — .h1
    fontWeight: 700
    lineHeight: 1.2
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 2rem # clamp upper bound; clamp(1.4rem, 2.5vw, 2rem) — .h2
    fontWeight: 600
    lineHeight: 1.2
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.4rem # clamp upper bound; clamp(1.1rem, 2vw, 1.4rem) — .h3
    fontWeight: 600
    lineHeight: 1.2
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 0.9rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 0.85rem
    fontWeight: 500
    lineHeight: 1.6
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.6
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 0.82rem
    fontWeight: 600
    lineHeight: 1.6
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.8rem
    fontWeight: 600
    lineHeight: 1.6
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.85rem
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: 0.05em
  label-caps-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 0.65rem
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: 0.08em
  caption:
    fontFamily: Be Vietnam Pro
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.6
  tab-label:
    fontFamily: Be Vietnam Pro
    fontSize: 0.6rem
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: 0.01em

# ─────────────────────────────────────────────────────────────────
# SHAPES — Source: src/styles/global.css (--radius-*)
# ─────────────────────────────────────────────────────────────────
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px

# ─────────────────────────────────────────────────────────────────
# SPACING
# Source: src/styles/global.css (--space-*, .container, .section),
#         src/styles/navbar.css (shell dimensions)
# ─────────────────────────────────────────────────────────────────
spacing:
  base: 1rem
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  2xl: 3rem
  3xl: 4rem
  4xl: 6rem
  container-max: 1200px
  container-gutter: 2rem # .container padding — var(--space-xl)
  container-gutter-mobile: 1rem # ≤768px — var(--space-md)
  section-block: 6rem # .section padding — var(--space-4xl)
  section-block-mobile: 4rem # ≤768px — var(--space-3xl)
  sidebar-width: 232px
  topbar-height: 52px
  bottom-tabs-height: 60px
  breakpoint-desktop: 769px
  breakpoint-mobile: 768px
  breakpoint-compact: 520px

# ─────────────────────────────────────────────────────────────────
# COMPONENTS
# Sources: global.css (.btn/.card/.progress-bar-*/.section-label), generic-modal.css,
#   confirm-modal.css, datepicker.css, collect.css (CustomSelect),
#   navbar.css (shell)
# ─────────────────────────────────────────────────────────────────
components:
  # ── Buttons — global.css ──
  button:
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: 0.75rem 1.75rem
  button-primary:
    backgroundColor: "{colors.blue}" # start stop of --grad-hero
    textColor: "{colors.on-gradient}"
    rounded: "{rounded.full}"
    padding: 0.75rem 1.75rem
  button-primary-hover:
    backgroundColor: "{colors.blue}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    borderColor: "{colors.bg-glass-border}"
    rounded: "{rounded.full}"
  button-ghost-hover:
    backgroundColor: "rgba(139, 92, 246, 0.1)"
    textColor: "{colors.purple-light}"
    borderColor: "{colors.purple-light}"
  # ── Card surface — global.css ──
  card:
    backgroundColor: "{colors.bg-card}"
    borderColor: "{colors.bg-glass-border}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  card-hover:
    backgroundColor: "{colors.bg-card-hover}"
    borderColor: "rgba(139, 92, 246, 0.3)"
  # ── Section label — global.css ──
  section-label:
    backgroundColor: "rgba(139, 92, 246, 0.12)"
    textColor: "{colors.purple-light}"
    borderColor: "rgba(139, 92, 246, 0.25)"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
    padding: 0.4rem 1rem

  # ── GenericModal — generic-modal.css ──
  generic-modal-backdrop:
    backgroundColor: "rgba(0, 0, 0, 0.55)"
    padding: 1rem
  generic-modal:
    backgroundColor: "{colors.bg-secondary}"
    borderColor: "rgba(255, 255, 255, 0.08)"
    rounded: "{rounded.lg}"
    width: 440px # max-width
  generic-modal-header:
    typography: "{typography.label-lg}"
    padding: 1rem 1.25rem
  generic-modal-body:
    padding: 1.25rem
  generic-modal-label:
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
  generic-modal-input:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    borderColor: "rgba(255, 255, 255, 0.1)"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 0.6rem 0.85rem
  generic-modal-input-focus:
    borderColor: "{colors.purple}"
  generic-modal-footer:
    padding: 0.75rem 1.25rem

  # ── ConfirmModal — confirm-modal.css ──
  confirm-modal-dialog:
    backgroundColor: "{colors.bg-secondary}"
    borderColor: "rgba(255, 255, 255, 0.1)"
    rounded: "{rounded.xl}"
    padding: 2rem 1.75rem 1.5rem
    width: 400px # max-width
  confirm-modal-button:
    rounded: "{rounded.md}"
    padding: 0.6rem 1.25rem
    width: 160px # max-width
  confirm-modal-button-cancel:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    borderColor: "rgba(255, 255, 255, 0.1)"
    textColor: "{colors.text-secondary}"
  confirm-modal-button-confirm:
    backgroundColor: "rgba(139, 92, 246, 0.2)"
    borderColor: "rgba(139, 92, 246, 0.45)"
    textColor: "{colors.cm-confirm-text}"
  confirm-modal-button-confirm-hover:
    backgroundColor: "rgba(139, 92, 246, 0.35)"
    borderColor: "rgba(139, 92, 246, 0.6)"
    textColor: "{colors.cm-confirm-text-hover}"
  confirm-modal-button-danger:
    backgroundColor: "rgba(239, 68, 68, 0.15)"
    borderColor: "rgba(239, 68, 68, 0.4)"
    textColor: "{colors.cm-danger-text}"
  confirm-modal-button-danger-hover:
    backgroundColor: "rgba(239, 68, 68, 0.28)"
    borderColor: "rgba(239, 68, 68, 0.6)"
    textColor: "{colors.cm-danger-text-hover}"

  # ── Task overflow menu — global.css (.task-overflow-*) ──
  overflow-menu:
    backgroundColor: "{colors.bg-secondary}"
    borderColor: "rgba(139, 92, 246, 0.2)"
    rounded: "{rounded.md}"
    width: 140px # min-width
  overflow-menu-item:
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-sm}"
    padding: 0.55rem 0.75rem
  overflow-menu-item-danger-hover:
    backgroundColor: "rgba(239, 68, 68, 0.1)"
    textColor: "{colors.overflow-danger-text}"

  # ── CustomSelect — collect.css (.kb-sort-*) ──
  select-trigger:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    borderColor: "rgba(255, 255, 255, 0.1)"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 0.6rem 0.9rem
  select-trigger-hover:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    borderColor: "rgba(255, 255, 255, 0.2)"
  select-dropdown:
    backgroundColor: "{colors.bg-secondary}"
    borderColor: "{colors.bg-glass-border}"
    rounded: "{rounded.md}"
    padding: 0.25rem
    width: 140px # min-width
  select-option:
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    padding: 0.5rem 0.75rem
  select-option-hover:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text-primary}"
  select-option-active:
    textColor: "{colors.purple-light}"

  # ── DatePickerPopover — datepicker.css ──
  datepicker-popover:
    backgroundColor: "{colors.bg-primary}"
    borderColor: "rgba(139, 92, 246, 0.2)"
    rounded: "{rounded.lg}"
    width: 380px
  datepicker-tab:
    backgroundColor: transparent
    borderColor: "rgba(255, 255, 255, 0.08)"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: 0.3rem 0.6rem
  datepicker-tab-active:
    backgroundColor: "rgba(139, 92, 246, 0.15)"
    borderColor: "rgba(139, 92, 246, 0.3)"
    textColor: "{colors.purple-light}"
  datepicker-cell:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  datepicker-cell-today:
    textColor: "{colors.red}"
  datepicker-cell-selected:
    backgroundColor: "rgba(139, 92, 246, 0.25)"
    borderColor: "rgba(139, 92, 246, 0.4)"
    textColor: "{colors.cm-confirm-text}"
  datepicker-input:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    borderColor: "rgba(255, 255, 255, 0.1)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 0.3rem 0.5rem

  # ── Progress bar — global.css ──
  progress-track:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    rounded: "{rounded.full}"
    height: 6px
  progress-fill:
    backgroundColor: "{colors.purple-light}" # start stop of --grad-text
    rounded: "{rounded.full}"

  # ── App shell — navbar.css ──
  sidebar:
    backgroundColor: "rgba(8, 8, 15, 0.92)"
    borderColor: "rgba(255, 255, 255, 0.06)"
    width: "{spacing.sidebar-width}"
    padding: 1.25rem 0.75rem
  sidebar-link:
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 0.55rem 0.75rem
  sidebar-link-active:
    backgroundColor: "rgba(139, 92, 246, 0.12)"
    textColor: "{colors.purple-light}"
  topbar:
    backgroundColor: "rgba(8, 8, 15, 0.92)"
    borderColor: "rgba(255, 255, 255, 0.06)"
    height: "{spacing.topbar-height}"
    padding: 0 1rem
  bottom-tabs:
    backgroundColor: "rgba(8, 8, 15, 0.95)"
    borderColor: "rgba(255, 255, 255, 0.08)"
    height: "{spacing.bottom-tabs-height}"
    padding: 0 0.25rem
  bottom-tabs-tab:
    textColor: "{colors.text-muted}"
    typography: "{typography.tab-label}"
    rounded: "{rounded.md}"
    padding: 0.3rem 0.5rem
  bottom-tabs-tab-active:
    textColor: "{colors.purple-light}"
  nav-avatar:
    backgroundColor: "{colors.purple}" # start stop of the avatar gradient
    textColor: "{colors.on-gradient}"
    borderColor: "rgba(255, 255, 255, 0.12)"
    size: 34px
  nav-avatar-hover:
    borderColor: "{colors.cyan-light}"
  nav-menu:
    backgroundColor: "rgba(15, 15, 30, 0.97)"
    borderColor: "rgba(255, 255, 255, 0.1)"
    rounded: "{rounded.lg}"
    padding: 0.5rem
---

# Life Hub — Design System

**Version:** v6.2.0 · **Updated:** 2026-08-09

## Overview

Life Hub is a **Personal Life OS** single-page app (React 19 + Vite + Supabase).
The interface combines task management, finance, inbox, encrypted account
storage, knowledge collection and focus timers. It is meant to feel like a private,
slightly futuristic control room — dense with information but calm to look at.

Character:

- **Dark-first.** `:root` is the dark theme; light is an override on
  `[data-theme="light"]`. Every new surface must be legible in both.
- **Glassmorphic.** Content sits on translucent white-alpha panels over a
  near-black navy page, softened by `backdrop-filter: blur()`.
- **Neon accents, quiet chrome.** Purple → cyan gradients carry brand and
  primary actions; neon green marks completion/success; gold marks reward and
  XP. Navigation chrome stays muted.
- **Playful motion.** Interactions use a spring curve
  (`cubic-bezier(0.34, 1.56, 0.64, 1)`); cards lift 2px on hover; modals
  slide-and-scale in.
- **Vietnamese-first copy.** Body text uses *Be Vietnam Pro*, chosen for full
  Vietnamese diacritic coverage.

Source: `src/styles/global.css`, `src/App.jsx`, `index.html`.

## Colors

Defined once as CSS custom properties in `src/styles/global.css` — dark values
on `:root`, light overrides on `[data-theme="light"]`.

**Surfaces (dark)**

- **Void Navy (`#08080f`, `--bg-primary`)** — the page background.
- **Deep Navy (`#0d0d1a`, `--bg-secondary`)** — modals, dropdowns, scrollbar
  track; the "solid panel" colour.
- **Raised Navy (`#111125`, `--bg-tertiary`)** — hovered rows and nested panels.
- **Glass White (`rgba(255,255,255,0.04)` → `0.07` on hover, `--bg-card` /
  `--bg-card-hover`)** — card fill.
- **Glass Border (`rgba(255,255,255,0.1)`, `--bg-glass-border`)** — the 1px
  hairline that defines every glass edge.

**Surfaces (light)** — `--bg-primary` becomes **#f4f6fb**, `--bg-secondary`
pure white, `--bg-tertiary` **#eef1f8**; cards become nearly opaque white
(`0.85` → `1`), and the glass border switches from white-alpha to
indigo-alpha (`rgba(99,102,241,0.15)`), so light-mode edges read as tinted
rather than washed out.

**Text**

- **Ice (`#f0f0ff` dark / `#0f172a` light, `--text-primary`)** — headings, body.
- **Slate (`#a0a0c0` / `#475569`, `--text-secondary`)** — supporting text,
  nav links, labels.
- **Muted (`#5a5a80` / `#94a3b8`, `--text-muted`)** — metadata, placeholders,
  disabled states.
- **Accent (`#a78bfa` / `#6366f1`, `--text-accent`)** — inline emphasis.

**Brand & signal**

- **Purple (`#8b5cf6`, light `#7c3aed`)** — the primary brand hue: active nav,
  focus rings, confirm actions, most hover tints (`rgba(139,92,246,0.08–0.25)`).
- **Purple Light (`#a78bfa`, light `#6366f1`)** — active/selected foreground.
- **Indigo (`#6366f1`, `--blue`)** — the opening stop of the hero gradient.
- **Cyan (`#06b6d4`, light `#0891b2`)** — the closing stop of the hero
  gradient and secondary accent.
- **Neon Green (`#00ff88`, light `#16a34a`)** — completion, success, "done".
  The dark value is a deliberately electric green; light mode swaps to a
  readable forest green.
- **Gold (`#ffd700`, light `#d97706`)** — XP, rewards, premium.
- **Red (`#ef4444`, light `#dc2626`)** — destructive actions and errors.
- **Orange (`#f97316`, light `#ea580c`)** — warnings, gold-gradient end stop.

Light mode re-tints **green, purple, cyan, gold, red, orange** for contrast on
a bright background. It does **not** re-tint `--blue`, `--purple-dark`,
`--cyan-light`, or `--green` gradients baked into `--grad-*` — see
*Do's and Don'ts*.

**Active gradients** (`--grad-*`, all `135deg`) are colour compositions, not
tokens in the front matter:

| Variable | Stops | Used for |
| --- | --- | --- |
| `--grad-hero` | `#6366f1` → `#8b5cf6` → `#06b6d4` | `.btn-primary`, restore FAB |
| `--grad-text` | `#a78bfa` → `#06b6d4` | `.gradient-text`, logo, progress fill |

## Typography

Two Google fonts, loaded in `index.html`:

- **Plus Jakarta Sans** (`--font-display`, weights 500–800) — all headings
  (`h1`–`h6`), buttons, badges, section labels, modal titles, the logo. Set
  heavy (600–900) and tight (`line-height: 1.2`).
- **Be Vietnam Pro** (`--font-body`, weights 400–700 + italic 400) — `body`
  default at `16px` / `line-height: 1.6`, used for all prose, nav links,
  inputs and table content.

Root font size is `16px` (`html`), so `1rem = 16px`.

**Fluid display scale.** The five display/heading utility classes in
`global.css` are fluid via `clamp()`:

| Class | fontSize | Weight |
| --- | --- | --- |
| `.display-1` | `clamp(2.5rem, 6vw, 5rem)` | 900 |
| `.display-2` | `clamp(2rem, 4vw, 3.5rem)` | 800 |
| `.h1` | `clamp(1.8rem, 3vw, 2.5rem)` | 700 |
| `.h2` | `clamp(1.4rem, 2.5vw, 2rem)` | 600 |
| `.h3` | `clamp(1.1rem, 2vw, 1.4rem)` | 600 |

The front matter records the **upper bound** of each clamp, because the
DESIGN.md `Dimension` type cannot express `clamp()`. Always implement these as
the clamp expression above, never the fixed maximum.

**Small-text scale.** Component text lives in a narrow band between
`0.6rem` and `1rem`; the recurring steps observed across the shared components
are `0.6` (bottom-tab label), `0.65` (sidebar section label), `0.75`
(caption), `0.8` (badge), `0.82` (dropdown option / form label), `0.85`
(sidebar link, select trigger), `0.88`, `0.9` (input) and `1rem` (button,
modal title).

**Uppercase labels.** Only two: `.section-label` (`0.85rem`, `0.05em`
tracking) and `.sidebar__section-label` (`0.65rem`, `0.08em` tracking).

Sources: `index.html`, `src/styles/global.css`, `navbar.css`,
`generic-modal.css`, `confirm-modal.css`, `datepicker.css`, `collect.css`.

## Layout

**App shell** (`src/App.jsx`, `src/styles/navbar.css`) — a fixed sidebar plus a
content column, swapping to a mobile top-bar + bottom-tabs pattern at 768px:

- **Desktop (`min-width: 769px`)** — fixed `.sidebar`, `232px`
  (`--sidebar-width`), `z-index: 100`, padded `1.25rem 0.75rem`. `.app-content`
  takes `margin-left: var(--sidebar-width)`. `.topbar` and `.bottom-tabs` are
  force-hidden.
- **Mobile (`max-width: 768px`)** — `.sidebar` is force-hidden; a `52px`
  `.topbar` (`--topbar-height`) is fixed to the top and a `60px` `.bottom-tabs`
  bar (`--bottom-tabs-height`, plus `env(safe-area-inset-bottom)`) to the
  bottom. `body` gets matching `padding-top` / `padding-bottom`.
- **Compact (`max-width: 520px`)** — task row actions collapse from inline
  buttons into an overflow menu (`.task-actions--mobile`), and
  `.dp-popover` becomes a full-width bottom sheet.

The sidebar nav is a scrollable flex column (`gap: 2px`) with an `auto`-margin
bottom block holding XP, theme toggle and account.

**Content grid** — `.container`: `max-width: 1200px`, centred, `0 2rem`
horizontal padding, dropping to `0 1rem` below 768px. `.section`: `6rem 0`
vertical rhythm, dropping to `4rem 0` below 768px.

**Spacing scale** — an 8-point-ish rem scale in `global.css`:
`0.25 / 0.5 / 1 / 1.5 / 2 / 3 / 4 / 6rem` (`--space-xs` … `--space-4xl`).
Cards pad at `--space-xl` (2rem), modals at `--space-2xl` (3rem).

Note: component-internal padding in the shared components is written as raw
rem values (e.g. `0.6rem 0.85rem`, `1rem 1.25rem`), not `--space-*` tokens.

**Shared stacking order** — nav chrome 100 · task overflow menu 800 ·
`.dp-backdrop` and global audio player 999 · `.generic-modal-backdrop` and
`.dp-popover` 1000 · `.cm-overlay` 9000 · `.kb-sort-dropdown` 9999. Scoped
dialogs such as Auth, onboarding, quick capture, editor overlays and Vault own
their stacking context; inspect their module CSS before nesting dialogs.

## Elevation & Depth

Depth comes from **translucency + blur + glow**, not from stacked grey shadows.

**Shadow tokens** (`global.css`, both themes) — three neutral steps and four
coloured glows:

| Token | Dark | Light |
| --- | --- | --- |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.3)` | `0 2px 8px rgba(0,0,0,0.08)` |
| `--shadow-md` | `0 8px 32px rgba(0,0,0,0.4)` | `0 8px 32px rgba(0,0,0,0.1)` |
| `--shadow-lg` | `0 24px 64px rgba(0,0,0,0.5)` | `0 24px 64px rgba(0,0,0,0.12)` |
| `--shadow-purple` | `0 0 40px rgba(139,92,246,0.2)` | `0 0 40px rgba(99,102,241,0.15)` |
| `--shadow-cyan` | `0 0 40px rgba(6,182,212,0.15)` | `0 0 40px rgba(6,182,212,0.1)` |
| `--shadow-green` | `0 0 20px rgba(0,255,136,0.3)` | `0 0 20px rgba(0,200,100,0.2)` |
| `--shadow-gold` | `0 0 20px rgba(255,215,0,0.3)` | `0 0 20px rgba(245,158,11,0.2)` |

The coloured glows are **spread-only** (`0 0 Npx`) — they signal state
(hovered, checked, active) rather than height.

**Glassmorphism recipe** — three ingredients, always together:

1. a translucent fill (`--bg-card`, `--bg-glass`, or an `rgba(8,8,15,0.92)`
   style chrome fill),
2. a 1px hairline border (`--bg-glass-border` or `rgba(255,255,255,0.06–0.1)`),
3. `backdrop-filter: blur()` with the `-webkit-` prefix alongside.

Observed blur radii, by active shared role: `4px` modal backdrops
(`.generic-modal-backdrop`, `.cm-overlay`) · `12px` `.card`, audio player ·
`16px` `.kb-sort-dropdown` · `20px` `.topbar`, nav menus · `24px` `.sidebar`,
`.bottom-tabs`. Scoped domains keep their own values; Vault scrim uses `6px`.

**Layer order** — page (`--bg-primary`) → glass card (white-alpha + blur) →
solid panel (`--bg-secondary`, modals/dropdowns) → coloured glow on state.
Hovered cards additionally lift `translateY(-2px)` and take `--shadow-purple`.

**Motion tokens** — `--transition-fast` `0.15s ease`, `--transition-base`
`0.3s ease`, `--transition-slow` `0.6s ease`, `--transition-spring`
`0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`. The universal
`*, *::before, *::after` rule cross-fades `background-color`, `border-color`,
`color` and `box-shadow` over `0.25s ease` so theme switching animates.
`.page-transition` (0.22s) is disabled under
`prefers-reduced-motion: reduce`.

## Shapes

Everything is soft-cornered. Radii come from `--radius-*` in `global.css`:

| Token | Value | Applied to |
| --- | --- | --- |
| `--radius-sm` | `8px` | dropdown options, datepicker cells/tabs/inputs, nav menu items |
| `--radius-md` | `12px` | inputs, sidebar links, bottom-tab items, overflow menu, select dropdown |
| `--radius-lg` | `16px` | `.card`, `.generic-modal`, `.dp-popover`, nav menus, select trigger |
| `--radius-xl` | `24px` | `.cm-dialog`, audio player |
| `--radius-full` | `9999px` | buttons, badges, pills, progress bars, `.section-label` |

Circular controls (`.gap-btn`, `.nav-avatar`,
`.sidebar__theme-toggle`, status dots) use
`border-radius: 50%`; the webkit scrollbar thumb uses `3px`.

**Pill vs rounded rectangle** is a semantic distinction: *actions and
statuses* are pills (`--radius-full`); *containers and fields* are rounded
rectangles.

Border weight is `1px` almost everywhere; datepicker read-only dots use `1.5px`.

## Components

### Button — `.btn` + variants (`global.css`)

Inline-flex, `gap: var(--space-sm)`, `padding: 0.75rem 1.75rem`,
`--radius-full`, display font at `600 / 1rem`, `--transition-spring`.
A `::before` overlay (`rgba(255,255,255,0.1)`) fades in on hover; `:active`
scales to `0.97`.

| Variant | Fill | Text | Shadow |
| --- | --- | --- | --- |
| `.btn-primary` | `--grad-hero` | `white` | `0 4px 24px rgba(99,102,241,0.4)` → `0 8px 40px …0.6` on hover, lifts `-2px` |
| `.btn-ghost` | transparent, `1px --bg-glass-border` | `--text-primary` → `--purple-light` | none |

Disabled (`.btn-primary:disabled`) is `opacity: 0.4`, `cursor: not-allowed`,
transform and shadow forced off, `pointer-events: none`.

### Card — `.card` (`global.css`)

`--bg-card` fill, `1px --bg-glass-border`, `--radius-lg`, `--space-xl`
padding, `blur(12px)`, `--transition-base`. Hover → `--bg-card-hover`,
border `rgba(139,92,246,0.3)`, `translateY(-2px)`, `--shadow-purple`.

### Modal — two shared implementations

`GenericModal` (`generic-modal.css`) is the reusable
header/body/footer dialog. Backdrop `rgba(0,0,0,0.55)` + `blur(4px)`,
`1rem` padding. Panel `--bg-secondary`, `1px rgba(255,255,255,0.08)`,
`--radius-lg`, `max-width: 440px`, `max-height: 90vh` scrollable,
`modalSlideUp 0.25s` spring. Header `1rem 1.25rem` with a bottom hairline and
display font `700/1rem`; body `1.25rem` flex column `gap: 0.75rem`; footer
`0.75rem 1.25rem`, right-aligned, `gap: 0.5rem`, top hairline.

`ConfirmModal` (`confirm-modal.css`) is the centred alert. Overlay
`rgba(0,0,0,0.55)` + `blur(4px)` at `z-index: 9000`. Dialog `--bg-secondary`,
`1px rgba(255,255,255,0.1)`, `--radius-xl` (with a `16px` fallback),
`2rem 1.75rem 1.5rem` padding, `max-width: 400px`, double shadow
(`0 24px 64px rgba(0,0,0,0.5)` + `inset 0 0 0 1px rgba(255,255,255,0.05)`),
`cm-dialog-in 0.18s` spring; contents centre-aligned with `gap: 0.6rem`.
Its buttons are **not** `.btn`: `.cm-btn` is `flex: 1`, `max-width: 160px`,
`--radius-md`, `0.6rem 1.25rem`, `0.88rem/600`, with tinted-alpha variants —
cancel (white-alpha), confirm (purple-alpha, text `#c4b5fd`), danger
(red-alpha, text `#fca5a5`) — and a `2px` outline on `:focus`, offset `2px`.
Light mode overrides dialog, cancel, confirm and danger separately.

AuthModal, onboarding, quick capture, Tiptap shortcut UI and the Vault template
dialog use scoped backdrops/dialogs rather than these shared primitives. Keep
those exceptions inside their module. The `.modal-overlay`/`.modal-content`
block still present in `global.css` has no JSX consumer and is tracked as debt
below, not as an active component.

### Input — `.generic-modal__input` (`generic-modal.css`)

The reference field: full width, `0.6rem 0.85rem`, `rgba(255,255,255,0.04)`
fill, `1px rgba(255,255,255,0.1)`, `--radius-md`, `--text-primary`,
`0.9rem`, `--transition-base`. Focus removes the outline and applies
`border-color: var(--purple)` plus a `0 0 0 3px rgba(139,92,246,0.15)` ring.
Its label (`.generic-modal__label`) is `0.82rem/600` in `--text-secondary`.

`.dp-time__input` follows the same fill/border recipe at `--radius-sm` and
`0.3rem 0.5rem`, with a focus border of `rgba(139,92,246,0.4)` and no ring.
There is no global `input` element style — page modules define their own.

### CustomSelect — `.kb-custom-select` (`collect.css` + `CustomSelect.jsx`)

Trigger `.kb-sort-trigger`: `0.6rem 0.9rem`, `rgba(255,255,255,0.04)` fill,
`1px rgba(255,255,255,0.1)`, `--radius-lg`, `--text-secondary`, `0.85rem`,
`font-family: inherit`; hover raises fill to `0.08` and border to `0.2`.
A `▼` caret in `--text-muted` at `0.7rem` sits at the right, inline-styled in
the component.

Dropdown `.kb-sort-dropdown`: absolute under the trigger (`margin-top:
0.4rem`), `--bg-secondary` + `blur(16px)`, `1px --bg-glass-border`,
`--radius-md`, `--shadow-lg`, `min-width: 140px`, `0.25rem` padding,
`z-index: 9999`, `gap: 1px`. Options: `0.5rem 0.75rem`, `--radius-sm`,
`0.82rem`, `--text-secondary`; hover → `--bg-tertiary` + `--text-primary`;
`--active` → `--purple-light` at weight 600 with a `--purple` `✓`.
Closes on outside `mousedown`.

### SkeletonList — `.sk-*` (`skeleton.css`)

Khung chờ dùng chung cho **mọi** màn list. Một dòng skeleton giữ đúng chỗ của dòng
thật: ô icon `34px` bo `10px`, hai dòng chữ `13px`/`9px` bo `5px`, khối phải
`68px`+`44px`. Bề rộng dòng chữ so le theo chu kỳ 3 (`62/38`, `48/54`, `70/30`) để
khối skeleton không ra một hình chữ nhật đều tăm tắp.

Hiệu ứng là **một** vệt sáng chạy ngang cả danh sách (`.sk-list::after`,
`linear-gradient(100deg, …)` + `background-position` 1.7s), không phải mỗi ô tự
nhấp nháy: một layer animate, và mắt đọc là "đang tải" chứ không phải "hỏng". Nền
`--sk-fill` `rgba(255,255,255,0.07)`, đảo sang `rgba(15,23,42,0.08)` ở
`[data-theme="light"]`. `prefers-reduced-motion` tắt vệt sáng, giữ khung tĩnh.

Props: `rows` · `icon` · `lines` · `right` · `plain` (bỏ viền) · `heading` (thanh
tiêu đề, chỉ dùng cho skeleton toàn trang) · `gap`. Container mang
`role="status" aria-busy="true"` kèm `aria-label` mô tả đang tải cái gì.

Luật: **đang tải thì không được hiện empty state**. Báo "chưa có gì" rồi một giây
sau bung ra 20 dòng là kiểu nói dối gây mất niềm tin, và layout nhảy đúng lúc mắt
vừa dừng lại đọc.

### DatePickerPopover — `.dp-*` (`datepicker.css`)

Absolute popover, `380px` wide, `--bg-primary` fill, `1px
rgba(139,92,246,0.2)`, `--radius-lg`, `0 12px 40px rgba(0,0,0,0.5)` plus a
`0 0 0 1px rgba(255,255,255,0.04)` ring, `dpSlideIn 0.15s`; a transparent
`.dp-backdrop` at `z-index: 999` catches outside clicks.

Structure: header (mode tabs + current value chip, `0.6rem 0.75rem`) → body
(`140px` shortcut column + calendar, `min-height: 230px`) → time row →
footer (Cancel / Save). Tabs and chips use purple-alpha tints
(`0.12`–`0.15` fill, `0.25`–`0.3` border, `#a78bfa` text). The grid is
`repeat(7, 1fr)` with `aspect-ratio: 1` cells at `--radius-sm`; today is
`#ef4444` with a `4px` dot; selected is `rgba(139,92,246,0.25)` +
`1px rgba(139,92,246,0.4)` + `#c4b5fd`. Save is disabled at `opacity: 0.4`
and brightens through `--active` and `:hover`. Prop `max` (yyyy-MM-dd) khoá ngày
sau mốc đó: cell và shortcut vượt mốc dùng `:disabled` — `opacity: 0.3`,
`cursor: not-allowed`, không đổi nền khi hover.

### InfoTip — `.infotip*` (`infotip.css`)

Nút tròn `18px` mang icon `question`, nền accent `20%` + viền accent `50%` **sẵn từ
đầu** (không chờ hover): chú thích phải bấm mới hiện thì cái nút buộc phải tự nói là
bấm được. `is-open`/`:hover` đảo thành nền accent đặc. Bong bóng mở dưới nút
(`top: 100% + 7px`, `max-width: min(340px, 74vw)`, `--shadow-md`, `infotip-rise .13s`),
`align="right"` cho nút nằm sát lề phải.

Toàn bộ màu đi qua bốn biến `--it-bg` / `--it-txt` / `--it-txt2` / `--it-border` +
`--it-accent`; module có palette scoped chỉ đè bốn biến đó (`.finance-module .infotip`
→ `--n-*`), không viết lại rule. Mọi rule viết dạng `.infotip .infotip__x` để thắng
style của khung chứa (`.fin-summary-strip span` sẽ bóp cỡ chữ trong bong bóng).

Dùng nó thay cho đoạn chú thích dài để trần trong layout — dải tổng màn Hóa đơn là ca
đầu tiên. Không dùng `title` HTML: không mở được bằng cảm ứng, không xuống dòng.

`.fin-badge` là chip nhỏ cạnh tên dòng, nền `--n-accent-soft`, `inline-flex` nên chứa
được icon + chữ. `RuleCard` nhận `badge` là một nhãn HOẶC mảng nhãn — dòng hóa đơn có
thể vừa mang chip chu kỳ (`⟳ 3 tháng/lần`, chỉ hiện khi hóa đơn KHÔNG phải hằng tháng)
vừa mang chip số kỳ trả góp. Hằng tháng là mặc định nên cố tình không có chip: gắn nhãn
cho mọi dòng thì chip mất tác dụng phân biệt.

`.fin-explain` là hộp `<details>` giải thích cơ chế, gập mặc định, nền `--n-arch` như
`.fin-archived`; `<em>` bên trong không in nghiêng mà được dùng làm nhãn tên trường.

Trong Finance, mọi ô ngày đi qua `DateField` (`.fin-datefield`, `parts.jsx`):
khung `.fin-input` chứa ô chữ **gõ tay được** (mask `dd/mm/yyyy`, `parseDmy` từ
chối ngày không có thật rồi trả ô về giá trị cũ khi blur) + nút lịch bên phải mở
popover. Không dùng `<input type="date">` ở module này — định dạng của nó do ngôn
ngữ trình duyệt quyết định nên máy tiếng Anh ra mm/dd/yyyy.

Popover neo `top: 100%`, nhưng **lật lên `bottom: 100%`** khi khoảng trống dưới ô
nhỏ hơn chiều cao popover (~430px) và phía trên đủ chỗ — ô ngày nằm cuối trang thì
mở xuống sẽ đẩy nút Lưu ra ngoài vùng cuộn.
Below 520px it becomes a fixed bottom sheet: full width, top corners only,
`max-height: 70vh`, shortcuts hidden, footer padded with
`max(0.5rem, env(safe-area-inset-bottom))`.

**`mode="range"`** (v6.1.0) — the same popover picks a span. Two header chips
(Từ / Đến) replace the single value chip, the shortcut column swaps its
forward-looking entries (Ngày mai, Tuần sau, 8 tuần) for backward presets
(Hôm nay, Hôm qua, 7 ngày, 2 tuần, 3 tháng, 6 tháng, 1 năm), and the time row
hides. Both ends reuse `.dp-grid__cell--selected`; the days between get
`.dp-grid__cell--in-range` — purple-alpha `0.12` with `border-radius: 0`, so
the run reads as one bar rather than a scatter of selected days. The presets
live **in** the popover rather than as chips beside it because a preset must
set *both* ends, which a single-date shortcut cannot.

### Navigation — `.sidebar` / `.topbar` / `.bottom-tabs` (`navbar.css`)

Sidebar: `rgba(8,8,15,0.92)` + `blur(24px)`, right hairline
`rgba(255,255,255,0.06)`. Logo at `800/1.15rem` display font with a
`--grad-text` clipped-text wordmark and a `pulse-glow 2s` icon. Links:
`0.55rem 0.75rem`, `--radius-md`, `0.88rem/500`, `--text-secondary`;
hover adds `rgba(255,255,255,0.06)`; `--active` is `--purple-light` on
`rgba(139,92,246,0.12)` at weight 600. `--secondary` links drop to
`0.82rem` / `--text-muted`. Section labels are `0.65rem/700` uppercase,
`0.08em` tracking, `--text-muted`.

Top bar: `52px`, same fill and blur `20px`, logo at `800/1.05rem`.
Bottom tabs: `60px`, `rgba(8,8,15,0.95)` + `blur(24px)`, tabs are icon
(`1.25rem`) over label (`0.6rem`), `--text-muted` → `--purple-light` when
active. The "More" dropdown opens upward (`bottom: calc(100% + 8px)`),
`rgba(15,15,30,0.97)` + `blur(20px)`, `--radius-lg`, shadow
`0 -8px 32px rgba(0,0,0,0.5)`.

Avatar `.nav-avatar`: `34px` circle, `linear-gradient(135deg, var(--purple),
var(--cyan))`, white `0.75rem/700` initials, `1px rgba(255,255,255,0.12)`;
hover → `--cyan-light` border, `scale(1.05)`. Theme toggles are `34px`
(sidebar) / `32px` (topbar) circles that `rotate(15deg) scale(1.05)` on hover.
Light mode re-tints every one of these to indigo-alpha.

### Tasks page atoms — `.tasks-*` / `.task-*` (`tasks.css`)

Added v4.29.0 for `/tasks`. All values come from existing tokens; no new colour
is introduced.

- **`.tasks-hero`** — the page's focal point. `.tasks-hero__num` is
  `--font-display` at `clamp(2.5rem, 8vw, 3.75rem)/800`, `-0.03em` tracking,
  wearing `.gradient-text` so it clips `--grad-hero`. Paired with a `0.95rem`
  `--text-secondary` unit label. This is the one place on the page allowed a
  display-scale number.
- **`.tasks-stat`** — three `68px`-min tiles, `--bg-card` on
  `1px --bg-glass-border`, `--radius-md`. Value `1.25rem/700` display font,
  label `0.68rem --text-muted`. **Volume ladder, not a palette:**
  `--overdue` gets `rgba(239,68,68,0.1)` fill + `0.28` border + `--red` value,
  `--today` gets a plain card with a `--purple-light` value, `--future` is the
  same card at `opacity: 0.6`. Loudness encodes urgency.
- **`.tasks-viewbar__tab`** — pill view switcher, same formula as
  `.inbox-filter-chip`: `--radius-full`, `--bg-card` on `--bg-glass-border`,
  `--text-muted`; active → `rgba(139,92,246,0.18)` fill, `0.45` border,
  `--purple-light`. `role="tablist"` + `aria-selected` on each tab.
- **`.task-checkbox-btn`** — `22px`, `--radius-sm`, `2px` brand-alpha border
  (red-alpha when overdue), `--transition-spring`. The `✓` is a `::after`
  pseudo-element, so ticking needs no extra DOM and no React state: `:hover`
  → green border + `0.55` opacity glyph, `:active` → `scale(1.35)` +
  `--shadow-green` + full glyph. Wrapped in a
  `prefers-reduced-motion: reduce` escape that drops both the transition and
  the scale.
- **Priority stripe** — a `3px` `border-left` on `.task-item`, coloured from
  `PRIORITY_OPTIONS` in `TaskListSection.jsx` (`#94a3b8` → `#ef4444`). Applied
  inline rather than as five classes because the colour already lives in that
  array. Overdue rows keep the red background but the stripe wins on
  `border-left-color`.
- **`.task-group__head`** (v6.1.0) — group header, `0.85rem/700 --font-display`,
  one role colour each: overdue `#f87171`, today `--purple-light`, future
  `--text-secondary`, done `--green`. The count is a pill whose fill is
  `currentColor` with `--bg-primary` text, so it inherits the row's role colour
  instead of adding four more rules. `button.task-group__head` re-declares
  `display: flex` because `.task-list-card button` forces `inline-flex` at the
  same specificity earlier in the file.
- **`.task-row-sep`** (v6.1.0) — the `|` between tick and content: `2px`
  `--radius-full`, `rgba(255,255,255,0.14)` (dark) / `rgba(15,23,42,0.14)`
  (light), green-alpha in the done panel. Neutral by design — priority is
  already carried by the `border-left` stripe, and two encodings of one fact
  is one too many.
- **`.task-done-card`** (v6.1.0) — completed history is its **own** box outside
  `.task-list-card`: `--radius-lg`, `rgba(0,255,136,0.22)` hairline on a
  `0.03` fill. Rows repeat the formula at `--radius-md` / `0.25` / `0.06`.
  `.task-done-at` ("Xong lúc …") is the loudest thing in the row — a
  `--radius-full` badge at `0.16` fill, `0.35` border, `--green` display text —
  because the timestamp is what the panel exists to show. No `line-through`:
  the green frame already says done, and the strike only hurt legibility.
  `.task-checkbox-btn--done` shows its `::after` ✓ permanently and flips to
  red-alpha on hover, so "click to un-do" is legible before the click.
- **`.task-act-btn`** (v6.1.0) — row action buttons. Replaces
  `opacity: 0.5–0.6` icons whose hover was driven by inline
  `onMouseEnter/onMouseLeave` JS: a `30px` square, transparent until hover,
  then purple-alpha `0.16` fill on a `0.4` border (red-alpha for `--danger`).
  Icons ride at Phosphor `weight="bold"`, `16px`. Faintness was the bug; the
  fix is a hit area and a real hover state, not a heavier icon set.
- **`.task-empty`** — empty state, not a blank line: a `52px --radius-full`
  green-alpha disc holding `✓`, a `1.05rem/700` display title, and a
  `0.82rem --text-muted` hint capped at `30rem`.

### Landing — `.lp-*` (`landing.css`)

Rewritten v5.0.0, replacing `hero.css` + `sections.css` + `testimonials.css`
(822 lines of marketing chrome for a product that no longer exists). The page
is a login door and a module map, not a sales pitch.

- **Hero ambience is spread-only.** Two `filter: blur(90px)` orbs — purple
  `0.35` top-left, cyan `0.28` top-right — plus a `48px` grid overlay masked by
  a `radial-gradient` ellipse so it fades before touching the edges. Both are
  `pointer-events: none`. This is the one place the system uses large blurred
  colour fields; everywhere else glow is a `box-shadow` state signal.
- **`.lp-card` extends `.card`**, adding only a `3px` `border-left` in
  `--lp-accent` — a custom property set inline per card from the module's own
  colour, the same trick `.task-item` uses for its priority stripe. `.card:hover`
  recolours all four borders, so `.lp-card:hover` re-pins `border-left-color`
  or the stripe washes out. Bullet markers pick up the accent via `::marker`.
- **`.lp__theme`** — a `40px` fixed glass circle. It exists because `Navbar`
  returns `null` on `/` for logged-out visitors, so without it a guest cannot
  reach the light/dark toggle at all. Same `rotate(15deg) scale(1.05)` hover as
  the sidebar toggle, with a `prefers-reduced-motion` escape.
- **Grids use `minmax(min(100%, Nrem), 1fr)`**, not bare `minmax(Nrem, 1fr)` —
  the bare form overflows below `Nrem` viewports instead of collapsing to one
  column.
- Light mode overrides only the two raw white-alpha surfaces: the grid overlay
  re-tints to indigo-alpha `0.06`, and orb opacity drops to `0.35`. Everything
  else rides tokens that already invert.

### Task Detail Modal — `.task-detail-modal` / `.td-*` (`task-detail.css`)

Added v5.0.0. Read-first task detail with two tabs (change history / personal
notes); v6.1.0 can switch the same popup to the existing `TaskListSection` edit
form. Built **on `GenericModal`**, not a fourth modal system.

- **One scroll container.** `.generic-modal` puts `overflow-y: auto` on the
  panel, so the header scrolls away once the history is long. `.task-detail-modal`
  flips to `display: flex; flex-direction: column; overflow: hidden;
  max-height: 88vh` and moves the scroll to `.generic-modal__body`
  (`flex: 1; min-height: 0; overflow-y: auto`) — the same recipe
  `.incubator-detail` already uses. Nested scroll areas are deliberately
  avoided: one scrollbar, not two.
- **Tabs reuse `.tasks-viewbar__tab`** verbatim — same pill, same
  `rgba(139,92,246,.18)` active tint as the Danh sách/Lịch switcher directly
  above it on the page. Zero new tab CSS; `role="tablist"` + `aria-selected`
  carried over. `.td-panel` holds `min-height: 180px` so the frame does not
  jump when the two tabs differ in row count.
- **`.td-row`** — one history line: a `22px` `--radius-full` icon disc
  (`--bg-card` on `--bg-glass-border`), a flexible body, and a delete button.
  The old→new pair is `.td-val--old` (`--text-muted`, `line-through`, `--bg-card`)
  → `.td-arrow` → `.td-val--new` (purple-alpha `0.12` fill on `0.22` border),
  both `overflow-wrap: anywhere` so a pasted URL wraps instead of widening the
  dialog. Values over 80 characters truncate to a `.td-more` toggle.
- **`.td-del` never hover-reveals.** It sits at `opacity: 0.5` permanently —
  touch has no hover, and a control that only appears on hover is a control
  that does not exist on a phone. Below 520px it grows to a 44px target.
- **`.td-grid`** — `96px 1fr` label/value grid at `0.78rem`. Rows whose value is
  `undefined` are not rendered at all rather than showing `—`: a task opened
  from the calendar carries only five columns, and an em-dash there would state
  something false.
- **Edit stays inside the modal.** `TaskDetailModal` receives `editContent` from
  `TaskListSection`; pressing Edit swaps the body to the same form used by the
  list. No second form, no navigation, and Cancel returns to the detail body.
- **Bottom sheet below 520px** — the same breakpoint `.task-actions--mobile`
  and `.dp-popover` already use. Reached with
  `.generic-modal-backdrop:has(.task-detail-modal)` so `GenericModal` (shared by
  six other callers) needs no new prop; browsers without `:has()` keep the
  centred dialog — degraded, not broken.
- Four raw white-alpha surfaces (`.td-row` border, `.td-note`, `.td-composer`
  border, `.td-textarea`) each carry a `[data-theme="light"]` override, plus
  `.td-val--new` which re-tints purple→indigo. Everything else rides tokens
  that already invert.

### Calendar task mode — `.cal-cell--tasks` / `.cal-chip` (`calendar.css`)

`MonthCalendar` renders completed and pending tasks together.

- **`.cal-grid`** — must be `repeat(7, minmax(0, 1fr))`, **never** `repeat(7, 1fr)`.
  `1fr` is `minmax(auto, 1fr)`, so a non-wrapping child (the `nowrap` task chip)
  pushes its column wider and skews all seven. Pair it with `min-width: 0` on
  the cell and the chip wrapper, or the ellipsis never triggers.
- **`.cal-cell--tasks`** — drops `aspect-ratio: 1`, fills the fixed grid row,
  top-aligns content and stretches children across the cell. Carries a
  `1px --bg-glass-border` hairline over `--bg-card`: without the hairline the
  grid stops reading as a grid and becomes floating numerals.
- **`.cal-cell--tasks.cal-cell--done`** — keeps the plain `--bg-card` fill and
  only lifts its border to `rgba(0,255,136,0.28)`. A green cell behind a green
  chip would collapse into one heavy block: colour belongs to the chip, weight
  belongs to the border.
- **`.cal-chip`** — `0.6rem/500`, `3px` radius, `rgba(0,255,136,0.14)` fill with
  `--green` text, single-line ellipsis. Normal days show four task chips;
  holidays show three to reserve one row for the label. Overflow uses a
  `.cal-chip--more` counter computed from that cell's limit. Light theme swaps to
  `rgba(22,163,74,0.12)` on `#15803d`.
- **`.cal-cell--empty`** — a past day with no completed task keeps the hairline
  but takes no fill. Having no task that day is not an error state.
- **`.cal-cell--tasks.cal-cell--future`** — `dashed` border at `opacity: 0.45`.
  The cell stays present so the grid rhythm is unbroken.
- **Equal rows, not square cells** (v6.1.0) — `.cal-grid` sets
  `grid-auto-rows: 124px` and `.cal-cell--blank` drops `aspect-ratio: 1`. The
  square was the bug: on a wide page a square cell is as tall as a column is
  wide, so the leading row of blanks stood three times taller than every other
  row. `124px` is measured, not chosen — day number + four `.cal-chip`s + the
  `+N nữa…` line. A holiday replaces one visible task row with its label, keeping
  the same capacity; 3 tasks + counter + holiday needs about 103px of 122px.
- **`.cal-cell--today`** (v6.1.0) — purple border **and** the day number inside
  a solid `--purple` pill. A border alone read the same as
  `.cal-cell--selected`'s outline; today has to survive being also selected.
- **`.cal-cell--holiday`** (v6.1.0) — gold-alpha `0.08` fill on a `0.5` border,
  sourced from `holidays.json` (solar and lunar keys). The holiday label uses
  normal document flow below task chips, so it cannot cover `.cal-cell__lunar`
  in the date header. Narrow screens hide the star and clamp the name to 3 lines.
- **Light mode is not free here.** Every calendar surface was
  `rgba(255,255,255,…)`, which is invisible on `#f4f6fb`; v6.1.0 adds
  `[data-theme="light"]` pairs for nav buttons, month stats, day detail, cell
  borders, future cells and chips. Treat white-alpha as a dark-only material.
- **No week/day time grid.** `user_tasks.due_time` defaults to `23:59`, so an
  hour × day grid would stack every task in one bottom row. The expensive parts
  of that layout (hour gutter, overlap collision solving, drag-resize,
  now-indicator) buy nothing for all-day data.

### Account vault — `.acc-*` (`accounts.css`)

Rebuilt v5.2.0 for `/accounts` to the **Keyplate** design handoff. Header · filter
bar · two-pane body (item list · detail), breakpoint 900px.

- **This module owns a scoped token set — one of two deliberate domain
  exceptions alongside Finance Nocturne (`--n-*`).** Everything inside Vault
  otherwise reads its Keyplate tokens instead of `--purple` / `--radius-*` from
  `global.css`; the vault instead declares a *scoped* Keyplate palette on
  `.acc-vault` (`--color-accent: #7c5cff`, `--surface`, radius `18px`,
  `--lift-1/2`, a full dark set and a `[data-theme="light"] .acc-vault` override).
  The scope means **not one of these variables leaks** to the rest of the app.
  User decision (2026-08-05): `/accounts` must look exactly like the handoff. To
  retune vault colour/spacing, edit `accounts.css`, **not** `global.css`. This is
  the sanctioned way to carry a self-contained design into the app without
  polluting the global layer — do not copy the pattern casually.
- **Dark is the default, light is the override** — inverse of the handoff (which
  ships light-only) because the app's `:root` is dark. Two swaps easy to get
  wrong: `--color-accent-700` must **invert to a light step** (`#b4a0ff`) on dark
  because it carries every accent-coloured text (kicker, 3-letter codes, PRIMARY
  badges); and `--lift-1/2` become **hairline box-shadows** on dark because black
  shadows vanish on a dark ground and the whole interface goes flat.
- **Muted text is always `color-mix(in srgb, var(--color-text) N%, transparent)`,
  never a hard grey** — flipping `--color-text` fixes the whole muted ramp at once
  so it survives the theme flip untouched.
- **`.acc-warn--secure`** — the non-dismissible encryption status banner. It uses
  a green success treatment to state that full-content AES-GCM is active and
  enumerates which user-entered fields reach Supabase only as ciphertext.
- **Row panel (`.acc-panel`) — the module's core container,** shared by fields,
  sign-in methods and the code sheet. Built as `display: grid; gap: 1px;
  background: divider` so the 1px gaps *are* the row rules and each row sits on
  `--surface` — **plus a real `1px solid divider` border around the panel** and
  `overflow: hidden` + `18px` radius + `--lift-1`. Dropping that outer border (as
  an earlier pass did) leaves the panel edgeless and the whole page reads flat.
- **Edit mode uses real bordered controls, not borderless inline text.**
  `.acc-input` / `.acc-select` / `.acc-textarea` carry a `1px divider` border,
  `12px` radius and a `--ring` focus shadow. This is the **opposite** of the
  Proton-Pass-derived pattern the previous `/accounts` used ("the border belongs
  to the card, never the input"); that idea is not part of this design and
  re-applying it is what made edit mode look like naked text. Do not "clean up"
  these borders.
- **Every small ghost action is `11px / .08em / uppercase`** (`.acc-act`):
  Reveal, Hide, Copy, Generate, Make primary, Turn on/off, + Add value,
  + Link an item, Regenerate, Append, Show all N events, Delete item. Sentence
  case here reads as body copy and breaks the row rhythm.
- **`.acc-btn--primary` carries a violet glow** (`0 8px 20px -8px
  rgba(124,92,255,.65)`, deepening on hover). Without it the primary action is a
  flat purple rectangle — it is the single biggest contributor to the page
  feeling cheap.
- **`.acc-code`** — the 36px `12px`-radius chip carrying a template's 3-letter
  code, used in the sign-in rows. Accent-tinted when it marks a primary method.
- **`.acc-avatar` — the list row's 36px identity plate, and a deliberate
  departure from the handoff.** The prototype puts the 3-letter template code in
  this slot; with twenty `ACC` items that makes every row identical and unscannable.
  So the slot holds, in falling order: the item's **stored logo** (a 48×48 PNG data
  URI the user picked in edit mode, living inside the encrypted payload), then a
  **letter plate**. The code survives as a small `.acc-row__code` badge beside the
  title — it shares one rule with `.acc-link__code` so "item type" reads the same
  everywhere.
  - **Colour is a hashed hue, not a brand palette.** JS returns only a hue
    (`avatarHue`) into `--h`; CSS picks the lightness per theme
    (`hsl(var(--h) 62% 70%)` dark / `58% 36%` light), because a single letter
    needs different lightness on a dark vs light ground. Deliberately not the
    seven Life Hub brand tokens — those are tuned to the app's purple/cyan and
    would fight the vault's violet.
  - **`img` sits at `68%` with `object-fit: contain`,** not edge to edge. Logos are
    square-ish marks, not photos; stretching one to fill 36px turns it to mush,
    while insetting it reads as a logo on a plate.
  - **The plate is identical in both tiers.** Falling back to a letter is a *normal
    state, not an error state* — an item simply may not have a logo yet. It must
    look deliberate, which is why nothing about the plate changes when the image is
    absent.
  - **Nothing here touches the network.** Earlier versions fetched each service's
    own favicon (`/apple-touch-icon.png` → `/favicon.ico`) behind a `Logos` toggle;
    that whole path is gone. Opening a vault meant N requests to N domains, so those
    domains learned this IP had just opened a vault holding their account — a toggle
    only delays that, it does not remove it. And items with no URL field (bank
    cards, IDs) could never get a logo at all. The user picks the image once, it is
    encrypted with the item, works offline, and applies to any item type.
    Never reintroduce a favicon aggregator (google.com/s2, DuckDuckGo, Clearbit,
    logo.dev): handing one party the full list of domains you hold accounts at is
    self-disclosure of which bank and which exchange you use.
- **`.acc-link`** — the pointer to another item: accent-alpha pill with a small
  code badge, target title, borrowed value and a trailing `↗`. Pill because it
  navigates. A link whose target is gone becomes `.acc-link--dead` (divider
  border, no hover, "Missing item / link broken") — a normal state (jsonb links
  have no FK), not an error.
  - **"Linked from" section — an incoming link reads as a field row, not a chip in a
    bag.** A link is stored only on the source item, so without this the target (a
    bank account every card links to) looked unconnected. Each row reuses the
    `.acc-field` grid: label column = the **source field** that points here ("Bank
    login"), value column = the `.acc-link` chip for the source item, action column =
    a `Details` toggle. Details expands `.acc-backdetail` — a `dt`/`dd` pair per
    value, indented behind a divider rule so it reads as belonging to the chip above.
    **Expand in place rather than navigate:** these links are consulted at a glance
    ("which card of this bank, expiring when"), and jumping to the item loses where
    you stood. Values come from `linkableValues()` — the single definition of what
    may show without a Reveal step, so secrets can never leak in through this view.
    Section is hidden in edit mode, since navigating away drops the draft without
    asking.
- **`.acc-strength`** — a `180×5px` pill track at `9%` text with a pill fill whose
  `width` and `background-color` transition over 320ms. View-mode only, and only
  for `type="password"`; `secret` is never scored.
- **Masked values read as redacted, not a glyph blob:** `.acc-field__val--mask` is
  monospace with `0.12em` letter-spacing; revealing drops the spacing (`--open`).
- **`.acc-codecell__strike`** — a 1px rule animating `width: 0 → 100%` over 300ms
  when a single-use code is marked used, the cell fading to `opacity: 0.5`.
- **`.acc-hist`** — a left rail (`border-left` divider) with 8px round accent dots
  carrying a 3px `--color-bg` halo; timestamps 11px `.08em` uppercase tabular,
  detail lines switch to monospace when they contain masked bullets.
- **Native `<select>` (`.acc-select`) and a hand-built dialog, not `CustomSelect`
  / `GenericModal`.** RULES §5 recommends the shared controls, but the vault
  overrides both **on purpose** — those components are
  styled to Life Hub tokens and would break the scoped Keyplate look. Native
  controls styled with vault tokens (select arrow via inline SVG background) keep
  fidelity and are less code. Exception noted in `AccountDetail.jsx`.
- **`.acc-act` (Reveal / Copy / Generate) never hover-reveals** — permanent
  `62%`-text pills, same reasoning as `.td-del`: touch has no hover, and
  reveal/copy are the two controls a phone user reaches for. Generate is enabled
  and uses Web Crypto CSPRNG because every save path now writes ciphertext.
- **Two-pane, CSS-only breakpoint — and it is a `@container` query, not
  `@media`.** `.acc-body` is `minmax(300px,360px) minmax(520px,1fr)`; React holds
  only `selectedId` + `screen`. The handoff's 900px breakpoint measures **the
  vault's own width**; the prototype filled the viewport so the two were the same,
  but here the vault sits beside the 232px sidebar. Measured against the viewport,
  a 1100px window gives the vault 868px while it still tries to hold two panes —
  a horizontal scrollbar. So `.acc-vault` declares `container-type: inline-size`
  and the narrow rules live in `@container (max-width: 899px)`. The prototype's
  `min-width: 1040px` floor is **dropped** for the same reason; the real floor is
  the columns' own `300 + 520`. Touch targets ≥44px and inputs 16px when narrow
  (iOS zoom). No JS breakpoint, no `useMediaQuery`, no duplicated mobile markup.
- **The template dialog is portaled to `document.body`.** `container-type` implies
  `contain: layout`, which makes `.acc-vault` a containing block for
  `position: fixed` — a scrim rendered inside it would cover only the vault and
  leave the sidebar showing through. Because the portal breaks DOM inheritance,
  the token block is declared on **`.acc-vault, .acc-scrim`** rather than the
  vault alone, and the dialog's narrow rules use `@media` (no ancestor container).
  It is a hand-built dialog, not `GenericModal` — see the scoped exception above.
- **Filter-bar cells carry explicit `grid-column`/`grid-row`.** The Clear button
  is conditional; without explicit placement, auto-placement reflows the whole bar
  when it appears or disappears.
- **`.acc-cardview`** — the credit-card preview: `linear-gradient(140deg,…)` that
  **lightens on dark** (`#5b46c9 → #34277f → #241d52`) with a `1px` accent
  hairline so it does not merge into a dark page; number masked to the last 4
  until the Card number field is revealed.
- Motion collapses to `1ms` under `prefers-reduced-motion: reduce` via a single
  `--acc-dur` override on `.acc-vault`.

### Other active shared atoms (`global.css`)

- **`.section-label`** — uppercase pill, `0.4rem 1rem`,
  `rgba(139,92,246,0.12)` on `rgba(139,92,246,0.25)`, `--purple-light`,
  `0.85rem/600`, `0.05em` tracking.
- **`.progress-bar-track` / `-fill`** — `6px` tall, `--radius-full`,
  `rgba(255,255,255,0.08)` track, `--grad-text` fill, width eased over `0.8s`
  on the spring curve, with a `40px` `shimmer 1.5s` highlight.
- **Scrollbar** — `6px` wide, `--bg-secondary` track,
  `rgba(139,92,246,0.4)` thumb at `3px` radius, `--purple` on hover.

## Do's and Don'ts

**Tokens**

- **Do** use `src/styles/global.css` as the default source for colour, radius,
  spacing and shadow tokens. The only domain-scoped token systems are Vault
  Keyplate in `accounts.css` and Finance Nocturne (`--n-*`) in `finance.css`.
- **Don't** hard-code a hex or rgba for something a token already covers.
  Existing exceptions (`#c4b5fd`, `#fca5a5`, `#f87171`, `#a78bfa` written
  literally in `datepicker.css`) are debt, not precedent.
- **Do** add both themes when adding a colour: a `:root` value **and** a
  `[data-theme="light"]` override if the dark value would not read on
  `#f4f6fb`.
- **Don't** assume a CSS-variable fallback in existing code is the real value.
  Several fallbacks disagree with the token they shadow — see the TODO list
  below; use the token, not the fallback.

**Colour & theming**

- **Do** use purple for primary/active, green for completion, gold for
  reward/XP, red for destructive. One accent role per element.
- **Do** build state tints with brand-alpha layers on the existing scale —
  fill `0.08`–`0.25`, border `0.2`–`0.45` — rather than new solid colours.
- **Don't** put `--grad-hero`, `--grad-green` or `--grad-gold` behind body
  text; they are for fills and clipped display text only.
- **Don't** rely on light mode re-tinting a gradient: `--grad-*` values are
  declared once on `:root` and are **not** overridden for light theme.

**Typography**

- **Do** use `--font-display` (Plus Jakarta Sans) for headings, buttons,
  badges and labels, and `--font-body` (Be Vietnam Pro) for everything read as
  prose.
- **Don't** substitute a font that lacks Vietnamese diacritics.
- **Do** keep display sizes fluid with the exact `clamp()` expressions in
  `global.css`; the front-matter `fontSize` values are clamp upper bounds only.
- **Don't** introduce a new step into the `0.6`–`1rem` small-text band; pick
  the nearest existing size.

**Layout & shape**

- **Do** respect the 768px shell breakpoint: sidebar above it, top-bar +
  bottom-tabs below it, with matching `body` padding.
- **Do** honour `env(safe-area-inset-bottom)` for anything fixed to the bottom
  edge.
- **Do** use `--radius-full` for actions and statuses, and
  `--radius-sm/md/lg/xl` for containers and fields.
- **Don't** mix a pill and a rounded rectangle in the same control group.

**Depth & motion**

- **Do** ship all three glass ingredients together — translucent fill, 1px
  hairline, prefixed `backdrop-filter` — and keep chrome blurrier (20–24px)
  than content (12px).
- **Do** use `--shadow-sm/md/lg` for height and `--shadow-purple/cyan/green/
  gold` for state; don't swap their roles.
- **Do** use `--transition-spring` for interactive feedback and
  `--transition-base` for property changes.
- **Don't** animate anything essential without a
  `prefers-reduced-motion: reduce` escape, as `.page-transition` does.

**Accessibility**

- **Do** keep a visible focus indicator: the `.generic-modal__input` ring
  (`0 0 0 3px rgba(139,92,246,0.15)`) or the `.cm-btn` `2px` outline with
  `2px` offset.
- **Don't** communicate state with colour alone — pair colour with text, icon,
  shape or an explicit selected/disabled state.
- **Do** re-check contrast in both themes; `--text-muted` (`#5a5a80` on
  `#08080f`) is already at the low end for small text.

**Inconsistencies to resolve — TODO: decision needed**

These are real disagreements in the current code. They are recorded, not
silently resolved; pick a direction before touching the files involved.

1. **Radius fallbacks contradict the tokens.**
   `confirm-modal.css` writes `var(--radius-xl, 16px)` (token is `24px`) and
   `var(--radius-md, 8px)` (token is `12px`); `datepicker.css` writes
   `var(--radius-lg, 12px)` (token is `16px`) and `var(--radius-sm, 6px)`
   (token is `8px`). The rendered result uses the token — the fallbacks are
   misleading. TODO: decide whether to correct the fallbacks or drop them.
2. **Colour fallbacks name colours that do not exist in the system.**
   `var(--bg-secondary, #1a1a2e)` (`confirm-modal.css`),
   `var(--bg-primary, #1a1a2e)` (`datepicker.css`; token is `#08080f`),
   `var(--text-primary, #f1f5f9)`, `var(--text-secondary, #94a3b8)`,
   `var(--text-primary, #e2e8f0)`, and
   `var(--font-display, 'Inter', sans-serif)` — Inter is not a project font.
   TODO: decision needed.
3. **`.cm-dialog` vs other dialogs.** ConfirmModal uses `--radius-xl` and a
   `2rem 1.75rem 1.5rem` asymmetric padding while `GenericModal` uses
   `--radius-lg` and `1.25rem`. TODO: decide whether ConfirmModal should align.
4. **Two shared modal systems, scoped dialogs and dead global CSS.**
   `GenericModal` and `ConfirmModal` intentionally serve different interaction
   types. Auth, onboarding, quick capture, Tiptap and Vault retain module-scoped
   dialogs, while `.modal-overlay`/`.modal-content` in `global.css` has no JSX
   consumer. TODO: remove the dead block, then decide which backdrop/focus
   primitives should actually be shared.
5. **Buttons bypass `.btn`.** `.cm-btn`, `.dp-footer__save`,
   `.dp-footer__cancel`, `.kb-sort-trigger` and `.sidebar__link` each
   re-implement padding, radius and font instead of extending `.btn`.
   TODO: decision needed on whether a shared button base should absorb them.
6. **Component padding ignores the spacing scale.** Shared components use raw
   rem values (`0.6rem 0.85rem`, `0.55rem 0.75rem`, `1rem 1.25rem`,
   `0.4rem 0.65rem`, …) rather than `--space-*`. TODO: decide whether to add
   sub-`0.5rem` spacing tokens or accept raw values in components.
7. **CustomSelect lives in a page stylesheet.** The shared `CustomSelect`
   component depends on `.kb-sort-*` classes defined in
   `src/styles/collect.css`, and hard-codes layout in inline `style` props.
   TODO: decide whether to extract a `select.css` the way `generic-modal.css`
   was extracted.
8. **Eight blur radii.** `4/6/8/10/12/16/20/24px` are all in use with no
   `--blur-*` token. TODO: decide whether to tokenise.
9. **Light theme coverage is partial.** `[data-theme="light"]` overrides
    `--bg-*`, `--text-*`, `--shadow-*` and six brand colours, but not
    `--blue`, `--purple-dark`, `--cyan-light`, `--green-dim` (only
    partially), or any `--grad-*`. TODO: decision needed on completing it.
10. **No global form-control baseline.** There is no `input`/`textarea`/
    `select` element rule; each module restyles fields, and the "shared"
    reference is `.generic-modal__input`. TODO: decide whether to promote it.
11. **`.dp-grid__cell--other` uses raw white-alpha foregrounds** that need a
    dedicated light-mode check rather than relying on dark-theme material.
12. **Unused global utilities remain in CSS.** `.btn-neon`, `.btn-gold`,
    `.card-glow-*`, `.badge`, `.glass-panel`, `.divider` and `.fade-up` have no
    JSX consumer. The same applies to `--grad-card`, `.gradient-text-green` and
    `.gradient-text-gold`. They are excluded from the active catalog above;
    remove the CSS unless a real use appears.

**Expected linter warnings**

The remaining warnings are deliberate and should not be "fixed" by editing this file:

- **`borderColor` is not a recognised sub-token.** It is used anyway, per the
  spec's "unknown component property → accept with warning" rule, because a
  1px hairline is load-bearing in this glassmorphic system and dropping it
  would lose real design information.
- **WCAG AA contrast warnings** on the alpha-tinted controls
  (`.cm-btn--confirm`, `.dp-header__tab--active`, `.sidebar__link--active`,
  inputs, …). The linter composites the translucent fill over white; in the
  app these sit on `--bg-primary` (`#08080f`), so measured contrast differs.
  They are still worth auditing in the browser — `button-primary`
  (`#ffffff` on `#6366f1`, 4.47:1) and `nav-avatar` (`#ffffff` on `#8b5cf6`,
  4.23:1) fail even against their true backgrounds.
  TODO: decision needed on whether to darken those two.
- **"defined but never referenced by any component"** on the `light-*`
  palette, `purple-dark`, `cyan` and `orange`. Expected: the `components`
  block records dark-theme values, and those four colours exist only as
  `--grad-*` stops.
