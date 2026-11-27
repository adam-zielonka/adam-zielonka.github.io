import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import { captionGlyph, type CaptionGlyph } from "./shared";

/**
 * Win98-style popup menus and menu bars, shared by Start, context menus,
 * system menus and window menu bars. One "hot" item is shared by mouse and
 * keyboard: hovering focuses the item, and CSS highlights only focus.
 */
export type MenuItem = {
  /** '&' marks the mnemonic letter (rendered underlined); '&&' is a literal '&'. */
  label: string;
  action?: () => void;
  /** An external link, opened in a new tab. */
  href?: string;
  disabled?: boolean;
  check?: "check" | "radio";
  checked?: boolean;
  /** The default command, rendered bold. */
  default?: boolean;
  /** A right-aligned shortcut hint such as "Alt+F4". */
  shortcut?: string;
  /** aria-keyshortcuts, when the hint is not in that syntax ("Alt+←"). */
  keyshortcuts?: string;
  /** Nesting level, for hierarchies such as Explorer's Address list. */
  indent?: number;
  /** A windowsIcon name, for Start and cascading menus. */
  icon?: string;
  /** A caption-button glyph in the check column (the system menu). */
  glyph?: CaptionGlyph;
  submenu?: MenuItems;
};
/** "-" is a separator. */
export type MenuEntry = MenuItem | "-";
/** A function is evaluated on every open, so check marks stay current. */
export type MenuItems = MenuEntry[] | (() => MenuEntry[]);

export type MenuCloseReason =
  | "action"
  | "escape"
  | "tab"
  | "outside"
  | "blur"
  | "navigate"
  | "parent"
  | "programmatic";

export type OpenMenuOptions = {
  items: MenuItems;
  /** Opens next to this element (a menu-bar title, button or parent item). */
  anchor?: HTMLElement;
  /** Or at this point, in client coordinates (context menus). */
  point?: { x: number; y: number };
  placement?: "below" | "above" | "right";
  /** The menu this one cascades from. */
  parent?: MenuHandle;
  /** Receives focus when the menu closes with Escape, Tab or a command. */
  returnFocus?: HTMLElement | null;
  /** Which item gets focus: menus opened with the mouse start on the panel. */
  focus?: "first" | "last" | "menu" | "none";
  label?: string;
  className?: string;
  /**
   * Item icon size: 32 for Start's own items, otherwise 16 (cascades,
   * lists such as Address). Not inherited by cascades.
   */
  iconSize?: 16 | 32;
  /** Hosts the menu; defaults to the anchor's or the return target's .Win98. */
  host?: HTMLElement;
  /** Keeps the menu inside this element; defaults to the host's .WinWorkspace. */
  bounds?: HTMLElement;
  /** A pointerdown here is not "outside" (for example the menu bar itself). */
  ignore?: Element;
  /**
   * Inserts the menu right after this element, for reading order (Start
   * follows its button). host must stay its containing block.
   */
  after?: Element;
  /** Class names for cascades; defaults to className. */
  submenuClassName?: string;
  /** Trusted markup for a vertical banner along the left edge (Start). */
  banner?: string;
  /**
   * Cascades replace this menu instead of flying out, with a Back row:
   * for phones and coarse pointers. Inherited by cascades.
   */
  pushIn?: boolean;
  /** Left/Right past the ends of the chain, for menu bars. */
  onNavigate?: (direction: -1 | 1) => void;
  onClose?: (reason: MenuCloseReason) => void;
};

/** Internal options for pushed-in cascades. */
type ChildOptions = OpenMenuOptions & {
  /** Pushed-in cascades cover their parent and keep this edge in place. */
  pushAlign?: "top" | "bottom";
};

export type MenuHandle = {
  element: HTMLElement;
  readonly closed: boolean;
  readonly parent?: MenuHandle;
  close(reason?: MenuCloseReason): void;
  /** Focuses the first (or last) item. */
  focusItem(which: "first" | "last"): void;
};

