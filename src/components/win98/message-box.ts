import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import { closeMenus } from "./menu";
import { captionGlyph } from "./shared";

export type MessageBoxButton = {
  id: string;
  label: string;
  /** Enter triggers it unless focus is on another button. */
  default?: boolean;
  /** Escape and the Close button choose it. */
  cancel?: boolean;
};

export type MessageBoxOptions = {
  title: string;
  /** A windowsIcon name, drawn at 32 px left of the text. */
  icon?: string;
  /** Plain text (one paragraph per line) or prepared content. */
  body: string | Node;
  buttons?: MessageBoxButton[];
  role?: "alertdialog" | "dialog";
  /**
   * Dialog layouts: "dialog" right-aligns the buttons (Run); a property
   * sheet also shows its single tab above a raised page. Message boxes
   * (the default) centre them.
   */
  layout?: "message" | "dialog" | { sheet: string };
  /** The .Win98 desktop; defaults to the one that contains focus. */
  host?: HTMLElement;
  /** Receives focus afterwards; defaults to the element focused on open. */
  returnFocus?: HTMLElement | null;
  /** Receives focus on open; defaults to the default button. */
  initialFocus?: HTMLElement;
  /**
   * Called for every button before the box closes; returning false keeps it
   * open (for Help, or to reject an entry).
   */
  onButton?: (id: string) => boolean | void;
  /** Aborting closes the box as if cancelled. */
  signal?: AbortSignal;
};

let boxCount = 0;

/** A message box or Stand by blocks the rest of the desktop. */
export const isModalOpen = (root: HTMLElement) =>
  !!root.querySelector(":scope > .WinModal, :scope > .WinStandby");

const tabStops = (box: HTMLElement) =>
  [
    ...box.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]",
    ),
  ].filter(element => {
    if (element.tabIndex < 0 || element.matches(":disabled")) return false;
    if (element.closest("[hidden], [inert]")) return false;
    // A radio group is one Tab stop: its checked (or else first) radio.
    if (element instanceof HTMLInputElement && element.type === "radio") {
      const group = [
        ...box.querySelectorAll<HTMLInputElement>(
          `input[type="radio"][name="${CSS.escape(element.name)}"]`,
        ),
      ];
      const checked = group.find(radio => radio.checked);
      return checked ? checked === element : group[0] === element;
    }
    return true;
  });

/**
 * A modal Win98 message box centred on the desktop. Resolves with the chosen
 * button's id; Escape and Close resolve with the cancel button's id.
 */
