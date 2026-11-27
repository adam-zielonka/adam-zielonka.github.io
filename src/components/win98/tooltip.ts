/** Hover time before a tooltip appears, as in Windows 98. */
export const TOOLTIP_DELAY = 500;
/** The tooltip sits this far below the pointer's hot spot (the arrow's size). */
const POINTER_HEIGHT = 20;

/**
 * Windows 98 tooltips for the mouse: an element with data-tip shows that
 * text in a pale yellow box below and right of the pointer after a short
 * hover, kept inside the workspace (above the taskbar for its buttons).
 * With data-tip-overflow it shows only while its label is cut off, as for
 * task buttons. Moving between tools swaps the text at once; a press, a
 * key, a scroll or leaving hides it. Accessible names stay in aria-label
 * (the box is aria-hidden), and touch and pen never show it.
 */
export function createTooltips({
  root,
  bounds,
  signal,
}: {
  /** The desktop: the tooltip's containing block. */
  root: HTMLElement;
  /** The tooltip stays inside this element (the workspace). */
  bounds: HTMLElement;
  signal: AbortSignal;
}) {
  const tip = document.createElement("div");
  tip.className = "WinTooltip";
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  root.append(tip);
  let target: HTMLElement | undefined;
  // A press or key on a tool hides its tooltip until the pointer leaves it.
  let dismissed: HTMLElement | undefined;
  let timer: number | undefined;
  let pointer = { x: 0, y: 0 };

  function textOf(element: HTMLElement) {
    const text = element.dataset.tip ?? "";
    if (!text || !element.hasAttribute("data-tip-overflow")) return text;
    const label = element.querySelector<HTMLElement>("span") ?? element;
    return label.scrollWidth > label.clientWidth ? text : "";
  }

  function hide() {
    window.clearTimeout(timer);
    timer = undefined;
    tip.hidden = true;
  }

  function show() {
    timer = undefined;
    const text = target?.isConnected ? textOf(target) : "";
    if (!text) return hide();
    tip.textContent = text;
    tip.hidden = false;
    // Client pixels per desktop pixel: the CRT may scale the desktop.
    const host = root.getBoundingClientRect();
    const scale =
      root.clientWidth > 0 && host.width > 0
        ? host.width / root.clientWidth
        : 1;
    const area = bounds.getBoundingClientRect();
    const local = (value: number, origin: number) => (value - origin) / scale;
    const left = local(area.left, host.left);
    const top = local(area.top, host.top);
    const right = local(area.right, host.left) - tip.offsetWidth;
    const bottom = local(area.bottom, host.top) - tip.offsetHeight;
    const x = local(pointer.x, host.left);
    const y = local(pointer.y, host.top);
    // Below the pointer, or above it where there is no room (the taskbar).
    let place = y + POINTER_HEIGHT;
    if (place > bottom) place = Math.min(y - tip.offsetHeight - 2, bottom);
    tip.style.left = `${Math.max(left, Math.min(x, right))}px`;
    tip.style.top = `${Math.max(top, place)}px`;
  }

  root.addEventListener(
    "pointerover",
    event => {
      if (event.pointerType !== "mouse") return;
      const element =
        event.target instanceof Element
          ? (event.target.closest<HTMLElement>("[data-tip]") ?? undefined)
          : undefined;
      if (element === target) return;
      const showing = !tip.hidden;
      hide();
      target = element;
      if (dismissed && dismissed !== element) dismissed = undefined;
      if (!element || element === dismissed) return;
      pointer = { x: event.clientX, y: event.clientY };
      // From one tool to the next, the tooltip follows at once.
      if (showing) show();
      else timer = window.setTimeout(show, TOOLTIP_DELAY);
    },
    { signal },
  );
  root.addEventListener(
    "pointermove",
    event => {
      if (timer !== undefined && event.pointerType === "mouse")
        pointer = { x: event.clientX, y: event.clientY };
    },
    { signal },
  );
  root.addEventListener(
    "pointerleave",
    () => {
      hide();
      target = undefined;
      dismissed = undefined;
    },
    { signal },
  );
  const dismiss = () => {
    if (target) dismissed = target;
    hide();
  };
  for (const type of ["pointerdown", "keydown", "wheel"])
    document.addEventListener(type, dismiss, {
      capture: true,
      passive: true,
      signal,
    });
  document.addEventListener("scroll", hide, {
    capture: true,
    passive: true,
    signal,
  });
  window.addEventListener("blur", hide, { signal });
  signal.addEventListener("abort", () => {
    hide();
    tip.remove();
  });
  return { element: tip, hide };
}