/** Hover delay before a cascade opens or closes, as in Windows 98. */
export const MENU_HOVER_DELAY = 400;

let menuCount = 0;
/** Open submenus per menu, for chain membership checks. */
const openChild = new WeakMap<MenuHandle, MenuHandle>();
/** Menu-bar navigation, registered on the root of a chain. */
const rootNavigate = new WeakMap<MenuHandle, (direction: -1 | 1) => void>();
/** Cancels a pending hover cascade, when the pointer reaches the submenu. */
const cancelHover = new WeakMap<MenuHandle, () => void>();
/** Chains closing for a link: keep elements connected until it navigates. */
const followingLink = new WeakSet<MenuHandle>();
/** Open root menus. */
const chains = new Set<MenuHandle>();
/** The Back row of a pushed-in cascade. */
const BACK: MenuItem = { label: "&Back" };
/**
 * A pointer press started inside a menu. Touch browsers may move focus to
 * the page before they synthesize the click, so focus changes during the
 * press do not close the chain; the click (or a cancelled gesture) decides.
 */
let pressing = false;
let pressTimer: number | undefined;

/** Parses '&' mnemonics: "E&xit" gives "E<u>x</u>it" and the key "x". */
export function parseMnemonic(label: string) {
  let html = "";
  let text = "";
  let key: string | undefined;
  for (let index = 0; index < label.length; index++) {
    const char = label[index];
    const next = label[index + 1];
    if (char === "&" && next === "&") {
      html += "&amp;";
      text += "&";
      index++;
    } else if (char === "&" && !key && next?.trim()) {
      key = next.toLowerCase();
      html += `<u>${escape(next)}</u>`;
      text += next;
      index++;
    } else {
      html += escape(char);
      text += char;
    }
  }
  return { html, text, key };
}

const resolve = (items: MenuItems) =>
  typeof items === "function" ? items() : items;
const isEnabled = (element: Element) =>
  element.getAttribute("aria-disabled") !== "true";
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * Matches a typed letter against mnemonics, or else first letters. A single
 * match activates; duplicates cycle focus, as Windows menus do.
 */
export function mnemonicMatches<T extends HTMLElement>(
  elements: T[],
  keys: (string | undefined)[],
  letter: string,
): T[] {
  const explicit = elements.filter((_, index) => keys[index] === letter);
  if (explicit.length) return explicit;
  return elements.filter(element =>
    (element.textContent ?? "").trim().toLowerCase().startsWith(letter),
  );
}

function renderItem(item: MenuItem, iconSize: 16 | 32 = 16) {
  const { html } = parseMnemonic(item.label);
  const link = item.href && !item.disabled;
  const element = document.createElement(link ? "a" : "button");
  if (element instanceof HTMLAnchorElement) {
    element.href = item.href!;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
  } else element.type = "button";
  element.className = "WinMenuItem";
  if (item.default) element.classList.add("WinMenuItem--default");
  if (item.icon) element.classList.add("WinMenuItem--icon");
  element.tabIndex = -1;
  element.setAttribute(
    "role",
    item.check === "check"
      ? "menuitemcheckbox"
      : item.check === "radio"
        ? "menuitemradio"
        : "menuitem",
  );
  if (item.check) element.setAttribute("aria-checked", String(!!item.checked));
  if (item.disabled) element.setAttribute("aria-disabled", "true");
  if (item.submenu) {
    element.setAttribute("aria-haspopup", "menu");
    element.setAttribute("aria-expanded", "false");
  }
  const keys =
    item.keyshortcuts ??
    (item.shortcut && /^[\w+]+$/.test(item.shortcut) ? item.shortcut : "");
  if (keys) element.setAttribute("aria-keyshortcuts", keys);
  if (item.indent) element.style.setProperty("--menu-indent", `${item.indent}`);
  element.innerHTML = [
    item === BACK
      ? '<span class="WinMenuBack" aria-hidden="true"></span>'
      : item.icon
        ? windowsIcon(item.icon, iconSize)
        : `<span class="WinMenuCheck" aria-hidden="true">${item.glyph ? captionGlyph(item.glyph) : ""}</span>`,
    `<span class="WinMenuLabel">${html}`,
    item.href
      ? '<span aria-hidden="true"> ↗</span><span class="VisuallyHidden"> (opens in a new tab)</span>'
      : "",
    "</span>",
    item.shortcut
      ? `<span class="WinMenuShortcut" aria-hidden="true">${escape(item.shortcut)}</span>`
      : "",
    item.submenu ? '<span class="WinMenuArrow" aria-hidden="true"></span>' : "",
  ].join("");
  return element;
}

