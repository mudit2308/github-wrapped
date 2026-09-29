// Small shared UI helpers: language colors, escaping, and animations.

const LANGUAGE_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Java: "#b07219",
  Go: "#00ADD8", Rust: "#dea584", "C++": "#f34b7d", C: "#555555", "C#": "#178600",
  Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB",
  HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051", "Jupyter Notebook": "#DA5B0B",
  Vue: "#41b883", Svelte: "#ff3e00", Lua: "#000080", Scala: "#c22d40", R: "#198CE7",
};
export const colorFor = (lang) => LANGUAGE_COLORS[lang] || "#9aa4b2";

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animate an element's text from 0 up to `to` (ease-out), formatted with separators. */
export function countUp(el, to, { duration = 1400, delay = 0 } = {}) {
  if (!el) return;
  const final = to.toLocaleString();
  if (prefersReducedMotion() || to <= 0) {
    el.textContent = final;
    return;
  }
  el.textContent = "0";
  const start = performance.now() + delay;
  const tick = (now) => {
    if (!el.isConnected) return;
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(to * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = final;
  };
  requestAnimationFrame(tick);
}
