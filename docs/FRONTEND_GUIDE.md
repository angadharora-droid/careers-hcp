# CPH Frontends — Shared Stack & Brand Guide

Three separate Vite + React + Tailwind v4 apps, one shared visual system modeled on the Centre Point Nagpur website (centrepointnagpur.com): warm cream + beige, black serif display type, berry `#a80564` accent. Each app lives in its own folder and talks to the same backend.

| App | Folder | Dev port | Auth |
|---|---|---|---|
| Career Panel (public) | `career-panel/` | 5173 | none |
| HR Panel | `hr-panel/` | 5174 | hr_admin login |
| Interview Panel | `interview-panel/` | 5175 | interviewer login |

## Boilerplate (use EXACTLY this setup in each app)

`package.json` deps: `react ^18.3.1`, `react-dom ^18.3.1`, `react-router-dom ^6.26.0`;
devDeps: `vite ^5.4.0`, `@vitejs/plugin-react ^4.3.1`, `tailwindcss ^4.0.0`, `@tailwindcss/vite ^4.0.0`.
Scripts: `"dev": "vite", "build": "vite build", "preview": "vite preview"`.

`vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173, // 5174 hr / 5175 interview
    proxy: { '/api': 'http://localhost:5000' },
  },
});
```

`src/index.css` (Tailwind v4 — no tailwind.config.js needed):
```css
@import "tailwindcss";

@theme {
  /* Centre Point Nagpur design system (centrepointnagpur.com) */
  --color-cream: #f8ede2;        /* page background (site-wide on the reference) */
  --color-beige: #f0dfcd;        /* panels, inputs, alt sections, table headers */
  --color-beige-deep: #efddc9;
  --color-berry: #a80564;        /* PRIMARY accent — buttons, links, active nav */
  --color-berry-dark: #7e044e;   /* hover */
  --color-berry-soft: #f7e2ef;   /* berry tint backgrounds (selected rows, chips) */
  --color-ink: #000000;          /* headings / nav */
  --color-body: #393939;         /* body text */
  --color-muted: #6b6257;        /* warm gray — AA contrast on cream/beige for small labels */
  --color-line: #e6d9c8;         /* warm hairline borders */
  --color-card: #ffffff;
  --color-footer: #191919;       /* near-black footer */
  --color-brand-green: #2e7d4f;
  --color-brand-red: #b3261e;
  --color-brand-amber: #b8860b;
  --color-brand-blue: #2c5f8a;

  --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-label: "Marcellus", Georgia, serif;
  --font-sans: "Inter", -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-button: "Jost", "Inter", sans-serif;
}
```
Use as utilities: `bg-cream`, `text-berry`, `border-line`, `font-display`, `font-button`, etc.
Load the fonts in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Marcellus&family=Inter:wght@400;500;600&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
```

## API access

`src/lib/api.js` — a small fetch wrapper. `const API = import.meta.env.VITE_API_URL || '/api';`
(Dev goes through the Vite proxy; production can set VITE_API_URL.)
- Attach `Authorization: Bearer <token>` from `localStorage` (internal apps only).
- On any JSON response with `!res.ok`, throw `new Error(body.error || res.statusText)` and show it in the UI (toast or inline alert) — the backend's error strings are user-facing business-rule messages (recruitment gate, word cap, etc.).
- Internal apps: on 401, clear the token and return to the login screen.

## Brand / visual language (reference: centrepointnagpur.com — luxury-minimal hotel aesthetic)

The look is the Centre Point Nagpur website's: warm cream canvas, elegant serif display type,
black ink, one confident berry accent, generous whitespace, thin warm hairlines. No heavy
shadows, no rounded-pill UI — quiet, upscale, editorial.

- **Typography discipline**: big headings in `font-display` (Cormorant Garamond, weight 600,
  normal case, tight leading, large sizes — 28–44px+); above them a small "kicker" line in
  uppercase `tracking-[2px]` 11px berry (`font-button`). Body copy `font-sans` in `text-body`.
  Section/nav labels and table headers: uppercase, letterspaced, 10.5–11.5px.
- **Header**: cream bar (`bg-cream`), NOT dark: black serif wordmark "Centre Point" (font-display,
  ~20px, weight 700) + tiny uppercase letterspaced subtitle; nav links uppercase letterspaced
  12px black, active = berry with a 2px berry underline; a solid berry CTA button on the right.
  Thin `border-b border-line`. Sticky.
- **Page background** `bg-cream`; content cards: white (`bg-card`), `border border-line`,
  small radius (`rounded-sm`/`rounded-md` max), roomy padding (p-5/p-6). Card headings:
  font-display ~18–20px black with a thin hairline below (or a short 32px berry rule).
- **Buttons** (`font-button`, uppercase, `tracking-[2px]`, 12px, font-medium, `rounded-sm`,
  px-6 py-2.5): primary = solid berry, white text, hover `bg-berry-dark`; secondary "ghost" =
  transparent with 1px black border, black text, hover berry border+text; success actions may
  use `bg-brand-green`; destructive `bg-brand-red`. Text links: berry with underline on hover.
- **Inputs/selects/textareas**: on white cards use `bg-beige`-tinted fields (`bg-beige/40`)
  with `border-line`, focus ring/border berry; labels uppercase letterspaced 10.5px `text-muted`.
- Status pills (position): Filled=green tint, Vacant=red tint, Under Recruitment=amber tint,
  Frozen=indigo tint, On Hold=warm gray, Contract=teal tint, Outsourced=tan, Eliminated=dark.
  Keep tints soft/warm; small radius, uppercase 10px letterspaced.
- Stage badges (application): Applied=blue tint, Interview Scheduled=amber, Selected=green,
  Rejected=red, On Hold=warm gray. Same shape language.
- Recommendation chips: Strongly Recommend / Recommend = green tints, Hold = amber,
  Do Not Recommend = red.
- PCN / job codes: monospace, berry, bold.
- Selected/active row highlight (e.g. scoring anchors): `bg-berry-soft` with 1px berry border.
- **Tables**: 12px `font-sans`; column headers uppercase 10.5px letterspaced `text-muted`
  on `bg-beige`; warm hairline borders (`border-line`); zebra rows `bg-cream/50`.
- **Footer** (public app especially): `bg-footer` near-black, cream text, serif column
  headings, uppercase letterspaced link lists.
- Toasts: fixed bottom-center black pill, cream text, fade in/out (~2.2s).
- Placeholder competency warning: beige dashed box with amber text — "⚠ Placeholder content —
  the <dept> HOD must replace these anchors before this role goes live."
- Login screens (internal apps): cream page, centered white card with thin line border,
  serif heading, uppercase letterspaced sub-line, berry submit button.
- Mobile: grids collapse to one column; tables scroll horizontally inside their card
  (`overflow-x-auto`); hero type scales down gracefully.

## UX standards (apply to every app — these outrank visual preferences)

**Icons.** Never use emoji as UI glyphs (no 📎 ⚠ ✓ 🚩 ×). Each app has `src/components/Icons.jsx`
exporting small React components that render inline SVG (Lucide-style: 24×24 viewBox,
`fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"`,
sized via a `size` prop, default 16). One consistent stroke family per app; icons inherit
`currentColor`. Decorative icons get `aria-hidden`; icon-only buttons get `aria-label`.

