import { findProject } from "../../data/projects";
import { windowsIcon } from "../../data/windows-icons";
import {
  LIST_ITEM,
  LIST_VIEW,
  listItems,
  selectItem,
  tabStop,
} from "./list-view";
import { closeMenus, openMenu, type MenuEntry } from "./menu";
import { isModalOpen, messageBox } from "./message-box";
import { itemInfo, itemProperties } from "./properties";
import { prefersPushIn, type ToggleSetting } from "./start-menu";
import {
  PHONE_WIDTH,
  type DesktopWindow,
  type WindowManager,
} from "./window-manager";

/** A touch (or pen) press held this long opens the shortcut menu. */
export const LONG_PRESS_DELAY = 500;
/** Moving the pointer further than this cancels a long press. */
export const LONG_PRESS_SLOP = 8;
/** The click a long press may still produce arrives within this time. */
const LONG_PRESS_CLICK = 500;

/** Desktop icons that Arrange Icons keeps first, in this order. */
const SYSTEM_ICONS = ["computer", "folder:projects", "recycle"];

type Point = { x: number; y: number };

/** What a right-click, Shift+F10 or long press on an element opens. */
type Request =
  | { kind: "system"; win: DesktopWindow; anchor?: HTMLElement }
  | {
      kind: "menu";
      items: () => MenuEntry[];
      label: string;
      returnFocus: HTMLElement | null;
      /** Runs before the menu opens, e.g. to select the item. */
      prepare?: () => void;
    };

export type DisplaySettings = {
  animations: ToggleSetting;
  /** The CRT picture; offered once the CRT track wires it. */
  displayEffects?: ToggleSetting;
};

/**
 * Shortcut menus for the desktop, its icons, the taskbar and windows. They
 * open on a right-click, Shift+F10 or the Menu key, and a touch or pen long
 * press. Links, text fields and demos keep the browser's own menu.
 */
