// ponytail: rn-compat exists to let ~200 RN-shaped JSX sites migrate off react-native-web
// unchanged. Ceiling: new components still inherit RN flex-column box defaults via .rn-box.
// Upgrade path: delete this package when the last StyleSheet.create() call is gone. Not scheduled.
export const CSS = `
:root {
  --rn-safe-area-top: env(safe-area-inset-top, 0px);
  --rn-safe-area-right: env(safe-area-inset-right, 0px);
  --rn-safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --rn-safe-area-left: env(safe-area-inset-left, 0px);
}
.rn-box {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex-shrink: 0;
  min-width: 0;
  min-height: 0;
  position: relative;
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
}
.rn-text {
  display: block;
  color: inherit;
  font-family: inherit;
  /* RN sizes every node border-box. Without this a Text with both a width and
   * horizontal padding is wider than a View with the same style, which pulls
   * table-like rows of Text headers out of line with their View columns. */
  box-sizing: border-box;
}
.rn-box-none { pointer-events: none; }
.rn-box-none > * { pointer-events: auto; }
.rn-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rn-scroll-hide { scrollbar-width: none; -ms-overflow-style: none; }
.rn-scroll-hide::-webkit-scrollbar { display: none; }
.rn-pressable {
  cursor: pointer;
  background: none;
  padding: 0;
  margin: 0;
  text-align: inherit;
  font: inherit;
  color: inherit;
}
.rn-pressable:focus-visible { outline: 2px solid #4a90d9; outline-offset: 2px; }
.rn-pressable[aria-disabled='true'] { cursor: default; }
.rn-touchable {
  transition: opacity 0.1s ease-out;
}
.rn-touchable:active:not([aria-disabled='true']) { opacity: var(--rn-active-opacity, 0.6); }
.rn-textinput::placeholder { color: var(--rn-placeholder-color, inherit); }
.rn-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: var(--rn-switch-off, #ccc);
  cursor: pointer;
  transition: background-color 0.15s ease-out;
  flex-shrink: 0;
  border-width: 0;
  padding: 0;
}
.rn-switch-track[data-checked='true'] { background: var(--rn-switch-on, #4cd964); }
.rn-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--rn-switch-thumb, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease-out;
}
.rn-switch-track[data-checked='true'] .rn-switch-thumb { transform: translateX(18px); }
.rn-modal-backdrop {
  border: 0;
  padding: 0;
  margin: auto;
  max-width: 100vw;
  max-height: 100vh;
  width: 100%;
  height: 100%;
  background: transparent;
}
.rn-modal-backdrop::backdrop { background: transparent; }
/* Closed dialogs must stay display:none — opacity:0 alone still lays the element out and
 * still receives pointer events, so a closed-but-only-transparent modal would sit as an
 * invisible full-viewport layer on top of the whole app, eating every click. display:flex
 * (needed so the RN flex:1-centered backdrop child actually centers) only kicks in once
 * the dialog is actually [open]; the "display" entry in the transition still lets the
 * allow-discrete fade animate across the none <-> flex switch in both directions. */
dialog.rn-modal-backdrop {
  display: none;
  opacity: 0;
  transition:
    opacity 0.15s ease-out,
    overlay 0.15s ease-out allow-discrete,
    display 0.15s ease-out allow-discrete;
}
dialog.rn-modal-backdrop[open] {
  display: flex;
  opacity: 1;
}
@starting-style {
  dialog.rn-modal-backdrop[open] { opacity: 0; }
}
.rn-spinner {
  border-radius: 50%;
  border-style: solid;
  border-width: 2px;
  border-top-color: transparent !important;
  animation: rn-spin 0.7s linear infinite;
}
@keyframes rn-spin {
  to { transform: rotate(360deg); }
}
`;

let injected = false;

/** Injects the shared rn-compat stylesheet once, on first primitive use. */
export function ensureBaseCss(): void {
  if (injected || typeof document === 'undefined') {
    return;
  }
  injected = true;
  const style = document.createElement('style');
  style.setAttribute('data-rn-compat', '');
  style.textContent = CSS;
  document.head.appendChild(style);
}
