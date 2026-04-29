// Announcement bar dismiss handler. The bar's id (`data-tangly-banner`)
// is used as the localStorage key; once dismissed it stays hidden until
// the id changes (rev the id to re-show after edits).

const bar = document.querySelector<HTMLElement>("[data-tangly-banner]");
if (bar) {
  const id = bar.dataset.tanglyBanner;
  const key = `tangly:banner:${id}`;
  try {
    if (id && localStorage.getItem(key) === "dismissed") {
      bar.hidden = true;
    }
  } catch {
    /* swallow */
  }
  bar.querySelector<HTMLButtonElement>("[data-banner-dismiss]")?.addEventListener("click", () => {
    bar.hidden = true;
    try {
      if (id) localStorage.setItem(key, "dismissed");
    } catch {
      /* swallow */
    }
  });
}

export {};