export function createContextMenus({
  root,
  wm,
  icons,
  signal,
  open,
  run,
  settings,
}: {
  root: HTMLElement;
  wm: WindowManager;
  /** The desktop icon list. */
  icons: HTMLElement;
  signal: AbortSignal;
  /** Opens a list item, as a double-click does. */
  open: (item: HTMLElement) => void;
  /** Runs a desktop command, such as "folder:projects" or "find". */
  run: (action: string) => void;
  settings: DisplaySettings;
}) {
  const workspace = root.querySelector<HTMLElement>(".WinWorkspace")!;
  /** When a key last opened a menu: the browser's own event may follow. */
  let keyboardMenuAt = -Infinity;
  /** A touch or pen press that may become a long press. */
  let press:
    | {
        pointer: number;
        x: number;
        y: number;
        target: Element;
        timer: number;
        /** The press opened a menu: its click must not open the item. */
        opened: boolean;
      }
    | undefined;
  let swallowClickUntil = -Infinity;

  const modalOpen = () => isModalOpen(root);
  const windowOf = (element: Element) => {
    const frame = element.closest<HTMLElement>("[data-window]");
    return frame && root.contains(frame)
      ? wm.windows.get(frame.dataset.window!)
      : undefined;
  };

  function iconItems(item: HTMLElement): MenuEntry[] {
    const action = item.dataset.winAction ?? "";
    const name = item.dataset.name;
    const project = action.startsWith("project:")
      ? findProject(action.slice(8))
      : undefined;
    const place =
      action.startsWith("folder:") ||
      action === "computer" ||
      action === "recycle";
    const entries: MenuEntry[] = [
      { label: "&Open", default: true, action: () => open(item) },
    ];
    if (place) entries.push({ label: "&Explore", action: () => open(item) });
    if (project?.demo)
      entries.push({ label: "Open in &New Tab", href: project.demo });
    if (project) entries.push({ label: "&Source Code", href: project.source });
    if (action === "recycle")
      entries.push({ label: "Empty Recycle &Bin", disabled: true });
    if (itemInfo(action, name))
      entries.push("-", {
        label: "P&roperties",
        action: () => itemProperties(action, name),
      });
    return entries;
  }

  /** Desktop ▸ Arrange Icons: system icons first, then by name or type. */
  function arrangeDesktop(by: "name" | "type") {
    const focused = document.activeElement;
    const items = listItems(icons);
    const system = SYSTEM_ICONS.map(action =>
      items.find(item => item.dataset.winAction === action),
    ).filter(item => item !== undefined);
    const name = (item: HTMLElement) => item.dataset.name ?? "";
    const type = (item: HTMLElement) =>
      itemInfo(item.dataset.winAction ?? "", item.dataset.name)?.type ?? "";
    const compare = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: "base" });
    const rest = items
      .filter(item => !system.includes(item))
      .sort(
        (a, b) =>
          (by === "type" ? compare(type(a), type(b)) : 0) ||
          compare(name(a), name(b)),
      );
    icons.append(...system, ...rest);
    // Moving a focused icon drops its focus.
    if (focused instanceof HTMLElement && icons.contains(focused))
      focused.focus({ preventScroll: true });
  }

  /** Desktop ▸ Properties: Display Properties with the display settings. */
  function displayProperties() {
    const body = document.createElement("div");
    body.className = "WinDisplayProperties";
    const options: [string, string, ToggleSetting][] = [
      ["animations", "Animations", settings.animations],
    ];
    if (settings.displayEffects)
      options.push([
        "effects",
        "Display effects (CRT picture)",
        settings.displayEffects,
      ]);
    // High contrast keeps the CRT effects off: shown off, unavailable.
    const forced = options.map(([, , setting]) => !!setting.forcedOff?.());
    body.innerHTML = `<div class="WinMonitor" aria-hidden="true"><div class="WinMonitorScreen">${windowsIcon("computer", 16)}</div></div><fieldset class="WinGroup"><legend>Visual effects</legend>${options
      .map(
        ([name, label, setting], index) =>
          `<label class="WinCheck"><input type="checkbox" name="${name}"${forced[index] ? " disabled" : setting.get() ? " checked" : ""}><span>${label}${forced[index] ? " (off in high contrast)" : ""}</span></label>`,
      )
      .join("")}</fieldset>`;
    const boxes = options.map(([name]) =>
      body.querySelector<HTMLInputElement>(`[name="${name}"]`)!,
    );
    const changed = (index: number) =>
      !forced[index] && options[index][2].get() !== boxes[index].checked;
    const apply = () =>
      options.forEach(([, , setting], index) => {
        if (changed(index)) setting.set(boxes[index].checked);
      });
    const result = messageBox({
      title: "Display Properties",
      body,
      role: "dialog",
      layout: { sheet: "Effects" },
      buttons: [
        { id: "ok", label: "OK", default: true },
        { id: "cancel", label: "Cancel", cancel: true },
        { id: "apply", label: "Apply" },
      ],
      initialFocus: boxes[0],
      onButton: id => {
        if (id === "cancel") return;
        apply();
        applyButton.disabled = true;
        return id !== "apply";
      },
    });
    // Apply is available once something changed, as in Windows.
    const applyButton = body
      .closest(".WinMessageBox")!
      .querySelector<HTMLButtonElement>('[data-message-button="apply"]')!;
    applyButton.disabled = true;
    body.addEventListener("change", () => {
      applyButton.disabled = !options.some((_, index) => changed(index));
    });
    return result;
  }

  const desktopItems = (): MenuEntry[] => [
    {
      label: "Arrange &Icons",
      submenu: [
        { label: "by &Name", action: () => arrangeDesktop("name") },
        { label: "by &Type", action: () => arrangeDesktop("type") },
        "-",
        // The desktop always keeps its icons on the grid.
        {
          label: "&Auto Arrange",
          check: "check",
          checked: true,
          disabled: true,
        },
      ],
    },
    { label: "Line &Up Icons", disabled: true },
    "-",
    { label: "R&efresh", action: refreshDesktop },
    "-",
    { label: "P&roperties", action: () => void displayProperties() },
  ];
  /** Refresh: redraws the icons in their current order. */
  function refreshDesktop() {
    const focused = document.activeElement;
    icons.append(...listItems(icons));
    if (focused instanceof HTMLElement && icons.contains(focused))
      focused.focus({ preventScroll: true });
  }

  /** Start's own menu: its folder, explored, and Find. */
  const startItems = (): MenuEntry[] => [
    { label: "&Open", default: true, action: () => run("folder:projects") },
    { label: "&Explore", action: () => run("computer") },
    { label: "&Find…", action: () => run("find") },
  ];

  const taskbarItems = (): MenuEntry[] => {
    const none = ![...wm.windows.values()].some(win => !win.element.hidden);
    // On phones every window fills the screen: there is nothing to arrange.
    const fixed = none || workspace.clientWidth <= PHONE_WIDTH;
    return [
      {
        label: "&Cascade Windows",
        disabled: fixed,
        action: () => wm.cascadeWindows(),
      },
      {
        label: "Tile Windows &Horizontally",
        disabled: fixed,
        action: () => wm.tileWindows("horizontal"),
      },
      {
        label: "Tile Windows &Vertically",
        disabled: fixed,
        action: () => wm.tileWindows("vertical"),
      },
      "-",
      {
        label: "&Minimize All Windows",
        disabled: none,
        action: () => wm.minimizeAll(),
      },
      ...(wm.canUndoMinimizeAll
        ? [
            {
              label: "&Undo Minimize All",
              action: () => void wm.undoMinimizeAll(),
            } satisfies MenuEntry,
          ]
        : []),
    ];
  };

  /**
   * What a shortcut menu on target shows: a request, null for chrome that
   * has no menu (the browser's is suppressed), or undefined to keep the
   * browser's own menu.
   */
  function requestFor(target: Element): Request | null | undefined {
    if (!root.contains(target)) return undefined;
    // Text fields, links and demos keep the browser's own menu.
    if (target.closest("a[href], input, textarea, select, iframe")) return;
    // A modal box (or Stand by) blocks the shell: no menu opens through it.
    if (
      modalOpen() ||
      target.closest(".WinMenu, .WinModal, .WinStandby, .WinDither")
    )
      return null;
    const task = target.closest<HTMLElement>(".WinTask");
    if (task) {
      const win = [...wm.windows.values()].find(each => each.task === task);
      return win ? { kind: "system", win, anchor: task } : null;
    }
    const start = target.closest<HTMLElement>(".WinStart");
    if (start)
      return {
        kind: "menu",
        items: startItems,
        label: "Start",
        returnFocus: start,
      };
    if (target.closest(".WinTaskbar"))
      return {
        kind: "menu",
        items: taskbarItems,
        label: "Taskbar",
        returnFocus: null,
      };
    const win = windowOf(target);
    if (win && (target === win.element || target.closest(".WinTitlebar")))
      return { kind: "system", win };
    const item = target.closest<HTMLElement>(LIST_ITEM);
    const list = item?.closest<HTMLElement>(LIST_VIEW);
    if (item && list)
      return {
        kind: "menu",
        items: () => iconItems(item),
        label: item.dataset.name ?? "Item",
        returnFocus: item,
        prepare: () => {
          if (item.getAttribute("aria-selected") !== "true")
            selectItem(list, item);
        },
      };
    if (win) {
      const items = win.backgroundMenu?.(target);
      if (items)
        return {
          kind: "menu",
          items: () => win.backgroundMenu?.(target) ?? items,
          label: win.title.textContent ?? "Window",
          returnFocus: (() => {
            const list = target.closest<HTMLElement>(LIST_VIEW);
            return list ? tabStop(list) : wm.focusTarget(win);
          })(),
        };
      // Window chrome has no menu; content keeps the browser's (Copy).
      return target.closest(
        ".WinMenuBar, .WinRebar, .WinStatus, .WinSizeGrip, .WinResize",
      )
        ? null
        : undefined;
    }
    if (target === root || target.closest(".WinWorkspace"))
      return {
        kind: "menu",
        items: desktopItems,
        label: "Desktop",
        returnFocus: tabStop(icons),
      };
    return undefined;
  }

  /** Where a keyboard-opened menu appears: at the item's label. */
  function keyboardPoint(element: Element): Point {
    const label = element.matches(LIST_ITEM)
      ? (element.querySelector(":scope > span, .WinDetailsName > span") ??
        element)
      : element;
    const rect = label.getBoundingClientRect();
    return element.matches(LIST_ITEM)
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: rect.left + 4, y: rect.top + 4 };
  }

  function show(request: Request, point: Point, keyboard: boolean) {
    closeMenus("programmatic");
    if (request.kind === "system") {
      const { win, anchor } = request;
      wm.openSystemMenu(win, {
        anchor: anchor ?? (keyboard ? win.sysMenu : undefined),
        point: anchor || keyboard ? undefined : point,
        keyboard,
        returnFocus: anchor ?? wm.focusTarget(win),
      });
      return;
    }
    // Focus returns to what had it, unless a minimized window hides it.
    const before = document.activeElement;
    const usable =
      before instanceof HTMLElement &&
      root.contains(before) &&
      !before.closest("[hidden], [inert]");
    request.prepare?.();
    openMenu({
      items: request.items,
      point,
      label: request.label,
      host: root,
      returnFocus:
        request.returnFocus ??
        (usable ? before : root.querySelector<HTMLElement>(".WinStart")),
      focus: keyboard ? "first" : "menu",
      className: "WinContextMenu",
      pushIn: prefersPushIn(workspace),
    });
  }

  function cancelPress() {
    if (press) window.clearTimeout(press.timer);
    press = undefined;
  }

  root.addEventListener(
    "contextmenu",
    event => {
      const target = event.target as Element;
      const request = requestFor(target);
      if (request === undefined) return;
      event.preventDefault();
      if (!request) return;
      const fromKeyboard =
        (!event.clientX && !event.clientY) ||
        (event.button === 0 && !(event as PointerEvent).pointerType);
      // The browser's own event for a key that opened a menu already.
      if (fromKeyboard && performance.now() - keyboardMenuAt < 500) return;
      // A touch long press: whichever of the browser and the timer sees it
      // first opens the menu, once.
      if (press) {
        if (press.opened) return;
        window.clearTimeout(press.timer);
        press.opened = true;
      }
      show(
        request,
        fromKeyboard
          ? keyboardPoint(target)
          : { x: event.clientX, y: event.clientY },
        fromKeyboard,
      );
    },
    { signal },
  );

  // Shift+F10 and the Menu key open the focused element's menu.
  root.addEventListener(
    "keydown",
    event => {
      const menuKey =
        event.key === "ContextMenu" ||
        (event.key === "F10" && event.shiftKey && !event.altKey);
      if (!menuKey || event.ctrlKey || event.metaKey || event.defaultPrevented)
        return;
      const target = event.target as Element;
      const request = requestFor(target);
      if (request === undefined) return;
      event.preventDefault();
      if (!request) return;
      keyboardMenuAt = performance.now();
      show(request, keyboardPoint(target), true);
    },
    { signal },
  );

  // A touch or pen long press: 500 ms without moving more than 8 px.
  root.addEventListener(
    "pointerdown",
    event => {
      cancelPress();
      if (
        (event.pointerType !== "touch" && event.pointerType !== "pen") ||
        !event.isPrimary
      )
        return;
      const target = event.target as Element;
      if (!requestFor(target)) return;
      const state = {
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        target,
        opened: false,
        timer: 0,
      };
      state.timer = window.setTimeout(() => {
        if (press !== state || !state.target.isConnected) return;
        const request = requestFor(state.target);
        if (!request) return;
        state.opened = true;
        show(request, { x: state.x, y: state.y }, false);
      }, LONG_PRESS_DELAY);
      press = state;
    },
    { capture: true, signal },
  );
  root.addEventListener(
    "pointermove",
    event => {
      if (!press || event.pointerId !== press.pointer || press.opened) return;
      if (
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >
        LONG_PRESS_SLOP
      )
        cancelPress();
    },
    { capture: true, signal },
  );
  for (const type of ["pointerup", "pointercancel"])
    document.addEventListener(
      type,
      event => {
        if (!press || (event as PointerEvent).pointerId !== press.pointer)
          return;
        if (press.opened && type === "pointerup")
          swallowClickUntil = performance.now() + LONG_PRESS_CLICK;
        cancelPress();
      },
      { capture: true, signal },
    );
  // Scrolling a list or the desktop is not a long press.
  root.addEventListener("scroll", () => cancelPress(), {
    capture: true,
    signal,
  });
  // The tap that ends a long press must not open the item under it. Some
  // browsers press it first with a compatibility mousedown, which must not
  // take the keyboard out of the menu the long press opened.
  document.addEventListener(
    "mousedown",
    event => {
      if (performance.now() < swallowClickUntil) event.preventDefault();
    },
    { capture: true, signal },
  );
  document.addEventListener(
    "click",
    event => {
      if (performance.now() >= swallowClickUntil) return;
      swallowClickUntil = -Infinity;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true, signal },
  );

  return {
    /** Opens the shortcut menu of target, as Shift+F10 does. */
    openFor(target: Element) {
      const request = requestFor(target);
      if (!request) return false;
      show(request, keyboardPoint(target), true);
      return true;
    },
    arrangeDesktop,
    displayProperties,
  };
}
