/**
 * Styles of the web tour layer. Everything is scoped to `rtk-` classes. Theme values arrive as
 * CSS variables set on `.rtk-root`. All rules live in a cascade layer, so the app's own CSS wins
 * over them without `!important` — except for the few properties marked `!important` here: what
 * keeps the tour in place, clickable and readable, which global resets (Tailwind's preflight,
 * normalize.css, Bootstrap, `dialog {…}` or `button {…}` rules) would otherwise change. Those
 * still follow the CSS variables.
 */
export const tourCss = `
@layer react-tour-kit {
:where(.rtk-root) {
  --rtk-primary: #2563eb;
  --rtk-on-primary: #ffffff;
  --rtk-bg: #ffffff;
  --rtk-title: #111827;
  --rtk-text: #4b5563;
  --rtk-overlay: rgba(0, 0, 0, 0.5);
  --rtk-radius: 12px;
  --rtk-spotlight-radius: 8px;
  --rtk-ease: cubic-bezier(0.2, 0, 0, 1);
  --rtk-z-index: 2147483000;
}

.rtk-root {
  position: fixed !important;
  inset: 0 !important;
  box-sizing: border-box !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  color: var(--rtk-text);
  overflow: visible !important;
  outline: none;
  transform: none !important;
  filter: none !important;
  /* The page may have disabled pointer events on <body> (modal libraries do while open). */
  pointer-events: auto !important;
  z-index: var(--rtk-z-index) !important;
  opacity: 0 !important;
  transition: opacity var(--rtk-fade-duration, 200ms) var(--rtk-ease);
}
.rtk-root::backdrop { background: transparent !important; backdrop-filter: none !important; }
.rtk-root[data-visible] { opacity: 1 !important; }

.rtk-backdrop { position: fixed !important; inset: 0 !important; touch-action: pinch-zoom; }
.rtk-backdrop[data-closable] { cursor: pointer; }

.rtk-spotlight {
  /* Its geometry is set inline, which an \`!important\` rule here would override. */
  position: fixed !important;
  right: auto;
  bottom: auto;
  margin: 0 !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  border: 0 !important;
  pointer-events: none !important;
  border-radius: var(--rtk-spotlight-radius);
  box-shadow: 0 0 0 2px var(--rtk-primary), 0 0 0 200vmax var(--rtk-overlay);
  box-shadow: 0 0 0 2px var(--rtk-primary), 0 0 0 6px color-mix(in srgb, var(--rtk-primary) 30%, transparent), 0 0 0 200vmax var(--rtk-overlay);
}
.rtk-spotlight[data-collapsed] { box-shadow: 0 0 0 200vmax var(--rtk-overlay); }

.rtk-tooltip {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  margin: 0 !important;
  box-sizing: border-box;
  display: flow-root;
  outline: none;
  overflow: visible;
  transform-origin: var(--rtk-origin, center);
}
.rtk-tooltip[data-overflowing] { overflow: auto; overscroll-behavior: contain; }
.rtk-tooltip[data-hidden] { visibility: hidden; }
.rtk-tooltip[data-entering] {
  animation: rtk-enter var(--rtk-enter-duration, 200ms) var(--rtk-ease) var(--rtk-enter-delay, 0ms) both;
}
/* The next step takes a moment to prepare: the tour is working, presses wait. */
.rtk-tooltip[data-waiting] > * {
  opacity: var(--rtk-waiting-opacity, 0.6);
  transition: opacity var(--rtk-fade-duration, 200ms) var(--rtk-ease);
}
.rtk-tooltip[data-waiting], .rtk-tooltip[data-waiting] * { cursor: progress !important; }
.rtk-measure {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  box-sizing: border-box;
  display: flow-root;
}

.rtk-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 380px;
  max-width: 100%;
  max-height: var(--rtk-max-height, none);
  border-radius: var(--rtk-radius);
  background: var(--rtk-bg);
  color: var(--rtk-text);
  box-shadow: 0 12px 32px -8px rgba(15, 23, 42, 0.35), 0 4px 12px -6px rgba(15, 23, 42, 0.2);
  font-size: 14px;
  line-height: 1.5;
  text-align: start;
}
.rtk-arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--rtk-bg);
  transform: rotate(45deg);
}
.rtk-arrow[data-side="bottom"] { top: -5px; left: calc(var(--rtk-arrow-offset) - 5px); }
.rtk-arrow[data-side="top"] { bottom: -5px; left: calc(var(--rtk-arrow-offset) - 5px); }
.rtk-arrow[data-side="right"] { left: -5px; top: calc(var(--rtk-arrow-offset) - 5px); }
.rtk-arrow[data-side="left"] { right: -5px; top: calc(var(--rtk-arrow-offset) - 5px); }

.rtk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 8px 0 16px;
}
.rtk-counter {
  border-radius: 999px;
  padding: 2px 10px;
  background: var(--rtk-primary);
  color: var(--rtk-on-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}
.rtk-close {
  position: relative;
  display: grid;
  place-items: center;
  box-sizing: border-box !important;
  width: 32px !important;
  height: 32px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 8px;
  background: transparent !important;
  color: var(--rtk-text) !important;
  cursor: pointer;
}
.rtk-close::before, .rtk-button--prev::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: currentColor;
  opacity: 0;
  transition: opacity 120ms;
}
.rtk-close:hover::before { opacity: 0.1; }
.rtk-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 8px 16px 16px;
}
.rtk-title { margin: 0 0 4px; color: var(--rtk-title); font-size: 17px; font-weight: 600; line-height: 1.35; }
.rtk-content { margin: 0; overflow-wrap: anywhere; }
.rtk-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 16px 16px;
}
.rtk-button {
  position: relative;
  box-sizing: border-box !important;
  min-height: 36px !important;
  margin: 0 !important;
  padding: 8px 14px !important;
  border: 0 !important;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px !important;
  font-weight: 500 !important;
  line-height: 1.4 !important;
  cursor: pointer;
  white-space: nowrap;
}
.rtk-button--prev { background: transparent !important; color: var(--rtk-text) !important; }
.rtk-button--prev::before { opacity: 0.08; }
.rtk-button--prev:hover:not(:disabled)::before { opacity: 0.14; }
.rtk-button--next { background: var(--rtk-primary) !important; color: var(--rtk-on-primary) !important; }
.rtk-button--next:hover { filter: brightness(1.08); }
.rtk-button:disabled { cursor: default; opacity: 0.4; }
.rtk-dots { display: flex; align-items: center; justify-content: center; min-width: 0; }
.rtk-dot, .rtk-ellipsis {
  position: relative;
  display: grid;
  place-items: center;
  box-sizing: border-box !important;
  width: 24px !important;
  height: 24px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  color: var(--rtk-text) !important;
}
.rtk-dot { cursor: pointer; border-radius: 50%; }
.rtk-dot::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.3;
  transition: opacity 150ms, transform 150ms;
}
.rtk-dot[aria-current="step"] { color: var(--rtk-primary) !important; }
.rtk-dot[aria-current="step"]::before { opacity: 1; transform: scale(1.15); }
.rtk-ellipsis::before { content: '…'; opacity: 0.5; font-size: 12px; letter-spacing: 1px; }
.rtk-close:focus-visible, .rtk-button:focus-visible, .rtk-dot:focus-visible {
  outline: 2px solid var(--rtk-primary);
  outline-offset: 2px;
}
.rtk-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* Position uses the individual \`translate\` property (applied first), the entrance uses \`transform\`,
   so scaling happens around the tooltip's own centre and never moves its position. Durations,
   offsets and reduced motion come from the shared motion settings, as variables. */
@keyframes rtk-enter {
  from {
    opacity: 0;
    transform: translate(var(--rtk-enter-x, 0), var(--rtk-enter-y, 0)) scale(var(--rtk-enter-scale, 1));
  }
}

@media (forced-colors: active) {
  .rtk-spotlight { outline: 3px solid Highlight; }
  .rtk-card { border: 1px solid CanvasText; }
  /* Without backgrounds, a border is what shows a button is one. */
  .rtk-button { border: 1px solid ButtonText !important; }
  .rtk-button:disabled { border-color: GrayText !important; }
  .rtk-dot::before { background: CanvasText; }
  .rtk-dot[aria-current="step"]::before { background: Highlight; }
}
}
`;

const injected = new WeakSet<Document>();

/** Adds the stylesheet to a document once. Constructable stylesheets are not subject to CSP `style-src` restrictions. */
export function injectTourStyles(document_: Document): void {
  if (injected.has(document_)) {
    return;
  }

  injected.add(document_);
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(tourCss);
    document_.adoptedStyleSheets = [...document_.adoptedStyleSheets, sheet];
  } catch {
    const style = document_.createElement('style');
    style.dataset.rtk = '';
    style.textContent = tourCss;
    document_.head.append(style);
  }
}
