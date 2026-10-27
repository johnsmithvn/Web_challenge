---
version: 6.16.0
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
  sidebar-width-collapsed: 64px # :root.sidebar-collapsed
  topbar-height: 52px
  bottom-tabs-height: 60px
  breakpoint-desktop: 769px
  breakpoint-mobile: 768px
  breakpoint-compact: 520px

# ─────────────────────────────────────────────────────────────────
# COMPONENTS
# Sources: global.css (.btn/.card/.progress-bar-*/.section-label), generic-modal.css,
#   confirm-modal.css, datepicker.css,
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

**Version:** v6.16.0 · **Updated:** 2026-09-02

## Overview

Life Hub is a **Personal Life OS** single-page app (React 19 + Vite + Supabase).
The interface combines task management, finance, inbox, encrypted account
storage, knowledge collection and focus timers. It is meant to feel like a private,
slightly futuristic control room — dense with information but calm to look at.

Character:

- **Dark-first.** `:root` is the dark theme; light is an override on
  `[data-theme="light"]`. Every new surface must be legible in both.
  `color-scheme` in light mode is always `only light`, never plain `light`: the
  property inherits, and a plain `light` on a control re-enables the browser's Auto
  Dark Mode (Chrome/Samsung "dark web pages") for that element only — black inputs
  inside a white form.
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
  bottom. `body` gets matching `padding-top` / `padding-bottom`. The topbar
  owns app-wide controls (theme toggle, avatar); page headers below it must
  not repeat them on mobile (e.g. `.dash-theme-btn` is hidden ≤768px).
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

Observed blur radii, by active shared role: `12px` `.card` · `16px`
`.kb-sort-dropdown` · `20px` `.topbar` · `24px` `.sidebar`, `.bottom-tabs`.

**Performance rules (v6.29.1)** — `backdrop-filter` is re-computed every frame
whenever anything behind it moves (the Tasks sky is always moving), so:

- **Popups, drawers, sheets, dropdown menus and modal scrims use a solid fill,
  no `backdrop-filter`** (fill alpha ≥ 0.94; scrims only darken). Glass stays on
  persistent chrome (sidebar, topbar, bottom tabs, panels/columns).
- Don't nest glass: a blurred element inside a blurred parent only blurs the
  parent's fill (the parent is the backdrop root) — pure GPU cost.
- Animated background layers animate only `transform` / `opacity`; never put
  `filter: blur()` on a gradient layer (gradients are already soft) and never
  animate `filter`. Layout properties (`left/top/width`) are not animated —
  use `transform` (container units `cqw/cqh` when the path is in % of the frame).

**Layer order** — page (`--bg-primary`) → glass card (white-alpha + blur) →
solid panel (`--bg-secondary`, modals/dropdowns) → coloured glow on state.
Hovered cards additionally lift `translateY(-2px)` and take `--shadow-purple`.

**Motion tokens** — `--transition-fast` `0.15s ease`, `--transition-base`
`0.3s ease`, `--transition-slow` `0.6s ease`, `--transition-spring`
`0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`. The universal
`*, *::before, *::after` rule cross-fades `background-color`, `border-color`,
`color` and `box-shadow` over `0.25s ease` so theme switching animates.
`.page-transition` (0.22s) is disabled by the app's **Giảm chuyển động** setting
(Settings → Chung): `ThemeContext` sets `data-reduce-motion` on `<html>`, every CSS escape is
`:root[data-reduce-motion] …`, JS reads `reduceMotion` from `useTheme()`. Off by default and deliberately
**not** tied to `prefers-reduced-motion` — a browser reporting it silently killed every Tasks effect.

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

### SkeletonList — `.sk-*` (`skeleton.css`)

Khung chờ dùng chung cho **mọi** màn list. Một dòng skeleton giữ đúng chỗ của dòng
thật: ô icon `34px` bo `10px`, hai dòng chữ `13px`/`9px` bo `5px`, khối phải
`68px`+`44px`. Bề rộng dòng chữ so le theo chu kỳ 3 (`62/38`, `48/54`, `70/30`) để
khối skeleton không ra một hình chữ nhật đều tăm tắp.

Hiệu ứng là **một** vệt sáng chạy ngang cả danh sách (`.sk-list::after`,
`linear-gradient(100deg, …)` + `background-position` 1.7s), không phải mỗi ô tự
nhấp nháy: một layer animate, và mắt đọc là "đang tải" chứ không phải "hỏng". Nền
`--sk-fill` `rgba(255,255,255,0.07)`, đảo sang `rgba(15,23,42,0.08)` ở
`[data-theme="light"]`. Giảm chuyển động tắt vệt sáng, giữ khung tĩnh.

Props: `rows` · `icon` · `lines` · `right` · `plain` (bỏ viền) · `heading` (thanh
tiêu đề, chỉ dùng cho skeleton toàn trang) · `gap`. Container mang
`role="status" aria-busy="true"` kèm `aria-label` mô tả đang tải cái gì.

Luật: **đang tải thì không được hiện empty state**. Báo "chưa có gì" rồi một giây
sau bung ra 20 dòng là kiểu nói dối gây mất niềm tin, và layout nhảy đúng lúc mắt
vừa dừng lại đọc.

Cờ đúng là `hasLoaded` (hoặc `isLoading` khởi tạo `true` khi chắc chắn sẽ fetch), không phải `isLoading` khởi tạo `false`: fetch chạy trong effect nên frame đầu `isLoading` còn `false` và empty state lọt ra một nhịp. Màn dashboard/nhiều card (Body) dùng `SkeletonList heading` chung thay vì vẽ khung riêng từng màn.

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

`.fin-datefield__box` **không có padding dọc**: chiều cao do `min-height: 40px` của
`.fin-input` quyết định, để ô ngày cao đúng bằng ô chữ nằm cạnh nó trong cùng hàng
grid. Có padding dọc thì nút lịch (icon 15px + padding 4px) đẩy khung lên 41–43px và
cả hàng trông như xếp lệch. Nút lịch giữ `line-height: 0` cùng lý do.

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

