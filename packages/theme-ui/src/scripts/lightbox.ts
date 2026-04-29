// Lightbox modal for images. Listens for clicks on `[data-tangly-lightbox-src]`
// triggers, opens a fullscreen overlay, closes on Esc or outside-click.
// Builds the modal DOM imperatively (no innerHTML) to avoid any XSS risk.

let modal: HTMLDivElement | null = null;
let modalImage: HTMLImageElement | null = null;

function ensureModal(): HTMLDivElement {
  if (modal) return modal;
  modal = document.createElement("div");
  modal.className = "tangly-lightbox-modal";
  modal.hidden = true;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "tangly-lightbox-close";
  closeBtn.setAttribute("aria-label", "Close lightbox");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", close);
  modal.appendChild(closeBtn);

  modalImage = document.createElement("img");
  modalImage.className = "tangly-lightbox-image";
  modalImage.alt = "";
  modal.appendChild(modalImage);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.body.appendChild(modal);
  return modal;
}

function open(src: string, alt: string) {
  ensureModal();
  if (!modalImage || !modal) return;
  modalImage.src = src;
  modalImage.alt = alt;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function close() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trigger = target.closest<HTMLElement>("[data-tangly-lightbox-src]");
  if (!trigger) return;
  event.preventDefault();
  const src = trigger.dataset.tanglyLightboxSrc ?? "";
  const alt = trigger.dataset.tanglyLightboxAlt ?? "";
  if (src) open(src, alt);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal && !modal.hidden) close();
});

export {};
