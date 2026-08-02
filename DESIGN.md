---
version: alpha
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
  checkbox: 6px # .habit-checkbox — literal, not a --radius token
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
  sidebar-width: 220px
  topbar-height: 52px
  bottom-tabs-height: 60px
  breakpoint-desktop: 769px
  breakpoint-mobile: 768px
  breakpoint-compact: 520px

# ─────────────────────────────────────────────────────────────────
# COMPONENTS
# Sources: global.css (.btn/.card/.badge/.modal-*/.habit-checkbox/
#   .progress-bar-*/.glass-panel/.section-label), generic-modal.css,
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
  button-neon:
    backgroundColor: transparent
    textColor: "{colors.green}"
    borderColor: "{colors.green}"
    rounded: "{rounded.full}"
  button-neon-hover:
    backgroundColor: "rgba(0, 255, 136, 0.1)"
  button-gold:
    backgroundColor: "{colors.gold}" # start stop of --grad-gold
    textColor: "{colors.on-gold}"
    rounded: "{rounded.full}"

  # ── Card / glass surfaces — global.css ──
  card:
    backgroundColor: "{colors.bg-card}"
    borderColor: "{colors.bg-glass-border}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  card-hover:
    backgroundColor: "{colors.bg-card-hover}"
    borderColor: "rgba(139, 92, 246, 0.3)"
  glass-panel:
    backgroundColor: "{colors.bg-glass}"
    borderColor: "{colors.bg-glass-border}"
    rounded: "{rounded.xl}"

  # ── Badge / section label — global.css ──
  badge:
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 0.25rem 0.75rem
  section-label:
    backgroundColor: "rgba(139, 92, 246, 0.12)"
    textColor: "{colors.purple-light}"
    borderColor: "rgba(139, 92, 246, 0.25)"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
    padding: 0.4rem 1rem

  # ── Base modal (.modal-overlay / .modal-content) — global.css ──
  modal-overlay:
    backgroundColor: "rgba(0, 0, 0, 0.8)"
    padding: "{spacing.xl}"
  modal-content:
    backgroundColor: "{colors.bg-secondary}"
    borderColor: "{colors.bg-glass-border}"
    rounded: "{rounded.xl}"
    padding: "{spacing.2xl}"
    width: 560px # max-width
  modal-close:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    textColor: "{colors.text-secondary}"
    size: 36px

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

  # ── Checkbox — global.css (.habit-checkbox) ──
  checkbox:
    backgroundColor: transparent
    borderColor: "{colors.text-muted}"
    rounded: "{rounded.checkbox}"
    size: 28px
  checkbox-checked:
    backgroundColor: "{colors.green}" # start stop of --grad-green
    borderColor: "{colors.green}"
    textColor: "{colors.on-gold}"

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

## Overview

Life Hub is a **Personal Life OS** single-page app (React 19 + Vite + Supabase).
The interface is a productivity dashboard: habit tracking, finance, inbox,
knowledge collection and focus timers. It is meant to feel like a private,
slightly futuristic control room — dense with information but calm to look at.

Character:

- **Dark-first.** `:root` is the dark theme; light is an override on
  `[data-theme="light"]`. Every new surface must be legible in both.
- **Glassmorphic.** Content sits on translucent white-alpha panels over a
  near-black navy page, softened by `backdrop-filter: blur()`.
- **Neon accents, quiet chrome.** Purple → cyan gradients carry brand and
  primary actions; neon green marks completion/success; gold marks reward and
  gamification (XP, streaks). Navigation chrome stays muted.
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
- **Neon Green (`#00ff88`, light `#16a34a`)** — completion, streaks, "done".
  The dark value is a deliberately electric green; light mode swaps to a
  readable forest green.
- **Gold (`#ffd700`, light `#d97706`)** — XP, rewards, premium.
- **Red (`#ef4444`, light `#dc2626`)** — destructive actions and errors.
- **Orange (`#f97316`, light `#ea580c`)** — warnings, gold-gradient end stop.