**`mode="task"`** (v6.21.0) — Bắt đầu → Hạn của task trong 1 popover (kiểu
Plane/ClickUp), dùng ở dòng **Thời gian** của `TaskForm`. Header là `.dp-fields`:
2 ô `.dp-field` cạnh nhau (`minmax(0, 1fr)` ×2), mỗi ô gồm nhãn nhỏ + giá trị
(ellipsis) + nút ✕ riêng. Ô **đang chọn** (`.dp-field--active`, viền purple `0.6`,
nền `0.1`; mặc định là Hạn) nhận lần bấm lịch / phím tắt kế tiếp; vừa đặt Bắt đầu
thì tự chuyển sang Hạn. Cột phím tắt giữ bản nhìn tới. Lịch tô khoảng như
`mode="range"`. Giờ ẩn sau nút **Thêm giờ** ở trái footer (`.dp-footer__time-toggle`,
`margin-right: auto`); bật lên thì hàng `.dp-time` có 2 cặp nhãn + ô giờ, ô giờ của
mốc chưa có ngày bị `:disabled`. Bắt đầu sau Hạn → dòng `.dp-error` đỏ, Lưu bị khoá.

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

Thu gọn sidebar (desktop): nút tròn `.sidebar__collapse-btn` ở mép phải (hiện khi hover)
bật `.sidebar--collapsed` + `:root.sidebar-collapsed` → `--sidebar-width: 64px`, lưu
`localStorage lh_sidebar_collapsed`. Rail 64px: logo gradient 36px, link vuông `40×40`
chỉ còn icon (tên hiện qua `title`), ẩn nhãn nhóm, link con và thanh XP.

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
  Giảm chuyển động (`:root[data-reduce-motion]`) escape that drops both the transition and
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
  the sidebar toggle, with a Giảm chuyển động escape.
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
  (`flex: 1; min-height: 0; overflow-y: auto`). Nested scroll areas are deliberately
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

> Cũ: `MonthCalendar` nay dùng `.tk-mo-*` (xem "Tasks workspace (Aurora)"); trong `calendar.css` chỉ còn
> `.cal-cell__holiday` được dùng (giữ theo contract test). Phần dưới chỉ để tham khảo.

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

Rebuilt v5.2.0 for `/accounts` (Keyplate handoff), re-skinned v6.31.0 to the **"Ops
console"** style (user pick 2026-10-24, option S2 on the design canvas). Layout: header ·
three-pane body (groups · item list · detail), breakpoints 1180px / 900px. The old two-row
Types/Tags filter bar is gone.

- **Why the re-skin:** the Keyplate look (violet `#7c5cff` with a glow on the primary
  button, pill buttons, 18px rounded cards, soft drop shadows, letter-spaced uppercase
  micro-labels everywhere, Plus Jakarta Sans) read as a generic SaaS landing page, not a
  security tool. S2 is graphite / white paper, **IBM Plex Sans** for UI + **IBM Plex Mono**
  for every value, count, code and timestamp, `4px` corners (`--r`, `--r-sm: 3px`), no
  glow, no soft shadows, no hover lift. **Cyan is only for action and selection; amber /
  red only for risk** (`--warn*`, `--danger*`, `--ok*`) — never decorative.
- **This module owns a scoped token set — one of two deliberate domain
  exceptions alongside Finance Nocturne (`--n-*`).** Everything inside Vault reads its
  own tokens instead of `--purple` / `--radius-*` from `global.css`; the vault declares a
  *scoped* palette on `.acc-vault, .acc-scrim` (`--color-accent`, `--surface`,
  `--surface-2`, `--on-accent`, `--warn*`, `--ok*`, `--danger*`, `--r`, a full dark set
  and a `[data-theme="light"]` override). The scope means **not one of these variables
  leaks** to the rest of the app. To retune vault colour/spacing, edit `accounts.css`,
  **not** `global.css`. Do not copy the pattern casually.
- **Dark is the default, light is the override** because the app's `:root` is dark. Swaps
  easy to get wrong: `--color-accent-700` (every accent-coloured text) is a **light step**
  on dark (`#7fd3ff`) and a **dark step** on light (`#075f94`); the light accent itself is
  steel blue `#0a7bbf` because cyan `#4cc2ff` on white is ~2:1; `--on-accent` flips from
  near-black (on cyan) to white (on steel blue). Elevation is the panel's own 1px border
  (`--lift-1: none`); only floating dialogs get `--lift-2`.
- **Muted text is always `color-mix(in srgb, var(--color-text) N%, transparent)`,
  never a hard grey** — flipping `--color-text` fixes the whole muted ramp at once
  so it survives the theme flip untouched. Readable muted text uses **64%**: anything
  under ~60% drops below 4.5:1 on the light theme's white surface. Lower mixes (28–35%)
  are only for placeholders, empty-value dashes and disabled icons.
- **`.acc-warn--secure`** — the non-dismissible encryption status banner. It uses
  a green success treatment to state that full-content AES-GCM is active and
  enumerates which user-entered fields reach Supabase only as ciphertext.
- **Row panel (`.acc-panel`) — the module's core container,** shared by fields,
  sign-in methods and the code sheet. Built as `display: grid; gap: 1px;
  background: divider` so the 1px gaps *are* the row rules and each row sits on
  `--surface` — **plus a real `1px solid divider` border around the panel** and
  `overflow: hidden` + `--r` radius. Dropping that outer border (as
  an earlier pass did) leaves the panel edgeless and the whole page reads flat — it is
  the only elevation cue now that there are no shadows.