**Motion.** CSS transitions only (no animation libs): 150–250ms, `ease-out` in / `ease-in` out.
Interactive elements transition color/border/background; pressable things give feedback
(`active:` opacity or 0.98 scale). Modals/drawers animate in (opacity + slight translate/scale,
~200ms). List/card entrances may stagger 30–50ms. Everything wrapped in
`@media (prefers-reduced-motion: reduce)` → transitions/animations effectively off (define a
global rule in index.css). Never animate width/height/top/left — transform/opacity only.

**Focus & keyboard.** Global `:focus-visible` style: 2px berry outline with 2px offset, on ALL
interactive elements (buttons, links, inputs, selects, radio rows, tabs). Modals/drawers close
on Escape and on backdrop click, autofocus their first field/heading, and return focus to the
trigger on close. Custom radio/checkbox rows keep real `<input>`s (visually hidden if styled)
so keyboard and screen readers work.

**Type floor & touch.** Nothing below 11px; body text 13–14px; form inputs ≥16px font-size on
mobile (prevents iOS auto-zoom) and ≥44px tall; buttons ≥40px tall (44px on mobile). Numeric
table cells and scores use `tabular-nums` and right-align. Keep uppercase+tracking for SHORT
labels/buttons/kickers only — never for sentences or long headings.

**Forms.** Semantic input types + `autocomplete`/`inputMode` where they exist (email, tel,
numeric). Validate on blur, not on keystroke; error text sits directly under the field in
brand-red 12px with `role="alert"`; on failed submit, focus the first invalid field. Required
fields marked with an asterisk. Submit buttons show a busy state (spinner + disabled) during
async work. Long selects get sensible defaults; helper text is persistent, not placeholder-only.

**Feedback.** Toasts: bottom-center black pill, `aria-live="polite"`, auto-dismiss 3–4s, with a
leading success (green check) or error (red) icon variant. Replace every `window.confirm` with
a styled confirm dialog: serif title, body copy, ghost Cancel + solid danger/primary Confirm,
Escape/backdrop dismiss. Destructive buttons are visually separated from primary actions.

**States.** Every async view has: a skeleton loading state (cream/beige shimmer blocks matching
the layout — not a lone spinner), an error state with a retry button, and a designed empty state
(an icon, a serif one-liner, a sentence of guidance, and — when sensible — a primary action).

**Tables (internal apps).** Sticky header row inside the scroll container, row hover tint
(`hover:bg-beige/40`), `tabular-nums` right-aligned numeric columns, "Showing N of M" counts
near filters, and filter chips/selects that read back the active state.

## Conventions

- React function components + hooks only; no state library — lift state or use small contexts (auth context in internal apps).
- react-router-dom v6. Internal apps: wrap authed routes; login screen = cream page, centered white card with a thin line border, serif "Centre Point" heading, uppercase letterspaced sub-line ("Centre Point Amravati · Recruitment 2026"), berry submit button.
- Currency: `₹` + `Number.toLocaleString('en-IN')`. Dates: `en-IN` short format.
- Keep all business math server-side; the UI displays what the API returns (score totals may be previewed live client-side while filling the form, using weight × level pct, but the submitted total is the server's).
- Each app must `npm run build` cleanly.