Light mode re-tints **green, purple, cyan, gold, red, orange** for contrast on
a bright background. It does **not** re-tint `--blue`, `--purple-dark`,
`--cyan-light`, or `--green` gradients baked into `--grad-*` — see
*Do's and Don'ts*.

**Gradients** (`--grad-*`, all `135deg`) are colour compositions, not tokens
in the front matter:

| Variable | Stops | Used for |
| --- | --- | --- |
| `--grad-hero` | `#6366f1` → `#8b5cf6` → `#06b6d4` | `.btn-primary`, restore FAB |
| `--grad-card` | `rgba(99,102,241,.15)` → `rgba(139,92,246,.08)` | feature card fills |
| `--grad-text` | `#a78bfa` → `#06b6d4` | `.gradient-text`, logo, progress fill |
| `--grad-green` | `#00ff88` → `#06b6d4` | `.gradient-text-green`, checked checkbox |
| `--grad-gold` | `#ffd700` → `#f97316` | `.gradient-text-gold`, `.btn-gold` |

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

- **Desktop (`min-width: 769px`)** — fixed `.sidebar`, `220px`
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

**Stacking order** — `.dp-backdrop` 999 · global audio player 999 · nav chrome
100 · task overflow menu 800 · `.modal-overlay` / `.generic-modal-backdrop` /
`.dp-popover` 1000 · `.kb-sort-dropdown` 9999 · `.cm-overlay` 9000.

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

Observed blur radii, by role: `4px` modal backdrops (`.generic-modal-backdrop`,
`.cm-overlay`) · `8px` `.modal-overlay` · `12px` `.card`, audio player ·
`16px` `.kb-sort-dropdown` · `20px` `.glass-panel`, `.topbar`, nav menus ·
`24px` `.sidebar`, `.bottom-tabs`. Chrome blurs hardest, content blurs least.

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
| `--radius-xl` | `24px` | `.glass-panel`, `.modal-content`, `.cm-dialog`, audio player |
| `--radius-full` | `9999px` | buttons, badges, pills, progress bars, `.section-label` |

Exceptions present in the code: `.habit-checkbox` uses a literal `6px`;
circular controls (`.modal-close`, `.gap-btn`, `.nav-avatar`,
`.sidebar__theme-toggle`, `.tracker-status-dot`, status dots) use
`border-radius: 50%`; the webkit scrollbar thumb uses `3px`.

**Pill vs rounded rectangle** is a semantic distinction: *actions and
statuses* are pills (`--radius-full`); *containers and fields* are rounded
rectangles.

Border weight is `1px` almost everywhere. `.habit-checkbox` uses `2px`;
datepicker read-only dots use `1.5px`.

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
| `.btn-neon` | transparent, `1px --green` | `--green` | `0 0 12px rgba(0,255,136,0.2)` → `0 0 24px …0.4` |
| `.btn-gold` | `--grad-gold` | `#000`, weight 700 | `0 4px 24px rgba(255,215,0,0.3)` → `0 8px 40px …0.5`, lifts `-2px` |

Disabled (`.btn-primary:disabled`) is `opacity: 0.4`, `cursor: not-allowed`,
transform and shadow forced off, `pointer-events: none`.

### Card — `.card` (`global.css`)

`--bg-card` fill, `1px --bg-glass-border`, `--radius-lg`, `--space-xl`
padding, `blur(12px)`, `--transition-base`. Hover → `--bg-card-hover`,
border `rgba(139,92,246,0.3)`, `translateY(-2px)`, `--shadow-purple`.
Glow modifiers `.card-glow-green` / `-cyan` / `-gold` swap the hover glow and
border tint.

### Modal — three coexisting implementations

**1. `.modal-overlay` / `.modal-content` (`global.css`)** — the base pattern.
Overlay `rgba(0,0,0,0.8)` + `blur(8px)`, `z-index: 1000`, `--space-xl`
padding, `fadeIn 0.2s`. Content `--bg-secondary`, `1px --bg-glass-border`,
`--radius-xl`, `--space-2xl` padding, `max-width: 560px`, `slideUp 0.3s`
spring. `.modal-close` is a `36px` circle at `--space-md` inset.
Below 768px the content padding drops to `--space-xl`.

