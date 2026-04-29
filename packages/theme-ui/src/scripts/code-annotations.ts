export {};
// Pair numbered code-annotation markers with their `<li>` siblings.
// Hover or focus on a `[data-tangly-annotation]` button toggles
// `data-active` on the matching `<li data-tangly-annotation-target="N">`
// and vice versa. The list is the immediate-next sibling `<ol>` that the
// rehype-annotations plugin tagged with `tangly-code-annotation-list`.

function findList(button: Element): HTMLOListElement | null {
  const figure = button.closest(".tangly-code-figure");
  if (!figure) return null;
  const sib = figure.nextElementSibling;
  if (sib instanceof HTMLOListElement && sib.classList.contains("tangly-code-annotation-list")) {
    return sib;
  }
  return null;
}

function findFigure(li: Element): Element | null {
  const list = li.closest("ol.tangly-code-annotation-list");
  if (!list) return null;
  let sib = list.previousElementSibling;
  while (sib && !sib.classList?.contains("tangly-code-figure")) {
    sib = sib.previousElementSibling;
  }
  return sib instanceof Element ? sib : null;
}

function setActive(parent: Element, selector: string, n: string, on: boolean) {
  const target = parent.querySelector(
    `${selector}[data-tangly-annotation${selector === "li" ? "-target" : ""}="${n}"]`,
  );
  if (!target) return;
  if (on) target.setAttribute("data-active", "");
  else target.removeAttribute("data-active");
}

function init() {
  const handle = (event: Event, on: boolean) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    const marker = t.closest<HTMLElement>("[data-tangly-annotation]");
    if (marker) {
      const n = marker.getAttribute("data-tangly-annotation");
      if (!n) return;
      const list = findList(marker);
      if (list) setActive(list, "li", n, on);
      if (on) marker.setAttribute("data-active", "");
      else marker.removeAttribute("data-active");
      return;
    }
    const li = t.closest<HTMLElement>("li[data-tangly-annotation-target]");
    if (li) {
      const n = li.getAttribute("data-tangly-annotation-target");
      if (!n) return;
      const figure = findFigure(li);
      if (figure) setActive(figure, "[data-tangly-annotation]", n, on);
      if (on) li.setAttribute("data-active", "");
      else li.removeAttribute("data-active");
    }
  };

  document.addEventListener("mouseover", (e) => handle(e, true));
  document.addEventListener("mouseout", (e) => handle(e, false));
  document.addEventListener("focusin", (e) => handle(e, true));
  document.addEventListener("focusout", (e) => handle(e, false));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
