// Reading-progress bar — fills from 0 to 100% as the user scrolls. Hidden
// when the document is shorter than 1.5 viewports (no progress bar on
// landing pages). Opt-in via docs.json `appearance.readingProgress`.

const bar = document.querySelector<HTMLElement>("#tangly-reading-progress");
if (bar) {
  function update() {
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    if (docHeight < winHeight * 1.5) {
      if (bar) bar.style.opacity = "0";
      return;
    }
    const scrolled = window.scrollY;
    const total = docHeight - winHeight;
    const pct = Math.min(100, Math.max(0, (scrolled / total) * 100));
    if (bar) {
      bar.style.transform = `scaleX(${pct / 100})`;
      bar.style.opacity = "1";
    }
  }
  document.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

export {};