**2. `GenericModal` (`generic-modal.css`)** — the reusable
header/body/footer dialog. Backdrop `rgba(0,0,0,0.55)` + `blur(4px)`,
`1rem` padding. Panel `--bg-secondary`, `1px rgba(255,255,255,0.08)`,
`--radius-lg`, `max-width: 440px`, `max-height: 90vh` scrollable,
`modalSlideUp 0.25s` spring. Header `1rem 1.25rem` with a bottom hairline and
display font `700/1rem`; body `1.25rem` flex column `gap: 0.75rem`; footer
`0.75rem 1.25rem`, right-aligned, `gap: 0.5rem`, top hairline.

**3. `ConfirmModal` (`confirm-modal.css`)** — the centred alert. Overlay
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
and brightens through `--active` and `:hover`.
Below 520px it becomes a fixed bottom sheet: full width, top corners only,
`max-height: 70vh`, shortcuts hidden, footer padded with
`max(0.5rem, env(safe-area-inset-bottom))`.

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

Added v5.0.0. Read-only task detail with two tabs (change history / personal
notes). Built **on `GenericModal`**, not a fourth modal system — only two
overrides are needed.

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

`MonthCalendar` runs in two modes. Passing `habitData` keeps the original
habit colouring (dot per completed day); omitting it switches to task mode,
used by `/tasks`.

- **`.cal-grid`** — must be `repeat(7, minmax(0, 1fr))`, **never** `repeat(7, 1fr)`.
  `1fr` is `minmax(auto, 1fr)`, so a non-wrapping child (the `nowrap` task chip)
  pushes its column wider and skews all seven. Pair it with `min-width: 0` on
  the cell and the chip wrapper, or the ellipsis never triggers.
- **`.cal-cell--tasks`** — drops `aspect-ratio: 1` for `min-height: 62px`,
  top-aligns content, left-aligns the day number at `opacity: 0.75`. Carries a
  `1px --bg-glass-border` hairline over `--bg-card`: without the hairline the
  grid stops reading as a grid and becomes floating numerals.
- **`.cal-cell--tasks.cal-cell--done`** — keeps the plain `--bg-card` fill and
  only lifts its border to `rgba(0,255,136,0.28)`. The habit-mode green fill is
  deliberately *not* reused here: a green cell behind a green chip collapses
  into one heavy block. Colour belongs to the chip, weight belongs to the border.
- **`.cal-chip`** — `0.6rem/500`, `3px` radius, `rgba(0,255,136,0.14)` fill with
  `--green` text, single-line ellipsis. Max two per cell plus a
  `.cal-chip--more` counter in `--text-muted`. Light theme swaps to
  `rgba(22,163,74,0.12)` on `#15803d`.
- **`.cal-cell--empty`** — a past day with no completed task keeps the hairline
  but takes no fill, and is **not** `.cal-cell--miss` red. Missing a habit is a
  failure; having no task that day is not.
- **`.cal-cell--tasks.cal-cell--future`** — `dashed` border at `opacity: 0.45`.
  The cell stays present so the grid rhythm is unbroken.
- **No week/day time grid.** `user_tasks.due_time` defaults to `23:59`, so an
  hour × day grid would stack every task in one bottom row. The expensive parts
  of that layout (hour gutter, overlap collision solving, drag-resize,
  now-indicator) buy nothing for all-day data.

### Other shared atoms (`global.css`)

- **`.badge`** — pill, `0.25rem 0.75rem`, `0.8rem/600` display font, four
  tints following one formula: `0.15` alpha fill, `0.3` alpha border, solid
  brand text (`green`, `gold`, `purple`, `cyan`).
- **`.section-label`** — uppercase pill, `0.4rem 1rem`,
  `rgba(139,92,246,0.12)` on `rgba(139,92,246,0.25)`, `--purple-light`,
  `0.85rem/600`, `0.05em` tracking.
