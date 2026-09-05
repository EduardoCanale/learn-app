/**
 * The CSS Custom Highlight API, which the Lesson reader paints with (ADR 0014).
 * Baseline since June 2025, but TypeScript's lib.dom declares only
 * `HighlightRegistry.forEach`, and puts `CSS` in a global namespace rather than
 * on `Window` — neither is reachable through an iframe's `contentWindow`.
 * Optional on purpose: the reader has to cope with them being absent.
 */

interface HighlightRegistry {
  set(name: string, highlight: Highlight): this;
  delete(name: string): boolean;
  clear(): void;
}

interface Window {
  readonly CSS?: { highlights?: HighlightRegistry };
  readonly Highlight?: typeof Highlight;
}