/** Opens a popup menu and returns its handle. */
export function openMenu(options: OpenMenuOptions): MenuHandle {
  const { anchor, parent, returnFocus } = options;
  const pushIn = !!options.pushIn;
  // A pushed-in cascade takes its parent's place until Back or Left.
  const pushedParent = pushIn && parent ? parent : undefined;
  const pushAlign =
    (options as ChildOptions).pushAlign ??
    (options.placement === "above" ? "bottom" : "top");
  const host =
    options.host ??
    parent?.element.parentElement ??
    anchor?.closest<HTMLElement>(".Win98") ??
    returnFocus?.closest<HTMLElement>(".Win98") ??
    document.body;
  const bounds =
    options.bounds ?? host.querySelector<HTMLElement>(".WinWorkspace") ?? host;
  const entries = resolve(options.items);
  const element = document.createElement("div");
  element.className = ["WinMenu", options.className].filter(Boolean).join(" ");
  element.id = `win-menu-${++menuCount}`;
  element.setAttribute("role", "menu");
  element.tabIndex = -1;
  if (pushIn) element.classList.add("WinMenu--push");
  if (options.label) element.setAttribute("aria-label", options.label);
  else if (anchor?.id) element.setAttribute("aria-labelledby", anchor.id);
  if (options.banner) {
    const banner = document.createElement("div");
    banner.className = "WinMenuBanner";
    banner.setAttribute("aria-hidden", "true");
    banner.innerHTML = options.banner;
    element.classList.add("WinMenu--banner");
    element.append(banner);
  }

  const listeners = new AbortController();
  const signal = listeners.signal;
  const items: { element: HTMLElement; item: MenuItem; key?: string }[] = [];
  const shown: MenuEntry[] = entries.length
    ? entries
    : [{ label: "(Empty)", disabled: true }];
  for (const entry of pushedParent ? [BACK, "-" as const, ...shown] : shown) {
    if (entry === "-") {
      const separator = document.createElement("div");
      separator.className = "WinMenuSeparator";
      separator.setAttribute("role", "separator");
      element.append(separator);
      continue;
    }
    const itemElement = renderItem(entry, options.iconSize);
    // Cascades take their accessible name from the item that opens them.
    itemElement.id = `${element.id}-${items.length}`;
    items.push({
      element: itemElement,
      item: entry,
      key: parseMnemonic(entry.label).key,
    });
    element.append(itemElement);
  }
  const elements = items.map(item => item.element);

  let closed = false;
  let child: MenuHandle | undefined;
  let childAnchor: HTMLElement | undefined;
  let hoverTimer: number | undefined;
  const root = (): MenuHandle => {
    let menu: MenuHandle = handle;
    while (menu.parent) menu = menu.parent;
    return menu;
  };
  // Only the root menu knows about its menu bar.
  const navigate = (direction: -1 | 1) => rootNavigate.get(root())?.(direction);

  const handle: MenuHandle = {
    element,
    parent,
    get closed() {
      return closed;
    },
    close(reason: MenuCloseReason = "programmatic") {
      if (closed) return;
      closed = true;
      listeners.abort();
      window.clearTimeout(hoverTimer);
      child?.close("parent");
      // Uncover the parent before focus returns to its item.
      if (pushedParent && !pushedParent.closed)
        pushedParent.element.hidden = false;
      if (!parent) {
        pressing = false;
        window.clearTimeout(pressTimer);
      }
      if (anchor?.hasAttribute("aria-haspopup")) {
        anchor.setAttribute("aria-expanded", "false");
        if (anchor.getAttribute("aria-controls") === element.id)
          anchor.removeAttribute("aria-controls");
      }
      const restore =
        reason === "escape" || reason === "tab" || reason === "action";
      if (restore && returnFocus?.isConnected)
        returnFocus.focus({ preventScroll: true });
      if (followingLink.has(root())) {
        // A link cannot navigate once disconnected: remove it afterwards.
        element.hidden = true;
        window.setTimeout(() => element.remove(), 0);
      } else element.remove();
      chains.delete(handle);
      options.onClose?.(reason);
    },
    focusItem(which) {
      const target = which === "first" ? elements[0] : elements.at(-1);
      target?.focus({ preventScroll: true });
    },
  };
  if (options.onNavigate) rootNavigate.set(handle, options.onNavigate);
  // Join the chain before taking focus, so the parent's focusout sees it.
  if (parent) openChild.set(parent, handle);
  else chains.add(handle);

  const inChain = (node: Node | null) => {
    if (!node) return false;
    for (let menu: MenuHandle | undefined = root(); menu;) {
      if (menu.element.contains(node)) return true;
      menu = openChild.get(menu);
    }
    return false;
  };
  const closeChild = () => {
    child?.close("parent");
    child = undefined;
    childAnchor = undefined;
    openChild.delete(handle);
  };
  function openSubmenu(
    itemElement: HTMLElement,
    item: MenuItem,
    focus: "first" | "none",
  ) {
    if (!item.submenu || !isEnabled(itemElement)) return;
    if (child && childAnchor === itemElement) {
      if (focus === "first") child.focusItem("first");
      return;
    }
    closeChild();
    itemElement.setAttribute("aria-expanded", "true");
    childAnchor = itemElement;
    const childOptions: ChildOptions = {
      items: item.submenu,
      anchor: itemElement,
      placement: "right",
      parent: handle,
      returnFocus: itemElement,
      // A pushed-in panel hides this one, so it must take the focus.
      focus: pushIn && focus === "none" ? "menu" : focus,
      host,
      bounds,
      ignore: options.ignore,
      className: options.submenuClassName ?? options.className,
      submenuClassName: options.submenuClassName,
      pushIn,
      pushAlign,
      onClose: () => {
        if (childAnchor === itemElement) {
          child = undefined;
          childAnchor = undefined;
          openChild.delete(handle);
        }
      },
    };
    child = openMenu(childOptions);
    if (pushIn) element.hidden = true;
  }
  function activate(
    itemElement: HTMLElement,
    item: MenuItem,
    via: "keyboard" | "pointer",
  ) {
    if (!isEnabled(itemElement)) return;
    if (item === BACK) {
      handle.close("escape");
      return;
    }
    if (item.submenu) {
      openSubmenu(itemElement, item, via === "keyboard" ? "first" : "none");
      return;
    }
    root().close("action");
    item.action?.();
  }

  element.addEventListener(
    "keydown",
    event => {
      // Leave Alt+F4, Ctrl+Esc and other chords to the desktop.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const index = elements.indexOf(document.activeElement as HTMLElement);
      const current = index >= 0 ? items[index] : undefined;
      const count = elements.length;
      const focusAt = (next: number) =>
        elements[(next + count) % count]?.focus({ preventScroll: true });
      switch (event.key) {
        case "ArrowDown":
          focusAt(index < 0 ? 0 : index + 1);
          break;
        case "ArrowUp":
          focusAt(index < 0 ? count - 1 : index - 1);
          break;
        case "Home":
        case "PageUp":
          focusAt(0);
          break;
        case "End":
        case "PageDown":
          focusAt(count - 1);
          break;
        case "ArrowRight":
          if (current?.item.submenu && isEnabled(current.element))
            openSubmenu(current.element, current.item, "first");
          else navigate(1);
          break;
        case "ArrowLeft":
          if (parent) handle.close("escape");
          else navigate(-1);
          break;
        case "Enter":
        case " ":
          if (!current) break;
          if (current.element instanceof HTMLAnchorElement) {
            if (isEnabled(current.element)) current.element.click();
          } else activate(current.element, current.item, "keyboard");
          break;
        case "Escape":
          // A cascade opened by hovering leaves the keyboard here: Esc
          // closes it first, then this menu, one level at a time.
          if (child && !child.closed) closeChild();
          else handle.close("escape");
          break;
        case "Tab":
          // Let the browser continue from the element the chain returns to.
          root().close("tab");
          event.stopPropagation();
          return;
        default: {
          const letter = event.key.length === 1 ? event.key.toLowerCase() : "";
          if (!letter.trim()) return;
          const enabled = items.filter(item => isEnabled(item.element));
          const matches = mnemonicMatches(
            enabled.map(item => item.element),
            enabled.map(item => item.key),
            letter,
          );
          if (!matches.length) return;
          if (matches.length === 1) {
            const match = items[elements.indexOf(matches[0])];
            match.element.focus({ preventScroll: true });
            if (match.element instanceof HTMLAnchorElement)
              match.element.click();
            else activate(match.element, match.item, "keyboard");
          } else {
            const after = matches.find(
              match => elements.indexOf(match) > index,
            );
            (after ?? matches[0]).focus({ preventScroll: true });
          }
        }
      }
      event.preventDefault();
      event.stopPropagation();
    },
    { signal },
  );
  element.addEventListener(
    "click",
    event => {
      const itemElement = (event.target as Element).closest<HTMLElement>(
        ".WinMenuItem",
      );
      const index = itemElement ? elements.indexOf(itemElement) : -1;
      if (index < 0) return;
      const { item } = items[index];
      if (!isEnabled(itemElement!)) {
        event.preventDefault();
        return;
      }
      if (itemElement instanceof HTMLAnchorElement) {
        // Keep the default action: the browser opens the link in a new tab.
        followingLink.add(root());
        root().close("action");
        return;
      }
      activate(itemElement!, item, event.detail === 0 ? "keyboard" : "pointer");
    },
    { signal },
  );
  // Keep focus inside the chain (Safari would move it to the desktop on
  // mousedown); click still fires.
  element.addEventListener(
    "pointerdown",
    event => {
      event.preventDefault();
      pressing = true;
      window.clearTimeout(pressTimer);
    },
    { signal },
  );
  cancelHover.set(handle, () => window.clearTimeout(hoverTimer));
  // Reaching the submenu keeps it open, even across other parent items.
  if (parent)
    element.addEventListener(
      "pointerenter",
      () => cancelHover.get(parent)?.(),
      { signal },
    );
  for (const { element: itemElement, item } of items)
    itemElement.addEventListener(
      "pointerenter",
      () => {
        if (document.activeElement !== itemElement)
          itemElement.focus({ preventScroll: true });
        window.clearTimeout(hoverTimer);
        // Pushed-in panels open on click, Enter or Right only.
        if (childAnchor === itemElement || pushIn) return;
        hoverTimer = window.setTimeout(() => {
          if (closed) return;
          if (item.submenu) openSubmenu(itemElement, item, "none");
          else closeChild();
        }, MENU_HOVER_DELAY);
      },
      { signal },
    );
  element.addEventListener(
    "focusout",
    event => {
      const next = event.relatedTarget as Node | null;
      if (pressing) return;
      if (inChain(next) || (next && options.ignore?.contains(next))) return;
      // Focus left the whole chain: close everything without moving focus.
      root().close("blur");
    },
    { signal },
  );
  if (!parent) {
    document.addEventListener(
      "pointerdown",
      event => {
        const target = event.target as Node;
        if (inChain(target) || options.ignore?.contains(target)) return;
        if (anchor?.contains(target)) return;
        handle.close("outside");
      },
      { capture: true, signal },
    );
    // The press ends with its click, or soon after release without one.
    document.addEventListener(
      "pointerup",
      () => {
        window.clearTimeout(pressTimer);
        pressTimer = window.setTimeout(() => (pressing = false), 500);
      },
      { capture: true, signal },
    );
    for (const type of ["pointercancel", "click"])
      document.addEventListener(type, () => (pressing = false), {
        capture: true,
        signal,
      });
  }

  if (anchor?.hasAttribute("aria-haspopup")) {
    anchor.setAttribute("aria-expanded", "true");
    anchor.setAttribute("aria-controls", element.id);
  }
  if (options.after) options.after.after(element);
  else host.append(element);
  position(element, host, bounds, {
    ...options,
    placement: pushedParent ? "replace" : options.placement,
    pushAlign,
  });
  const focus = options.focus ?? "first";
  if (focus === "first" || focus === "last") handle.focusItem(focus);
  else if (focus === "menu") element.focus({ preventScroll: true });
  return handle;
}