- **Edit mode uses real bordered controls, not borderless inline text.**
  `.acc-input` / `.acc-textarea` / SearchSelect's control carry a `1px divider` border, sit on
  `--color-bg` (sunk into the page, not raised like a panel), `--r` radius and a
  `--ring` focus shadow. This is the **opposite** of the
  Proton-Pass-derived pattern the previous `/accounts` used ("the border belongs
  to the card, never the input"); that idea is not part of this design and
  re-applying it is what made edit mode look like naked text. Do not "clean up"
  these borders.
- **Every small action is a bordered `12px` sentence-case button** (`.acc-act`, 28px
  min height, `--r-sm`): Reveal, Hide, Copy, Generate, Make primary, Turn on/off, + Add
  value, + Link another item, Regenerate, Append, Show all N events. The border is what keeps
  them reading as controls rather than body copy (the old rule made them uppercase
  instead). `Delete item` (`.acc-foot__del`) is the same button in `--danger`.
- **`.acc-btn--primary` is solid accent with `--on-accent` text — no gradient, no glow.**
  Next to outline buttons a solid fill is enough emphasis; the previous gradient + violet
  glow was the single biggest "looks AI-made" tell.
- **Values are monospace:** `.acc-field__val`, `.acc-multi__val`, counts
  (`.acc-grp__num`, `.acc-listhead__count`, `.acc-sect__meta`), timestamps, `.acc-code`
  and the `.acc-link__code` / `.acc-row__code` badges use `--acc-mono`. Labels
  (`.acc-field__label`) are sentence-case 13px muted; only section titles and KPI captions
  stay uppercase, at `.08em`.
- **`.acc-kpis` — a stat strip under the title (view mode):** Dependents · Depth · Sign-in ·
  Updated, so "how much hangs on this item" is answered before scrolling. Sign-in turns
  `--warn-ink` when the item signs in with a password only.
- **`.acc-row__auth` — risk at list level:** a `PWD only` amber dot under the timestamp
  for items whose only active sign-in method is a password. Deliberately no "safe" badge:
  amber appears only when there is something to fix.
- **`.acc-code`** — the 36px chip carrying a template's 3-letter code (mono), used in
  the sign-in rows. Accent-tinted when it marks a primary method.
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
    would fight the vault's own accent.
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
- **`.acc-link`** — the pointer to another item: accent-alpha plate (`--r`) with a
  bordered accent edge, a mono code badge, target title, the target's subtitle (its email /
  phone, `itemSubtitle`) and a trailing `↗` that marks it as navigation. A link points at the
  whole item — there is no per-field target to pick. A link whose target is gone becomes `.acc-link--dead` (divider
  border, no hover, "Missing item / link broken") — a normal state (jsonb links
  have no FK), not an error.
  - **"Depends on this" section (was "Linked from") — an incoming dependency reads as a
    field row, not a chip in a bag.** A link is stored only on the source item, so
    without this the target (a bank account every card links to) looked unconnected.
    Rows come from `dependentsOf()`: explicit links **plus value matches** (a bank's
    Username equals the phone number of an Identity item, or of an item whose title *is*
    that email/phone), walked down to 3 levels by BFS so Gmail → bank → that bank's card
    shows as a tree. Deeper rows indent by `--depth` with a corner hook
    (`.acc-field--nested`). A `.acc-impact` row on top sums it up ("2 items rely on this
    one, and 1 more through them") and turns warn-coloured when the item signs in with a
    password only. Each row reuses the
    `.acc-field` grid: label column = the **source field** that points here ("Bank
    login", "Username"), value column = the `.acc-link` chip for the source item, action column =
    a `Details` toggle. Details expands `.acc-backdetail` — a `dt`/`dd` pair per
    value, indented behind a divider rule so it reads as belonging to the chip above.
    **Expand in place rather than navigate:** these links are consulted at a glance
    ("which card of this bank, expiring when"), and jumping to the item loses where
    you stood. Values come from `linkableValues()` — the single definition of what
    may show without a Reveal step, so secrets can never leak in through this view.
    Section is hidden in edit mode, since navigating away drops the draft without
    asking.
- **`.acc-strength`** — a `180×5px` track at `9%` text with a fill whose
  `width` and `background-color` transition over 320ms. View-mode only, and only
  for `type="password"`; `secret` is never scored.
- **Masked values read as redacted, not a glyph blob:** `.acc-field__val--mask` is
  monospace with `0.12em` letter-spacing; revealing drops the spacing (`--open`).
- **`.acc-codecell__strike`** — a 1px rule animating `width: 0 → 100%` over 300ms
  when a single-use code is marked used, the cell fading to `opacity: 0.5`.
- **`.acc-hist`** — a left rail (`border-left` divider) with 7px round accent dots
  carrying a 3px `--color-bg` halo; timestamps in mono 11.5px,
  detail lines switch to monospace when they contain masked bullets.
- **Every dropdown is `SearchSelect` (`components/SearchSelect.jsx`, `search-select.css`); no
  native `<select>` / `<datalist>` is left in the vault.** Item type, group, title, field type,
  Brand, linked item, new sign-in method, new field type, the list's type filter and both
  unlock-TTL pickers use it. It reads vault tokens (`--color-bg`, `--surface`, `--r`, `--ring`)
  so it keeps the Keyplate look; per-slot sizes are `.acc-pick--type / --kind / --tpl / --filter`.
  `allowCustom` = combobox (title, group, Brand, unlinked Linked item): typing keeps free text,
  Enter keeps what was typed unless ↓ picked a row. Its menu is absolute, so containers that
  clip (`.acc-panel`, `.acc-dialog`) switch to `overflow: visible` via `:has(.search-select__menu)`
  while it is open. The dialogs stay hand-built, not `GenericModal` — that component brings
  Life Hub tokens and breaks the scoped vault look. Exception noted in `AccountDetail.jsx`.
- **`.acc-act` (Reveal / Copy / Generate) never hover-reveals** — permanent
  bordered buttons, same reasoning as `.td-del`: touch has no hover, and
  reveal/copy are the two controls a phone user reaches for. Generate is enabled
  and uses Web Crypto CSPRNG because every save path now writes ciphertext.
- **Multi-pane, CSS-only breakpoints — and they are `@container` queries, not
  `@media`.** `.acc-body` is `216px minmax(300px,360px) minmax(520px,1fr)` (groups
  column first, see above); React holds
  only `selectedId` + `screen`. The handoff's 900px breakpoint measures **the
  vault's own width**; the prototype filled the viewport so the two were the same,
  but here the vault sits beside the 232px sidebar. Measured against the viewport,
  a 1100px window gives the vault 868px while it still tries to hold two panes —
  a horizontal scrollbar. So `.acc-vault` declares `container-type: inline-size`
  and the narrow rules live in `@container (max-width: 899px)`. The prototype's
  `min-width: 1040px` floor is **dropped** for the same reason; the real floor is
  the columns' own `300 + 520`. Touch targets ≥44px and inputs 16px when narrow
  (iOS zoom). No JS breakpoint, no `useMediaQuery`, no duplicated mobile layout markup.
- **Title = service name, with suggestions.** The Edit-mode title is a `SearchSelect allowCustom`
  fed by `titleSuggestions` (each row shows its preset group): mailbox name derived from the address → titles already in
  the vault (the user's own spelling) → `titlePresets` in `account-templates.json`. Picking an
  exact suggestion fills the group only when the item has none — it never overwrites a group
  the user chose. Free typing always works; this is a hint list, not a picker.
- **Standard groups.** `groupPresets` is 8 plain-language groups (Tài chính has 4 children) —
  the shared vocabulary for the group picker, the bulk bar and the title presets; names must read
  without explanation and must not look alike at a glance (no "Nền tảng", "Định danh",
  "Tài khoản chính" — it reads as "Tài chính"; Apple ID / Microsoft / GitHub / ChatGPT are
  "Công nghệ"). One sign-in = one item, so there is no "Google" title preset: a Google account
  *is* the Gmail mailbox, one Email account item. Templates carry a default `group` used when an
  item is created outside any group. A test fails if a title-preset key or a template group
  drifts outside the list, so the standard cannot silently fork.
- **Group picker = one combobox.** `GroupPicker` (exported from `AccountDetail.jsx`) is a
  `SearchSelect allowCustom` (`.acc-grouppicker`, size `sm`) next to the item-type picker:
  empty = Ungrouped (X clears), rows are groups (vault groups first, then presets) with their
  group icon, a sub-group reads "Parent › Child"; typing a name that matches nothing offers
  "New group: …" ("/" makes a sub-group). Opening it with a group already set still lists every
  group — it filters only after you type. Rejected: a `<datalist>` (browser-drawn, narrow,
  truncates) and a chip row (three rows of buttons for one choice).
- **Vault inputs never feed the browser's password manager.** Every content input spreads
  `NO_AUTOFILL` (`autocomplete=off` + ignore flags for third-party managers) and secret inputs
  are `type="text"` masked with `-webkit-text-security` (`.acc-input--masked`): Chrome treats a
  password input that disappears after typing as a login and offers to save it, which would
  copy vault secrets into a second store. Only the unlock / change-passphrase forms keep
  `type="password"`.
- **Bulk move to group.** **Select** in the list head turns rows into `<label>`s wrapping a
  real checkbox (`.acc-row--select`, `.acc-row--picked`) — no control nested in a `<button>`.
  `.acc-bulkbar` sticks to the bottom of the list pane (inside the scroll area, so it never
  covers the last row) and is fixed to the vault bottom on mobile, like the copy bar. It
  uses the same `GroupPicker`; Ungrouped clears the group. "+ New group" in the groups column
  is the same flow started at All items with the name input already open and focused —
  there is no empty-group state to create, because groups are derived from items.
- **Root titles are free text.** A root is recognised from data, not the title: an Identity's
  values, or an **Email account (EML)**'s first email field (only the first — a "Recovery
  phone" must not turn a mailbox into the root of that number). So the convention is title
  = service ("Gmail", "VIB"), address in a field; `RootRow` and the root card show the real
  address/number (`addressOf`) whenever the title is not itself one. Items titled with the
  raw address still count (legacy rule).
- **Two link kinds — sign-in (→) vs money (⇒) (design L0–L4 on the canvas, 2026-10-24).** A
  wallet linked to a bank is risk flowing the *other* way from a recovery email, so the two
  never share a tree. Every money-flavoured thing is drawn as money: `⇒` glyph, amber
  (`--warn*`), dashed border (`.acc-depgroup--money`, `.acc-chain__node--money`); sign-in keeps
  `→` and the accent. Edit mode shows `.acc-linkkind` — one line: two `aria-pressed`
  `.acc-chip`s (→ Sign-in, ⇒ Money; not a radiogroup: two options do not earn arrow-key
  handling) and a hint for the chosen kind, "· guessed from the field name" while `kind` is
  unset. It appears only once something is linked. View mode labels each link field `→ Sign-in link` / `⇒ Money link`
  (`.acc-field__typenote--money`).
- **Money links (`MoneyLinks.jsx`) — a matrix, not a diagram.** Many-to-many wallet ↔ bank
  lines cross from the third wallet on, so it is a real `<table>`: rows = items with money
  links (`AccountAvatar` + name, sticky left with an *opaque* background — `accent-100` is
  translucent, so a selected sticky cell layers it over `--surface`), columns = linked
  accounts sorted by how many sources reach them, footer row counts sources (amber at ≥2).
  Cells are indicators, not buttons; row and column headers are the buttons, so Tab walks
  headers only. `.acc-vault[data-view="money"]` swaps the body grid to a wide middle pane and a
  narrow detail pane (`MoneyPanel`) at ≥1180px and in rail mode; mobile keeps the normal
  list → detail screens.
- **Roots — identity root map (`RootMap.jsx`, design R0–R2 on the canvas).** A "Roots" entry
  (icon `tree`) in the groups column swaps the middle pane for the roots list (`RootRow`,
  reusing `.acc-row` + `.acc-avatar`; roots nothing depends on get `.acc-row--dim`) and
  the detail pane for the map of the selected root — still three panes, no new layout.
  The map reads top to bottom: `.acc-kpis` → `.acc-chain` (path from the root's own
  upstream root down to the traced dependent; pills, `→` between) → `.acc-rootmap__map`
  = *Protected by* (`.acc-guard`: active sign-in methods as plain rows, upstream items as
  buttons) ─▶ root card (accent border) ─▶ *Depends on this* (`.acc-depgroup` per first-
  level field, `.acc-deprow` indented by `--depth`) → amber `.acc-rootmap__impact`.
  Wires are their own elements (`.acc-rootmap__wire` + `::after` arrowhead), not one
  `<svg>`, so every block stays a real button/text. **A dependent row has two
  buttons on purpose:** the row traces the chain, the `↗` opens the item — tracing is
  the common action on this screen and must not navigate away. "Not in vault yet"
  (`.acc-untracked`, dashed = not an item yet) lists identifiers used by ≥2 items with
  no owning item. Mobile: list → map stacked vertically with wires turned downward, the
  chain scrolls horizontally.
- **Mobile (<900px) is its own drill-down layout, not the desktop squeezed** (designs
  M1–M4 on the canvas, 2026-10-24). `screen` ∈ `home | list | detail` sits on
  `.acc-vault[data-screen]`; CSS shows one pane per screen:
  - **M1 `home`** — header = brand + Lock + "+" (icon-only 44px; labels hidden by
    `clip-path`), search, then the groups column as a full-screen list of 50px rows
    with `›` (`.acc-grp__chev`); `Password only` becomes an amber card; tags; "Đổi mật
    khẩu Vault" at the bottom (`.acc-groups__passphrase`) because the header has no room
    for it or the AES-GCM badge, both hidden on mobile.
  - **M2 `list`** — header turns into `‹ Vault · Email 3` + "+" (`.acc-head__nav`). The
    search input **stays in the header across M1 → M2**, so typing on M1 (which jumps to
    a vault-wide `All` list) never unmounts the focused input. The list head keeps only
    the type select.
  - **M3 `detail`** — vault header hidden; `.acc-title` becomes a grid and
    `.acc-title__main { display: contents }` lets `‹ <list title>` (`.acc-back`) share row
    one with ☆ / Edit as a nav bar without separate markup. KPI strip is 2×2.
    **`.acc-copybar`** pins "Copy username · Copy <secret field>" to the bottom (the
    most frequent action, under the thumb); labels come from the field ("Copy card
    number").
  - **M4 edit** — `.acc-detail--editing .acc-title__actions` pins Cancel · Save to the
    bottom like the Finance edit drawer; the back button is hidden (it would remount the
    detail and drop the draft).
  Both bars are `position: fixed` and land at the **vault's** bottom edge (above the app
  tabs) because `container-type` makes `.acc-vault` their containing block — which is
  also why `.acc-detail`'s enter animation is off on mobile: a transformed ancestor
  would capture them instead. `QuickCapture` is hidden on `/accounts` so its round
  button cannot sit on top of these bars. Desktop invariant the code relies on:
  `screen` is `home` only before anything has been picked (every group / tag / item
  pick sets it; Lock resets view + query too).
- **The template dialog is portaled to `document.body`.** `container-type` implies
  `contain: layout`, which makes `.acc-vault` a containing block for
  `position: fixed` — a scrim rendered inside it would cover only the vault and
  leave the sidebar showing through. Because the portal breaks DOM inheritance,
  the token block is declared on **`.acc-vault, .acc-scrim`** rather than the
  vault alone, and the dialog's narrow rules use `@media` (no ancestor container).
  It is a hand-built dialog, not `GenericModal` — see the scoped exception above.
- **Groups column (`.acc-groups` / `.acc-grp`) — purpose groups, not item types, are the
  primary navigation.** With 14 of 18 items sharing the `ACC` type, a Types chip row
  partitioned nothing; type is now a small `SearchSelect` (`.acc-pick--filter`, empty = All types) in
  the list header, listing only types that have items. A group is one path string on the
  item (`group: "Tài chính/Ngân hàng"`, max 2 levels) inside the encrypted payload; the
  tree is derived from items like `usedTags`, so an empty group cannot exist. Plate colour
  is the parent's `avatarHue` (children share it so a branch reads as one block); the icon
  comes from keyword rules in `account-templates.json` `groupIcons`, first match wins.
  **One markup, three forms, container queries only:** ≥1180px a 216px column with
  names and counts; 900–1179px a 60px icon rail (names hidden by `clip-path`, not
  `display:none`, so buttons keep an accessible name; tags hidden — search still matches
  tag names); <900px the whole column becomes the **Vault home screen** (see Mobile
  below). A `Password only` view (`.acc-grp--warn`, amber plate) sits under Favourites
  whenever any item's only active sign-in method is a password. The rail exists because the vault sits beside the app's 232px sidebar:
  on a 1366px laptop it gets ~1130px, less than 216 + 300 + 520. User preferred a vertical
  column over a top chip bar even with two sidebars side by side (2026-10-24).
- **`.acc-cardview`** — the credit-card preview: `linear-gradient(140deg,…)` that
  **lightens on dark** (`#5b46c9 → #34277f → #241d52`) with a `1px` accent
  hairline so it does not merge into a dark page; number masked to the last 4
  until the Card number field is revealed.
- Motion collapses to `1ms` when Giảm chuyển động is on
  (`:root[data-reduce-motion] .acc-vault *`, plus `.acc-scrim` / `.acc-dialog`).

### Knowledge (Cực quang) — `.kb-*` (`kb-tokens.css`, `collect.css`)

Knowledge có contract riêng, scoped trên `.kb-page`; không dùng glass/gradient chung của app. Bản thiết kế:
"Kiến Thức Redesign" 1a (kiểu) / 2a (màn), Danh sách 4a, Quản lý chủ đề 4b (v6.33.0).

- **Nền**: `<SkyBackground calm />` (cùng trời với Nhiệm vụ, xem Tasks workspace bên dưới) đặt trong `.kb-page`
  (`position: relative; isolation: isolate`), `--kb-sky` là lớp tĩnh dưới nó. `calm` = không vật bay, không bụi sao theo chuột.
- **Token** (`kb-tokens.css`, có giá trị tối và sáng): trời `--kb-sky`, nền `--kb-bg`, lớp `--kb-p1` (thẻ, kính
  trong) / `--kb-p2` (hover, ô nhập), hộp thoại nền đặc `--kb-pop`, viền `--kb-line`, chữ `--kb-tx` / `--kb-dim` /
  `--kb-faint`, nhấn `--kb-accent` (mint `#6EF2C7`; sáng: violet `#7C3AED`) + `--kb-accent-soft` / `--kb-on-accent` /
  `--kb-glow`, phụ `--kb-violet` (đang chọn, ghi chú), `--kb-gold` (Chưa xếp, cạnh thẻ chung), `--kb-sage`, `--kb-red`;
  `--kb-scrim` (nền sau hộp thoại), `--kb-shadow`.
  Font: `--kb-display` (Spectral, có chân) cho tiêu đề — phần nhấn in nghiêng `.kb-em` màu `--kb-topic` hoặc
  `--kb-gold` ("Kho Tàng *Kiến Thức*"); `--kb-font` (Be Vietnam Pro) cho chữ, `--kb-mono` chỉ cho phím tắt / code.
- **Nhãn**: chữ thường, `≥12px`, không mono viết hoa. Bỏ nhãn thừa.
- **Màu chủ đề** lấy từ `collection_topics.color`, truyền qua biến `--kb-topic` đặt inline (`.kb-dot`, `.kb-orb`,
  quầng thẻ chủ đề, viên chủ đề trang đọc). Chưa có chủ đề → `--kb-faint` hoặc `--kb-gold`.
- **Khung**: `.kb-shell` lưới `252px | minmax(0,1fr)` (cột trái `.kb-side`); trang đọc / soạn `--doc` một cột.
  769–860px cột trái thành thanh trên (viên cuộn ngang). ≤768px (đã đăng nhập) như Finance: ẩn thanh Life Hub + tab đáy
  chung (`body.in-knowledge-workspace`); `.kb-shell` 3 hàng: `.kb-mbar` (trong suốt: ô tìm · `.kb-topic-select` ·
  nút ＋ tròn) · nội dung · `.kb-tabbar` (Home · 5 kiểu xem, `order: 1`). Viên `.kb-topic-select` dùng chung với trang đọc:
  `KBTopicSelect` (`KBTopicPicker.jsx`) là SearchSelect vẽ thành viên tròn tô `--kb-topic`, menu 240px neo phải, mỗi dòng
  chấm màu chủ đề, `inputMode="none"` (điện thoại không bật bàn phím). SearchSelect trong `.kb-page` map token sang `--kb-*`
  và bỏ `backdrop-filter` của menu (`collect.css`).
  Danh sách / Tổng quan / Gallery chung `max-width: 1280px` + lề `28px 32px`; `.kb-content` có
  `scrollbar-gutter: stable`.
- **Chống nhảy**: lọc / đổi kiểu xem không được đổi chiều cao phần trên hay đẩy nút cạnh — hàng thẻ đếm theo phạm vi,
  nút bật / tắt giữ nguyên chữ (trạng thái bằng màu + `aria-pressed`), không thêm / bớt tab theo kết quả lọc.
- **Đầu danh sách** `.kb-topic-head`: dải mở, không khung — quầng `--kb-topic` góc trên trái + `border-bottom`,
  không quả cầu; tên Spectral nghiêng 34px màu `--kb-topic` (không có thì `--kb-gold`; nền sáng pha 55% với `--kb-tx`),
  số bài là viên `--kb-p2`, hàng thẻ thẳng lề trái.
- **Nút**: `.kb-btn-primary` (nền mint + quầng `--kb-glow`), `.kb-btn-soft` (nền accent-soft), `.kb-btn-ghost` (viền),
  `.kb-btn-violet`, `.kb-icon-btn` (32px, `--danger`, `.is-on`), `.kb-link`. Nhóm chọn một: `.kb-seg`
  (`--quiet` không khung). Chip chủ đề trong bộ chọn: `.kb-chip` viên tròn `999px`.
- **Trang đọc**: thanh trên trong suốt, chỉ có hai cụm `.kb-reader__group` (viên, nền `--kb-pop` 72%) để trời / trăng
  không bị che. Cột chữ `max-width: 760px` giữa vùng đọc, cột phải 320px.
- **Màu chữ trong bài**: không vá bằng CSS `span[style*=color]`; màu inline làm chìm chữ bị gỡ khi nạp
  (`migrateTiptapDoc` trong `kbDeriveUtils`), màu nhấn (tím, đỏ…) giữ nguyên.
- **Hiệu năng**: không `backdrop-filter` ở đâu trong Knowledge — trời phía sau chuyển động nên blur sẽ tính lại mỗi khung;
  cột / thanh dùng `color-mix(--kb-bg, transparent)`, hộp thoại `--kb-pop` đặc. Chỉ animate transform / opacity
  (vạch đọc dùng `scaleX`).
- **Focus**: `.kb-page :focus-visible` viền `2px --kb-accent`; Giảm chuyển động tắt chuyển động trong `.kb-page`.

### Other active shared atoms (`global.css`)

- **`.section-label`** — uppercase pill, `0.4rem 1rem`,
  `rgba(139,92,246,0.12)` on `rgba(139,92,246,0.25)`, `--purple-light`,
  `0.85rem/600`, `0.05em` tracking.
- **`.progress-bar-track` / `-fill`** — `6px` tall, `--radius-full`,
  `rgba(255,255,255,0.08)` track, `--grad-text` fill, width eased over `0.8s`
  on the spring curve, with a `40px` `shimmer 1.5s` highlight.
- **Scrollbar** — `6px` wide, `--bg-secondary` track,
  `rgba(139,92,246,0.4)` thumb at `3px` radius, `--purple` on hover.

### Tasks workspace (Aurora) — `src/styles/tasks-aurora.css`

Trang Nhiệm vụ dùng bộ token riêng `--tk-*`, khai báo trên `.tasks-workspace`
theo `[data-theme]`: tối = mockup 2a (mint `#5EF2C2`, nền trời `#0C1634→#060914`), sáng = mockup 2b
(violet `#7C3AED`, nền `#F4F2FF`). Nền trời do `SkyBackground.jsx` + `sky.css` vẽ (dùng chung với Knowledge — bản `calm` — và FX Lab):
tối = aurora, Ngân Hà, 4 lớp sao, sao băng vệt sáng mint (góc 32°, lấy từ bản thiết kế Kiến Thức), sao chổi; desktop thêm trăng đúng pha âm lịch hôm nay,
sao sáng 4 cánh, 6 chòm sao lần lượt hiện (chu kỳ 150s) và chân trời hành tinh.
Sáng = bình minh (trước 12h) / hoàng hôn (`.is-dusk`, từ 12h): mặt trời mọc, mây màu nước SVG, hạt sáng bay.
Bật Giảm chuyển động (Cài đặt) thì tắt mọi chuyển động nền, vật bay và hiệu ứng sự kiện.

- **Kiểu "Rừng tiên"** (`src/styles/tasks-elf.css`, mockup "Nhiệm vụ - Rừng tiên (Elf)"): chọn ở Cài đặt → Chung →
  "Giao diện trang Nhiệm vụ" (`taskStyle` trong `ThemeContext`, localStorage `vl_task_style`, mặc định `default`).
  Workspace có class `.tk-elf` → ghi đè token `--tk-*` (xanh lá/vàng đồng sáng, mint/vàng đêm), font tiêu đề
  Cormorant SC (cỡ ×`--tk-ds`, đậm `--tk-elf-w`), thẻ bo `5px 18px` + kính mờ. Trang trí ở `TaskElfDecor.jsx`
  (dây leo cột — hoa góc chỉ bản sáng, hoa văn dưới tên cột, hoa nở trên thẻ xong — bản sáng). Khung cột sáng
  và tối giống nhau (đầu cột `16px 12px 8px 18px`); không dùng vòm nhọn cho cột vì ăn chỗ của thẻ.
  Nền ở `TaskForestBackground.jsx`: rừng ngày = 3 lớp cây SVG sinh thủ tục (thân/cành cong, tán lá méo bằng
  feTurbulence; tính 1 lần/cỡ, giãn theo trang) + rêu rủ đung đưa + nấm phát sáng + suối, nắng xuyên, lá rơi, bướm;
  sương mù ngẫu nhiên (`FogBank`: lớp sau giữa cây tầng giữa/gần, lớp trước mỏng phủ cây gần; mỗi lớp kéo đến rồi tan
  theo chu kỳ riêng 38–64s, tan hết thì xếp mảng sương lại chỗ ngẫu nhiên; mobile ít mảng, không blur);
  desktop sáng có tiên đốm sáng bay TRÊN nội dung (`.task-fx-top`, z-index 40, không nhận chuột).
  Tương tác (`utils/taskFlyersElf.js`, gắn ở `SkyBackground` khi kiểu Elf): workspace mang `data-frame` = c/a/cm/am;
  nấm + đom đóm bấm được, bấm nền rung lá, sương (`[data-fog]`) tan quanh con trỏ, xong việc → `celebrate`.
  Thẻ: dây leo (trễ), dây leo nở hoa (xong), đom đóm (đang làm); cây chuỗi ngày `ElfStreakTree` góc trái dưới desktop.
  Sidebar toàn app dùng skin kính lá của mockup này (`.sidebar--elf`, luôn gắn trong Navbar, CSS ở `navbar.css`):
  sáng trắng-lục, tối rêu thẫm; logo xanh lá→vàng đồng / mint; mục đang mở ô trắng nổi (sáng) hoặc viền mint (tối);
  áp cả thu gọn lẫn mở rộng, mọi trang, không phụ thuộc kiểu giao diện trang Nhiệm vụ.
  Rừng đêm desktop dùng chung trăng/sao/chòm sao với Aurora + tán tối, đom đóm, bào tử, lá phát sáng;
  rừng đêm mobile là cảnh riêng (3 lớp sao, trăng nhỏ, 2 sao băng). Mobile có bản cảnh riêng 390×844 như mockup.
  Cỡ chữ display trong tasks-aurora.css viết `calc(Npx * var(--tk-ds, 1))` để kiểu khác phóng to được.
- **Vật bay ngẫu nhiên** (cả 2 kiểu): DOM do `utils/taskFlyersAurora.js` / `taskFlyersElf.js` dựng vào `.task-fly-host`
  (cuối `.task-cosmos-bg`), bay bằng Web Animations rồi tự xoá. Keyframe CSS của chúng mang tiền tố `tkf-`
  (chung ở tasks-aurora.css, riêng Elf ở tasks-elf.css). Code là port mockup — khi mockup đổi, chép lại hàm `flySpawn`.
  Ban đêm cả 2 kiểu trộn thêm `utils/taskNatureFx.js` (port `nature-fx.js`): sao ước nguyện bấm được,
  Thợ Săn, cầu vồng trăng, Ngân Hà, hồ, sương, lá bạc, bồ công anh, rêu + nguyệt thực (1/40 lượt). Hình bám trăng / chân
  trời lấy mốc thật qua `skyMoon` / `horizonY` (khớp `Moon`, `MobileMoon`, `.task-planet-horizon`); mặt đất mobile tính
  cách đáy trang (mockup 742/758 → `H - 16`) để không lọt khỏi màn hình thấp.
- **Ngắm cảnh**: `.tasks-workspace.is-scene` ẩn mọi con trừ `.task-cosmos-bg`, `.tk-scene-btn`, `.tk-elf-streak`.
- **Cột Kanban** co theo nội dung: `.tk-col-slot` (vùng thả, cao hết) chứa `.tk-col` (`max-height: 100%`).
- Màu tình trạng thời gian của thẻ: `--tk-ks-{late|today|soon|none|done|skip}-{glow|tint|fg|bg|bd}`
  (viền trái · nền ánh · nhãn ngày). Màu cột: `--tk-st-{todo|doing|done|skip}`.
  Ô được chọn: `--tk-sel-bg` / `--tk-sel-fg`; Chủ nhật: `--tk-sun`.
- Không viết cứng màu tối/sáng trong JSX của Tasks — luôn dùng token để hai theme tự đổi.
  `AppIcon color="var(--x)"` được chuyển sang `style.color` (thuộc tính SVG `fill` không nhận biến CSS).
- Breakpoint mobile = `≤768px` (cùng khung app: topbar 52 + tab đáy 60). Nền mobile tối: aurora, Ngân Hà,
  sao, 3 sao băng, sao chổi nhỏ (không trăng / chòm sao / chân trời) như mockup.
- Nền động (`SkyBackground` / `TaskForestBackground`): `.task-cosmos-bg` có `contain: strict`; lớp vật bay
  `.task-fly-host` là size container (`cqw/cqh`). Không blur lớp gradient, chỉ animate transform/opacity
  (xem Performance rules ở Elevation & Depth). Thẻ Kanban Rừng tiên không kính mờ (cột đã kính mờ); thẻ mobile giữ.
- Ngăn chi tiết `.tk-drawer` (560px, ≥1600px là 600px, nổi phải): ở Kanban nổi **đè** lên bảng; Danh sách/Lịch ≥1280px vẫn chừa
  `padding-right: calc(var(--tk-drawer-width) + 28px)` (588px/628px) cho `.tk-main`. Mobile = sheet dưới + `.tk-drawer-backdrop`.
- Hàng việc con (`.tk-subs__row` trên thẻ, `.tk-sub-row` trong ngăn chi tiết): tay nắm `.tk-sub-grip` (span
  `role="button"`, `touch-action: none`) + nút ưu tiên `.tk-sub-pr` (`.is-unset` mờ, chỉ hiện khi hover; `hover: none`
  luôn hiện mờ). Kéo thả qua `useSubtaskReorder` (Pointer Events): hàng `data-drag="self"` nhấc theo con trỏ,
  `before|after` = vạch thả `--tk-accent`. Nút ▶/⏸ `.tk-sub-focus` (`.is-on`), hàng `.is-doing` (nền + vạch trái
  `--tk-st-doing`), chip hạn `.tk-sub-due--{late|soon|today|upcoming}` dùng token `--tk-ks-*`; dòng `.tk-focus-line`
  trên mặt thẻ. Mobile (≤768px): hàng việc con là lưới cột cố định, chip hạn nằm dưới tên; thẻ ẩn nút ưu tiên chưa
  đặt, ngăn chi tiết chỉ hiện icon (`.tk-sub-btn__label` ẩn).
- Khối giờ tab Ngày `.tk-dv-block.is-long` (≥96px): nội dung dồn lên đầu, nền `--k-bg` nhạt dần + viền `--k-bd`;
  việc con `.tk-dv-sub` hàng 24px (mobile 30px) — đổi cỡ thì sửa cùng `BLOCK_HEAD`/`SUB_ROW` trong `CalendarDayView`.
- Thành phần dùng chung: `TaskCard` (`variant` card/row/mobile), `TaskFilterBar`, `TaskTodayStrip`,
  `TaskQuickAdd` (sheet "Việc mới"), `TaskDetailDrawer`, `TaskSubtaskModal` (‹ › giữa các việc con),
  `CalendarNavHead` (hàng điều hướng khung lịch), `TaskDayPopover` (popover "Ngày": việc trong ngày +
  gõ nhanh; mở từ nút + ở Tháng, "Thêm việc" ở Lịch biểu, bấm ô giờ ở Ngày/Tuần).
- Biến `--k-*` của thẻ/khối lấy qua `ksStyle(k)` (`kanbanUtils`); chấm sự kiện qua
  `holidayDot(type)` → `--tk-ev-{vn|lunar|intl|jp|anni|geek}`.
- Lịch biểu `.tk-ag-*`: banner quá hạn (mở ra để xem / "Dời hết sang hôm nay"), nhóm tuần, ngày trống
  gộp hàng nét đứt, ngày = cột 132px | danh sách (mobile: khối dọc), vạch "bây giờ"; 3 tuần + "Xem thêm 2 tuần".
- Ngày `.tk-dv-*`: lưới 56px/giờ (CSS kẻ cùng bước với `PX_PER_HOUR`), khối 50px viền trái 3px,
  dải giờ hoàng đạo `--tk-band`; desktop có cột phải 320px (Chưa xếp giờ + bảng 12 giờ hoàng đạo).
  Mobile: "Chưa xếp giờ" trên lưới (2 việc + Xem thêm), giữ 320ms để kéo (`.tk-touch-ghost`, `.tk-touch-slot`).
- Tuần `.tk-wk-*` (chỉ desktop): lưới 48px/giờ, khối 44px; hàng đầu dùng `scrollbar-gutter: stable`
  để thẳng cột với lưới cuộn.
- Tháng `.tk-mo-*`: desktop lưới kín khung (ngày tháng trước/sau mờ), 1 sự kiện + tối đa 3 pill/ô
  (có sự kiện còn 2), "+N nữa"; mobile lưới gọn 50px (số · âm lịch · chấm) + danh sách ngày đang chọn.
- Kéo thả trên Lịch: vùng thả có class `.is-drop-over` (viền nét đứt `--tk-accent`).
- Bảng "Lịch & sự kiện" (`CalendarWidgetPanel`, class `.tk-ut-*`): khung 360px nổi phải (mobile sheet), tab
  Lịch vạn niên / Sự kiện; token riêng `--tk-ut-{tabs-bg|tabs-bd|hover|hero-bg|hero-bd|lunar|sun|chip-bg|chip-bd|
  row-bg|seg-on|seg-off|mute|sw-off}` khai báo ở 4 khối (tối, sáng, Rừng tiên sáng/tối); số dương/âm lớn dùng
  `--tk-font-display` × `--tk-ds`.
- Popover đổi ngày giờ / lọc khoảng ngày (`.tk-datepick`, `.tk-dp-*`, `.tk-rp-*`): rộng 256px, ô 38px (Bắt đầu /
  Kết thúc), lịch 29px có ngày âm (`MonthGrid` nav `center` = ‹ Tháng ›, `left` = Tháng ‹ ›; `joined` nối liền khoảng),
  chân có vạch chia; nền ô mềm `--tk-pp-soft`. Khung `.tk-popover` + lịch tháng nằm ở `date-popover.css` (dùng chung):
  `DatePopover` (chọn một ngày, bấm là chọn) là lịch của ô ngày Finance — Finance map `--tk-*` sang `--n-*` ở `.fin-datepop`.

## Do's and Don'ts

**Tokens**

- **Do** use `src/styles/global.css` as the default source for colour, radius,
  spacing and shadow tokens. The only domain-scoped token systems are Vault
  Ops console in `accounts.css`, Finance Nocturne (`--n-*`) in `finance.css` and the home dashboard
  palette (`--dash-*`) in `dashboard.css`.
- **Home dashboard palette (`dashboard.css`):** the redesigned home page follows its own design file,
  so `.dash-workspace` declares a scoped `--dash-*` palette (paper light by default, override under
  `[data-theme="dark"] .dash-workspace`) — the third scoped system next to Vault (Ops console) and Finance
  Nocturne. State colours (calendar cells, priority pills, body/recovery states, chart strokes) are
  classes over that palette; JSX keeps only geometry (`width`, `height`, `top/left`) inline.
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
- **Do** use the Workspace Pattern (`height: 100dvh; overflow: hidden;`) for dense
  interactive views (Calendar, Knowledge Editor, Vault Manager, Finance Dashboard)
  on desktop to eliminate full-page body scrolling.
- **Do** keep navigation toolbars and filter bars sticky/static (`flex-shrink: 0;`)
  above internal scrolling containers (`.app-workspace-scroll`) to prevent layout jumps
  and scroll-traps.
- **Do** compact that fixed chrome on short desktop viewports so the scroll area keeps
  room: `@media (min-width: 769px) and (max-height: 760px)` tightens padding/type, and
  `(max-height: 560px)` hides purely decorative strips. Applied in Tasks (`tasks-aurora.css`:
  header, dải Hôm nay → ẩn ở tầng 2) and Finance Định kỳ & Quỹ (`finance.css` `.fin-hub`: ô KPI
  bỏ thanh tiến độ, lịch chi dạng chấm → ẩn lưới ngày ở tầng 2).
- **Do** declare CSS Grid columns with `repeat(N, minmax(0, 1fr))` instead of raw `1fr`,
  preventing cells from ballooning when wide text or multi-column overlapping chips
  are rendered.
- **Do** pad the interior of scrolling containers (`padding-bottom: var(--bottom-fab-pad, 40px)`)
  to clear the QuickCapture Floating Action Button, rather than shrinking the outer card boundary.
- **Don't** allow two nested scrollbars to fight for mousewheel control; scroll occurs
  inside the content viewport only.
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
  Giảm chuyển động escape (`:root[data-reduce-motion]`), as `.page-transition` does.

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
7. **Eight blur radii.** `4/6/8/10/12/16/20/24px` are all in use with no
   `--blur-*` token. TODO: decide whether to tokenise.
8. **Light theme coverage is partial.** `[data-theme="light"]` overrides
    `--bg-*`, `--text-*`, `--shadow-*` and six brand colours, but not
    `--blue`, `--purple-dark`, `--cyan-light`, `--green-dim` (only
    partially), or any `--grad-*`. TODO: decision needed on completing it.
9. **No global form-control baseline.** There is no `input`/`textarea`/
    `select` element rule; each module restyles fields, and the "shared"
    reference is `.generic-modal__input`. TODO: decide whether to promote it.
10. **`.dp-grid__cell--other` uses raw white-alpha foregrounds** that need a
    dedicated light-mode check rather than relying on dark-theme material.
11. **Unused global utilities remain in CSS.** `.btn-neon`, `.btn-gold`,
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