export function messageBox(options: MessageBoxOptions): Promise<string> {
  // An open menu hands focus back to whatever opened it; that element is the
  // box's opener (a menu item would be gone by the time the box closes).
  closeMenus("escape");
  const opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const host =
    options.host ??
    opener?.closest<HTMLElement>(".Win98") ??
    document.querySelector<HTMLElement>(".Win98") ??
    document.body;
  const buttons = options.buttons ?? [
    { id: "ok", label: "OK", default: true, cancel: true },
  ];
  const cancelId =
    buttons.find(button => button.cancel)?.id ??
    (buttons.length === 1 ? buttons[0].id : undefined);
  const id = `win-message-${++boxCount}`;

  const layer = document.createElement("div");
  layer.className = "WinModal";
  const box = document.createElement("section");
  const layout = options.layout ?? "message";
  const sheet = typeof layout === "object" ? layout.sheet : undefined;
  box.className =
    layout === "message"
      ? "WinMessageBox"
      : "WinMessageBox WinMessageBox--dialog";
  box.setAttribute("role", options.role ?? "alertdialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-labelledby", `${id}-title`);
  box.setAttribute("aria-describedby", `${id}-body`);
  box.tabIndex = -1;
  box.innerHTML = `<header class="WinTitlebar"><strong id="${id}-title">${escape(options.title)}</strong><div class="WinWindowControls"><button type="button" class="WinMessageBoxClose" data-crt-hit aria-label="Close" data-tip="Close"${cancelId ? "" : " disabled"}>${captionGlyph("close")}</button></div></header>${sheet === undefined ? "" : `<div class="WinSheetTabs" aria-hidden="true"><span>${escape(sheet)}</span></div>`}<div class="WinMessageBoxContent${sheet === undefined ? "" : " WinSheetPage"}">${options.icon ? windowsIcon(options.icon) : ""}<div class="WinMessageBoxText" id="${id}-body"></div></div><div class="WinMessageBoxButtons">${buttons
    .map(
      button =>
        `<button type="button" class="WinButton${button.default ? " WinButton--default" : ""}" data-message-button="${escape(button.id)}">${escape(button.label)}</button>`,
    )
    .join("")}</div>`;
  const text = box.querySelector<HTMLElement>(".WinMessageBoxText")!;
  if (typeof options.body === "string")
    for (const line of options.body.split("\n")) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      text.append(paragraph);
    }
  else text.append(options.body);
  layer.append(box);

  // Everything else on the desktop, including earlier message boxes, is inert.
  const background = [...host.children]
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map(element => ({ element, inert: element.inert }));
  for (const { element } of background) element.inert = true;
  // The box is the foreground window now: its owner's caption turns grey.
  const captions = [
    ...host.querySelectorAll<HTMLElement>(
      '[data-window][data-active="true"], .WinMessageBox:not([data-active="false"])',
    ),
  ];
  for (const caption of captions) caption.dataset.active = "false";
  host.append(layer);

  const defaultButton =
    box.querySelector<HTMLButtonElement>(".WinButton--default") ??
    box.querySelector<HTMLButtonElement>("[data-message-button]");
  (options.initialFocus ?? defaultButton ?? box).focus({ preventScroll: true });

  return new Promise(resolve => {
    const listeners = new AbortController();
    function finish(result: string) {
      listeners.abort();
      layer.remove();
      for (const { element, inert } of background) element.inert = inert;
      if (!host.querySelector('[data-window][data-active="true"]'))
        for (const caption of captions)
          if (caption.isConnected) caption.dataset.active = "true";
      const target = options.returnFocus ?? opener;
      if (target?.isConnected && !target.closest("[inert]"))
        target.focus({ preventScroll: true });
      resolve(result);
    }
    function choose(result: string) {
      if (options.onButton?.(result) === false) return;
      finish(result);
    }
    if (options.signal?.aborted) {
      finish(cancelId ?? "");
      return;
    }
    options.signal?.addEventListener("abort", () => finish(cancelId ?? ""), {
      signal: listeners.signal,
    });
    box.addEventListener(
      "click",
      event => {
        const target = event.target as Element;
        const button = target.closest<HTMLElement>("[data-message-button]");
        if (button) choose(button.dataset.messageButton!);
        else if (target.closest(".WinMessageBoxClose") && cancelId)
          finish(cancelId);
      },
      { signal: listeners.signal },
    );
    // The box is modal: a press anywhere else on the desktop does nothing
    // and leaves the keyboard in the box (Windows beeps).
    const topmost = () =>
      [...host.querySelectorAll(":scope > .WinModal")].at(-1) === layer;
    // The control that last had the keyboard in the box gets it back.
    let lastFocus =
      document.activeElement instanceof HTMLElement &&
      box.contains(document.activeElement)
        ? document.activeElement
        : undefined;
    box.addEventListener(
      "focusin",
      event => (lastFocus = event.target as HTMLElement),
      { signal: listeners.signal },
    );
    const keepFocus = () => {
      const focused = document.activeElement;
      (focused instanceof HTMLElement && box.contains(focused)
        ? focused
        : lastFocus?.isConnected && !lastFocus.matches(":disabled")
          ? lastFocus
          : (defaultButton ?? box)
      ).focus({ preventScroll: true });
    };
    layer.addEventListener(
      "pointerdown",
      event => {
        if (box.contains(event.target as Node)) return;
        event.preventDefault();
        keepFocus();
      },
      { signal: listeners.signal },
    );
    // Focus that reaches the desktop anyway (the non-inert .Win98 itself)
    // returns to the box.
    host.addEventListener(
      "focusin",
      event => {
        if (topmost() && !box.contains(event.target as Node)) keepFocus();
      },
      { signal: listeners.signal },
    );
    box.addEventListener(
      "keydown",
      event => {
        // The box is modal: desktop shortcuts must not reach the windows behind.
        event.stopPropagation();
        // Escape, and Alt+F4 as in Windows, close a dialog as Cancel does.
        // Ctrl+Esc (Start) does nothing while a box is modal.
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
        const close =
          (event.key === "Escape" && plain) ||
          (event.key === "F4" &&
            event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey);
        if (close) {
          event.preventDefault();
          if (cancelId) finish(cancelId);
        } else if (event.key === "Enter") {
          const target = event.target as Element;
          if (target.closest("button, a, textarea, select")) return;
          event.preventDefault();
          defaultButton?.click();
        } else if (event.key === "Tab") {
          const stops = tabStops(box);
          if (!stops.length) {
            event.preventDefault();
            return;
          }
          // Wrap at both ends; the inert desktop already blocks the rest.
          const index = stops.indexOf(document.activeElement as HTMLElement);
          const last = stops.length - 1;
          let next: HTMLElement | undefined;
          if (event.shiftKey && index <= 0) next = stops[last];
          else if (!event.shiftKey && (index < 0 || index === last))
            next = stops[0];
          if (next) {
            event.preventDefault();
            next.focus({ preventScroll: true });
          }
        }
      },
      { signal: listeners.signal },
    );
  });
}