/** Closes every open menu chain, e.g. when a modal dialog opens. */
export function closeMenus(reason: MenuCloseReason = "programmatic") {
  for (const menu of chains) menu.close(reason);
}

/** Places a menu inside its bounds, flipping left or up when needed. */
function position(
  element: HTMLElement,
  host: HTMLElement,
  boundsElement: HTMLElement,
  {
    anchor,
    point,
    placement,
    parent,
    pushAlign,
  }: Omit<OpenMenuOptions, "placement"> & {
    placement?: OpenMenuOptions["placement"] | "replace";
    pushAlign: "top" | "bottom";
  },
) {
  const origin = host.getBoundingClientRect();
  const area = boundsElement.getBoundingClientRect();
  // A pushed-in panel covers its parent: at least as wide, same corner.
  const covered =
    placement === "replace" ? parent?.element.getBoundingClientRect() : null;
  if (covered) element.style.minWidth = `${covered.width}px`;
  if (element.offsetHeight > area.height && area.height > 0) {
    element.style.maxHeight = `${area.height}px`;
    element.style.overflowY = "auto";
  }
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  let x = point?.x ?? area.left;
  let y = point?.y ?? area.top;
  if (covered) {
    x = covered.left;
    y = pushAlign === "bottom" ? covered.bottom - height : covered.top;
  } else if (point) {
    if (x + width > area.right) x -= width;
    if (y + height > area.bottom) y -= height;
  } else if (anchor) {
    const rect = anchor.getBoundingClientRect();
    if (placement === "right") {
      // The first item lines up with its parent; the panel overlaps its edge.
      x = rect.right;
      y = rect.top - 3;
      if (x + width > area.right) x = rect.left - width;
      if (y + height > area.bottom) y = rect.bottom + 3 - height;
    } else if (placement === "above") {
      x = rect.left;
      y = rect.top - height;
      if (y < area.top) y = rect.bottom;
    } else {
      x = rect.left;
      y = rect.bottom;
      if (y + height > area.bottom) y = rect.top - height;
      if (x + width > area.right) x = rect.right - width;
    }
  }
  x = clamp(x, area.left, area.right - width);
  y = clamp(y, area.top, area.bottom - height);
  element.style.left = `${Math.round(x - origin.left)}px`;
  element.style.top = `${Math.round(y - origin.top)}px`;
}

