import '@testing-library/jest-dom/vitest';

// jsdom implements <dialog> but not showModal/close, which rn-compat's Modal calls in an
// effect — without these any test rendering a Modal throws before asserting anything.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.open = false;
};