- **`.habit-checkbox`** — `28px`, `2px --text-muted` border at `opacity: 0.6`,
  `6px` radius, `--transition-spring`. Checked → `--grad-green` fill,
  `--green` border, `--shadow-green`, black `✓` at `14px/900`.
  Locked/disabled → `opacity: 0.35` with purple-alpha border and fill.
- **`.progress-bar-track` / `-fill`** — `6px` tall, `--radius-full`,
  `rgba(255,255,255,0.08)` track, `--grad-text` fill, width eased over `0.8s`
  on the spring curve, with a `40px` `shimmer 1.5s` highlight.
- **`.glass-panel`** — `--bg-glass`, `1px --bg-glass-border`, `--radius-xl`,
  `blur(20px)`.
- **`.divider`** — `1px`, `linear-gradient(90deg, transparent,
  rgba(255,255,255,0.08), transparent)`, `--space-2xl` vertical margin.
- **`.fade-up` / `.visible`** — scroll reveal: `opacity 0` +
  `translateY(30px)` → settled, `0.6s ease`.
- **Scrollbar** — `6px` wide, `--bg-secondary` track,
  `rgba(139,92,246,0.4)` thumb at `3px` radius, `--purple` on hover.

## Do's and Don'ts

**Tokens**

- **Do** read every colour, radius, spacing and shadow from the `--*`
  variables in `src/styles/global.css`; that file is the only place they are
  declared.
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
- **Don't** communicate state with colour alone — the tracker pairs colour
  with distinct glyphs (`✓`, `○`, `·`, lock).
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
4. **Three modal systems.** `.modal-overlay`/`.modal-content` (global),
   `.generic-modal-*`, and `.cm-*` differ in backdrop alpha (`0.8` vs `0.55`),
   blur (`8px` vs `4px`), z-index (`1000` vs `9000`) and border alpha
   (`0.1` vs `0.08`). TODO: decide which is canonical.
5. **Duplicate `fadeIn` keyframes.** Defined in both `global.css` and
   `generic-modal.css`. TODO: remove one.
6. **Buttons bypass `.btn`.** `.cm-btn`, `.dp-footer__save`,
   `.dp-footer__cancel`, `.kb-sort-trigger` and `.sidebar__link` each
   re-implement padding, radius and font instead of extending `.btn`.
   TODO: decision needed on whether a shared button base should absorb them.
7. **Component padding ignores the spacing scale.** Shared components use raw
   rem values (`0.6rem 0.85rem`, `0.55rem 0.75rem`, `1rem 1.25rem`,
   `0.4rem 0.65rem`, …) rather than `--space-*`. TODO: decide whether to add
   sub-`0.5rem` spacing tokens or accept raw values in components.
8. **CustomSelect lives in a page stylesheet.** The shared `CustomSelect`
   component depends on `.kb-sort-*` classes defined in
   `src/styles/collect.css`, and hard-codes layout in inline `style` props.
   TODO: decide whether to extract a `select.css` the way `generic-modal.css`
   was extracted.
9. **Eight blur radii.** `4/6/8/10/12/16/20/24px` are all in use with no
   `--blur-*` token. TODO: decide whether to tokenise.
10. **Light theme coverage is partial.** `[data-theme="light"]` overrides
    `--bg-*`, `--text-*`, `--shadow-*` and six brand colours, but not
    `--blue`, `--purple-dark`, `--cyan-light`, `--green-dim` (only
    partially), or any `--grad-*`. TODO: decision needed on completing it.
11. **No global form-control baseline.** There is no `input`/`textarea`/
    `select` element rule; each module restyles fields, and the "shared"
    reference is `.generic-modal__input`. TODO: decide whether to promote it.
12. **`.tracker-status-dot` and `.dp-grid__cell--other` use raw
    `rgba(255,255,255,…)` foregrounds** (`0.2`, `0.12`, `0.08`) that do not
    invert in light mode. TODO: decision needed.

**Expected linter warnings**

`npm run design:lint` reports **0 errors**. The remaining warnings are
deliberate and should not be "fixed" by editing this file:

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