export type MenuBarMenu = { label: string; items: MenuItems };

/**
 * Turns host into a menu bar with a single Tab stop. Left/Right move, Down,
 * Enter or Space open. F10 focuses the bar; Alt+Shift+mnemonic opens a menu
 * from anywhere in scope (browsers keep Alt+F and Alt+E for themselves).
 */
export function menuBar(
  host: HTMLElement,
  menus: MenuBarMenu[],
  options: { label?: string; scope?: HTMLElement; signal?: AbortSignal } = {},
) {
  const abort = new AbortController();
  options.signal?.addEventListener("abort", () => dispose(), { once: true });
  const signal = abort.signal;
  const barId = `win-menubar-${++menuCount}`;
  host.classList.add("WinMenuBar");
  host.setAttribute("role", "menubar");
  if (options.label) host.setAttribute("aria-label", options.label);
  host.innerHTML = menus
    .map(
      (menu, index) =>
        `<button type="button" class="WinMenuBarItem" id="${barId}-${index}" role="menuitem" aria-haspopup="menu" aria-expanded="false" tabindex="${index ? -1 : 0}">${parseMnemonic(menu.label).html}</button>`,
    )
    .join("");
  const items = [
    ...host.querySelectorAll<HTMLButtonElement>(".WinMenuBarItem"),
  ];
  const keys = menus.map(menu => parseMnemonic(menu.label).key);
  const scope =
    options.scope ??
    host.closest<HTMLElement>("[data-window]") ??
    host.parentElement ??
    host;
  let open: MenuHandle | undefined;
  let openIndex = -1;
  /** The open menu came from hot tracking, not from a click on its title. */
  let hotTracked = false;
  /** At the press on a title: whether its click should close its menu. */
  let pressed: { index: number; close: boolean } | undefined;
  let previousFocus: HTMLElement | undefined;
  const wrap = (index: number) => (index + items.length) % items.length;

  function rememberFocus() {
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused !== document.body &&
      !host.contains(focused) &&
      !focused.closest(".WinMenu")
    )
      previousFocus = focused;
  }
  function setRoving(index: number) {
    items.forEach((item, position) => {
      item.tabIndex = position === index ? 0 : -1;
    });
  }
  function focusItem(index: number) {
    setRoving(index);
    items[index].focus({ preventScroll: true });
  }
  function returnToContent() {
    const target = previousFocus;
    previousFocus = undefined;
    if (target?.isConnected && !target.closest("[inert]"))
      target.focus({ preventScroll: true });
  }
  function closeOpen(reason: MenuCloseReason = "programmatic") {
    open?.close(reason);
  }
  function openAt(index: number, focus: "first" | "last" | "menu") {
    if (open && openIndex === index) {
      if (focus !== "menu") open.focusItem(focus);
      return;
    }
    closeOpen("navigate");
    setRoving(index);
    openIndex = index;
    hotTracked = false;
    const menu: MenuHandle = openMenu({
      items: menus[index].items,
      anchor: items[index],
      placement: "below",
      returnFocus: items[index],
      focus,
      ignore: host,
      onNavigate: direction => openAt(wrap(index + direction), "first"),
      onClose: reason => {
        if (open === menu) {
          open = undefined;
          openIndex = -1;
        }
        if (reason === "action") returnToContent();
      },
    });
    open = menu;
  }

  host.addEventListener(
    "focusin",
    event => {
      const from = event.relatedTarget;
      if (
        from instanceof HTMLElement &&
        !host.contains(from) &&
        !from.closest(".WinMenu")
      )
        previousFocus = from;
    },
    { signal },
  );
  /** The press's click closes the menu only if it was open before it. */
  const closesOnClick = (index: number) =>
    !!open && openIndex === index && !hotTracked;
  /**
   * Closes the bar's menu from its title and leaves the menu bar: the
   * keyboard goes back to the content (or the window), never to the page.
   */
  function toggleClosed(index: number) {
    closeOpen("programmatic");
    returnToContent();
    const focused = document.activeElement;
    if (focused && focused !== document.body) return;
    // Nothing to return to: the window itself, or else the title.
    (scope.matches("[data-window]") ? scope : items[index]).focus({
      preventScroll: true,
    });
  }
  host.addEventListener(
    "pointerdown",
    event => {
      const item = (event.target as Element).closest<HTMLButtonElement>(
        ".WinMenuBarItem",
      );
      if (!item) return;
      // Menus opened with the mouse leave keyboard focus on the panel.
      event.preventDefault();
      rememberFocus();
      const index = items.indexOf(item);
      pressed = { index, close: closesOnClick(index) };
      // A menu hot tracking opened is now the clicked one: the next click
      // on its title closes it.
      hotTracked = false;
    },
    { signal },
  );
  host.addEventListener(
    "click",
    event => {
      const item = (event.target as Element).closest<HTMLButtonElement>(
        ".WinMenuBarItem",
      );
      const index = item ? items.indexOf(item) : -1;
      if (index < 0) return;
      // A keyboard click toggles; a pointer click closes the menu only if
      // it was open before the press (hovering may have just opened it).
      const close =
        event.detail === 0
          ? !!open && openIndex === index
          : pressed?.index === index
            ? pressed.close
            : closesOnClick(index);
      pressed = undefined;
      if (close) toggleClosed(index);
      else openAt(index, event.detail === 0 ? "first" : "menu");
    },
    { signal },
  );
  for (const [index, item] of items.entries())
    item.addEventListener(
      "pointerenter",
      () => {
        // Hot tracking: with a menu open, moving across the bar switches menus.
        if (open && openIndex !== index) {
          openAt(index, "menu");
          hotTracked = true;
        }
      },
      { signal },
    );
  host.addEventListener(
    "keydown",
    event => {
      const index = items.indexOf(event.target as HTMLButtonElement);
      if (index < 0 || event.ctrlKey || event.metaKey || event.altKey) return;
      switch (event.key) {
        case "ArrowRight":
          focusItem(wrap(index + 1));
          break;
        case "ArrowLeft":
          focusItem(wrap(index - 1));
          break;
        case "Home":
          focusItem(0);
          break;
        case "End":
          focusItem(items.length - 1);
          break;
        case "ArrowDown":
        case "Enter":
        case " ":
          openAt(index, "first");
          break;
        case "ArrowUp":
          openAt(index, "last");
          break;
        case "Escape":
        case "F10":
          returnToContent();
          break;
        default: {
          const letter = event.key.length === 1 ? event.key.toLowerCase() : "";
          const match = letter.trim()
            ? mnemonicMatches(items, keys, letter)[0]
            : undefined;
          if (!match) return;
          openAt(items.indexOf(match), "first");
        }
      }
      event.preventDefault();
      event.stopPropagation();
    },
    { signal },
  );
  scope.addEventListener(
    "keydown",
    event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      if (
        event.key === "F10" &&
        !event.altKey &&
        !event.shiftKey &&
        !host.contains(event.target as Node)
      ) {
        event.preventDefault();
        rememberFocus();
        // F10 always highlights the first menu, as in Windows 98.
        focusItem(0);
        return;
      }
      openByAccelerator(event);
    },
    { signal },
  );
  /** Alt+Shift+mnemonic opens a menu; true when it did. */
  function openByAccelerator(event: KeyboardEvent) {
    const letter = /^Key([A-Z])$/.exec(event.code)?.[1].toLowerCase();
    if (!event.altKey || !event.shiftKey || !letter) return false;
    const index = keys.indexOf(letter);
    if (index < 0) return false;
    event.preventDefault();
    event.stopPropagation();
    rememberFocus();
    openAt(index, "first");
    return true;
  }
  // Open menus live on the desktop, outside scope: the accelerators work
  // from inside them too, switching to another menu of this bar.
  document.addEventListener(
    "keydown",
    event => {
      if (
        !open ||
        open.closed ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        !(event.target instanceof Element) ||
        !event.target.closest(".WinMenu")
      )
        return;
      openByAccelerator(event);
    },
    { signal },
  );

  function dispose() {
    closeOpen("programmatic");
    abort.abort();
  }
  return {
    element: host,
    items,
    get openMenu() {
      return open;
    },
    /** Focuses the bar's first menu, as F10 does. */
    focus() {
      rememberFocus();
      focusItem(0);
    },
    close: () => closeOpen("programmatic"),
    dispose,
  };
}
