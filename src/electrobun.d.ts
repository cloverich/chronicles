/**
 * Type declarations for Electrobun integration.
 */

// Electrobun's bundled code imports 'three' but doesn't ship types.
// Suppress TS7016 without installing @types/three.
declare module "three";

/**
 * Electrobun adds `electrobun-webview` and `electrobun-wgpu` to HTMLElementTagNameMap
 * at runtime. These declarations keep TypeScript happy in renderer code.
 */
interface ElectrobunWebviewElement extends HTMLElement {}
interface ElectrobunWgpuElement extends HTMLElement {}

declare global {
  interface HTMLElementTagNameMap {
    "electrobun-webview": ElectrobunWebviewElement;
    "electrobun-wgpu": ElectrobunWgpuElement;
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    "electrobun-webview": React.DetailedHTMLProps<
      React.HTMLAttributes<ElectrobunWebviewElement>,
      ElectrobunWebviewElement
    >;
    "electrobun-wgpu": React.DetailedHTMLProps<
      React.HTMLAttributes<ElectrobunWgpuElement>,
      ElectrobunWgpuElement
    >;
  }
}
