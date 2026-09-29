// Decorative contribution-graph squares that twinkle behind the landing page.
const grid = document.getElementById("bg-grid");
if (grid) {
  const cells = 7 * 30;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < cells; i++) {
    const cell = document.createElement("i");
    const level = Math.random();
    if (level > 0.55) {
      cell.className = level > 0.9 ? "l3" : level > 0.75 ? "l2" : "l1";
      cell.style.animationDelay = `${(Math.random() * 6).toFixed(2)}s`;
    }
    frag.appendChild(cell);
  }
  grid.appendChild(frag);
}
