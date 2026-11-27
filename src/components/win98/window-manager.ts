import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import type { ListViewMode } from "./list-view";
import {
  openMenu,
  type MenuEntry,
  type MenuHandle,
  type OpenMenuOptions,
} from "./menu";
import { captionGlyph, frameScheduler, pressPairs } from "./shared";
import type { Taskbar } from "./taskbar";

export type DesktopWindow = {
  id: string;
  element: HTMLElement;
  body: HTMLElement;
  task: HTMLButtonElement;
  title: HTMLElement;
  status: HTMLElement;
  maximize: HTMLButtonElement;
  /** The title-bar icon: the system menu's button. */
  sysMenu: HTMLButtonElement;
  /** Logical position in workspace px; layout is never read back into it. */
  x: number;
  y: number;
  /** Optional logical size in workspace px; CSS sizes the window otherwise. */
  w?: number;
  h?: number;
  /** The smallest size the user can resize the window to. */
  minWidth: number;
  minHeight: number;
  /** The user resized the window, so programs no longer size it. */
  resized?: boolean;
  /** A demo iframe, and its origin for postMessage checks. */
  frame?: HTMLIFrameElement;
  demoOrigin?: string;
  /** A game that receives keyboard focus whenever its window activates. */
  gameFrame?: HTMLIFrameElement;
  /** Ctrl+Alt released the game's keyboard; activation keeps focus outside. */
  keyboardReleased?: boolean;
  /** The control that last had the keyboard; activation returns to it. */
  lastFocus?: HTMLElement;
  /** Where the keyboard goes when lastFocus is gone (a pane, a field). */
  defaultFocus?: () => HTMLElement | undefined;
  /** Explorer's (or Find's) view of its file pane. */
  view?: ListViewMode;
  /**
   * Shortcut-menu items for a right-click on the window's own background,
   * such as an Explorer pane's empty space; undefined when target has none.
   */
  backgroundMenu?: (target: Element) => MenuEntry[] | undefined;
  dispose?: () => void;
};

export type WindowOptions = {
  /** An initial logical size; CSS sizes the window otherwise. */
  w?: number;
  h?: number;
  minWidth?: number;
  minHeight?: number;
  /** Extra classes on the window frame. */
  className?: string;
};

/** Edges a resize handle moves: n, s, e, w or a corner such as se. */
type Edges = string;
/** Resize handles: four edges and four corners, straddling the frame. */
const RESIZE_EDGES = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
const RESIZE_HANDLES = RESIZE_EDGES.map(
  edges =>
    `<div class="WinResize WinResize--${edges}" data-resize="${edges}" aria-hidden="true"></div>`,
).join("");
/** Smallest window, unless a program asks for more. */
export const MIN_WIDTH = 240;
export const MIN_HEIGHT = 140;

/** Caption buttons and the system-menu icon: never the window's keyboard home. */
const CAPTION_CONTROL = ".WinWindowControls button, .WinSysMenu";
/**
 * Controls that a mouse or pen press must not take the keyboard to, as in
 * Windows 98: the caption buttons and Explorer's tool buttons. The press
 * still shows them pushed (:active) and the click still runs them.
 */
const NO_POINTER_FOCUS = `${CAPTION_CONTROL}, .WinToolButton`;

/** CSS owns window placement at and below this workspace width. */
export const PHONE_WIDTH = 540;
/** Cascade step: roughly one caption height, as in Windows 98. */
export const CASCADE_STEP = 22;
/** Gap between the desktop icon columns and the cascade origin. */
export const DESKTOP_MARGIN = 8;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export type WindowManager = ReturnType<typeof createWindowManager>;

export function createWindowManager({
  root,
  workspace,
  layer,
  icons,
  taskbar,
  onNoWindow,
}: {
  root: HTMLElement;
  workspace: HTMLElement;
  layer: HTMLElement;
  /** The desktop icon grid; new windows cascade to its right. */
  icons: HTMLElement;
  taskbar: Taskbar;
  /** Called when closing or minimizing leaves no visible window. */
  onNoWindow: () => void;
}) {
  const windows = new Map<string, DesktopWindow>();
  let active: string | undefined;
  let zIndex = 0;
  let cascade = 0;
  /**
   * What Show Desktop hid, bottom to top, and the window that was active.
   * Opening or activating any window forgets it.
   */
  let hiddenByShowDesktop: { ids: string[]; active?: string } | undefined;
  /** A title-bar move, or a resize when edges is set. */
  let drag:
    | {
        win: DesktopWindow;
        x: number;
        y: number;
        left: number;
        top: number;
        width: number;
        height: number;
        pointer: number;
        handle: HTMLElement;
        /** Client pixels per workspace pixel (the CRT may scale the desktop). */
        scale: number;
        edges?: Edges;
      }
    | undefined;
  /** The open system menu and its window. */
  let systemMenu: { win: DesktopWindow; handle: MenuHandle } | undefined;
  const dragFrame = frameScheduler();
  /**
   * Windows opened while CSS owned the layout (phones) take their place once
   * the workspace is wide, e.g. after rotating to landscape.
   */
  const unplaced = new Map<DesktopWindow, "first" | "cascade">();
  const abort = new AbortController();
  const isPhone = () => workspace.clientWidth <= PHONE_WIDTH;
  const isMaximized = (win: DesktopWindow) =>
    win.element.classList.contains("WinWindow--maximized");

  /** Can still take the keyboard for win: connected, shown and enabled. */
  const usable = (win: DesktopWindow, element: HTMLElement | undefined) =>
    !!element &&
    element.isConnected &&
    win.element.contains(element) &&
    !element.closest("[hidden], [inert]") &&
    !element.matches(":disabled");

  /**
   * The element that should own the keyboard when the window activates: a
   * game that has it, else the control that had it last (Windows 98 returns
   * to it), else the window's default control, else the frame.
   */
  function focusTarget(win: DesktopWindow) {
    if (win.gameFrame && !win.keyboardReleased) return win.gameFrame;
    if (usable(win, win.lastFocus)) return win.lastFocus!;
    const fallback = win.defaultFocus?.();
    return usable(win, fallback) ? fallback! : win.element;
  }

  /** Gives the window the keyboard at its focus target. */
  function focusWindow(win: DesktopWindow) {
    const target = focusTarget(win);
    target.focus({ preventScroll: true });
    // A target that cannot take focus after all (hidden by CSS) leaves it
    // on the frame rather than outside the window.
    if (target !== win.element && !win.element.contains(document.activeElement))
      win.element.focus({ preventScroll: true });
  }

  /** Writes the model geometry, clamped so the window stays inside the workspace. */
  function placeWindow(win: DesktopWindow) {
    const pending = unplaced.get(win);
    if (pending && !isPhone()) {
      unplaced.delete(win);
      Object.assign(
        win,
        pending === "first" ? firstWindowBounds() : cascadePosition(win),
      );
    }
    const style = win.element.style;
    const width = workspace.clientWidth;
    const height = workspace.clientHeight;
    // Without layout (detached, or a test DOM) there is nothing to clamp against.
    const bounded = width > 0 && height > 0;
    if (win.w !== undefined)
      style.width = `${bounded ? Math.min(win.w, width) : win.w}px`;
    if (win.h !== undefined)
      style.height = `${bounded ? Math.min(win.h, height) : win.h}px`;
    const x = bounded
      ? clamp(win.x, 0, width - win.element.offsetWidth)
      : win.x;
    const y = bounded
      ? clamp(win.y, 0, height - win.element.offsetHeight)
      : win.y;
    style.left = `${x}px`;
    style.top = `${y}px`;
  }

  /** Right edges of the first and last occupied desktop icon columns. */
  function iconColumns() {
    let first = Infinity;
    let last = 0;
    const left = icons.offsetLeft - icons.scrollLeft;
    for (const icon of icons.children) {
      if (!(icon instanceof HTMLElement) || !icon.offsetWidth) continue;
      const right = left + icon.offsetLeft + icon.offsetWidth;
      first = Math.min(first, right);
      last = Math.max(last, right);
    }
    return { first: last ? first : 0, last };
  }

  function cascadeOrigin() {
    const { last } = iconColumns();
    return { x: last + DESKTOP_MARGIN, y: DESKTOP_MARGIN };
  }

  /**
   * The next cascade slot: step down and right from the origin, restart when
   * the window would leave the workspace, and skip slots that a visible window
   * already occupies. Uses the window's measured size.
   */
  function cascadePosition(win: DesktopWindow) {
    const width = workspace.clientWidth;
    const height = workspace.clientHeight;
    const bounded = width > 0 && height > 0;
    const w = win.element.offsetWidth;
    const h = win.element.offsetHeight;
    const origin = cascadeOrigin();
    const slot = (step: number) => {
      const x = origin.x + step * CASCADE_STEP;
      const y = origin.y + step * CASCADE_STEP;
      return bounded
        ? { x: clamp(x, 0, width - w), y: clamp(y, 0, height - h) }
        : { x, y };
    };
    const overflows = (step: number) =>
      bounded &&
      step > 0 &&
      (origin.x + step * CASCADE_STEP + w > width ||
        origin.y + step * CASCADE_STEP + h > height);
    const taken = ({ x, y }: { x: number; y: number }) =>
      [...windows.values()].some(
        other =>
          other !== win &&
          !other.element.hidden &&
          // Closer than half a step reads as the same slot.
          Math.abs(other.x - x) < CASCADE_STEP / 2 &&
          Math.abs(other.y - y) < CASCADE_STEP / 2,
      );
    for (let attempt = 0; attempt <= windows.size; attempt++) {
      if (overflows(cascade)) cascade = 0;
      const position = slot(cascade++);
      if (!taken(position)) return position;
    }
    // Every slot that fits is taken (a small workspace): keep stepping and let
    // the clamp hold the window inside, so the captions still differ.
    for (let step = 1; step <= windows.size + 1; step++) {
      const position = slot(step);
      if (!taken(position)) return position;
    }
    // Both axes are exhausted: step up and left from the bottom-right corner.
    if (bounded)
      for (let step = 1; step <= windows.size + 1; step++) {
        const position = {
          x: Math.max(0, width - w - step * CASCADE_STEP),
          y: Math.max(0, height - h - step * CASCADE_STEP),
        };
        if (!taken(position)) return position;
      }
    return slot(0);
  }

  /**
   * Bounds for the first window: right of the icon columns, as large as the
   * workspace allows. With less than 420 px left it may overlap later icon
   * columns, but never the first one.
   */
  function firstWindowBounds() {
    const width = workspace.clientWidth;
    const height = workspace.clientHeight;
    const { first, last } = iconColumns();
    let x = last + DESKTOP_MARGIN;
    if (width - x - DESKTOP_MARGIN < 420)
      x = Math.max(first + DESKTOP_MARGIN, width - DESKTOP_MARGIN - 420);
    x = Math.max(0, x);
    return {
      x,
      y: DESKTOP_MARGIN,
      w: Math.max(0, Math.min(740, width - x - DESKTOP_MARGIN)),
      h: Math.max(0, Math.min(510, height - 2 * DESKTOP_MARGIN)),
    };
  }

  /** Task buttons name minimized windows, as their pressed state cannot. */
  function labelTask(win: DesktopWindow) {
    win.task.setAttribute(
      "aria-label",
      win.element.hidden
        ? `${win.task.dataset.tip}, minimized`
        : (win.task.dataset.tip ?? ""),
    );
  }

  function activate(win?: DesktopWindow, focus = true) {
    active = win?.id;
    if (win) hiddenByShowDesktop = undefined;
    for (const item of windows.values()) {
      const selected = item === win;
      item.element.dataset.active = String(selected);
      item.task.setAttribute("aria-pressed", String(selected));
    }
    if (win?.element.hidden) {
      win.element.hidden = false;
      if (!isMaximized(win)) placeWindow(win);
    }
    for (const item of windows.values()) labelTask(item);
    taskbar.updateTabStop();
    if (!win) return;
    win.element.style.zIndex = String(++zIndex);
    if (focus) focusWindow(win);
  }

  /** Visible windows, bottom to top. */
  const visibleWindows = () =>
    [...windows.values()]
      .filter(win => !win.element.hidden)
      .sort((a, b) => +a.element.style.zIndex - +b.element.style.zIndex);

  /** Windows that Minimize All Windows (or Show Desktop) hid, still open. */
  const minimizedByAll = () =>
    (hiddenByShowDesktop?.ids ?? [])
      .map(id => windows.get(id))
      .filter(win => win !== undefined);

  /**
   * Minimizes every window and remembers them, and the active one, for
   * Undo Minimize All.
   */
  function minimizeAll() {
    const visible = visibleWindows();
    const previous = active;
    for (const win of visible) win.element.hidden = true;
    activate(undefined);
    hiddenByShowDesktop = visible.length
      ? { ids: visible.map(win => win.id), active: previous }
      : undefined;
  }

  /**
   * Restores what Minimize All Windows hid, in its stacking order, and
   * reactivates the window that was active. Returns false when there is
   * nothing to undo (a window was opened or activated since).
   */
  function undoMinimizeAll() {
    const snapshot = hiddenByShowDesktop;
    const restore = minimizedByAll();
    hiddenByShowDesktop = undefined;
    if (!restore.length) return false;
    for (const win of restore) {
      win.element.hidden = false;
      if (!isMaximized(win)) placeWindow(win);
      win.element.style.zIndex = String(++zIndex);
    }
    const previous = snapshot?.active
      ? windows.get(snapshot.active)
      : undefined;
    activate(
      previous && restore.includes(previous) ? previous : restore.at(-1),
    );
    return true;
  }

  /**
   * Show Desktop: the first press minimizes every window; the next one, if
   * nothing was opened or activated in between, restores them in their
   * stacking order and reactivates the window that was active.
   */
  function toggleDesktop() {
    if (!undoMinimizeAll()) minimizeAll();
  }

  /** Leaves maximized state without moving focus (arranging commands). */
  function unmaximize(win: DesktopWindow) {
    if (!isMaximized(win)) return;
    win.element.classList.remove("WinWindow--maximized");
    labelMaximize(win);
  }

  /**
   * Cascade Windows: the visible windows step down and right from the
   * cascade origin in their stacking order, keeping their sizes.
   */
  function cascadeWindows() {
    const list = visibleWindows();
    if (!list.length) return;
    const width = workspace.clientWidth;
    const height = workspace.clientHeight;
    const bounded = width > 0 && height > 0;
    const origin = cascadeOrigin();
    let step = 0;
    for (const win of list) {
      unmaximize(win);
      const w = win.w ?? win.element.offsetWidth;
      const h = win.h ?? win.element.offsetHeight;
      if (
        bounded &&
        step > 0 &&
        (origin.x + step * CASCADE_STEP + w > width ||
          origin.y + step * CASCADE_STEP + h > height)
      )
        step = 0;
      setBounds(win, {
        x: origin.x + step * CASCADE_STEP,
        y: origin.y + step * CASCADE_STEP,
      });
      win.element.style.zIndex = String(++zIndex);
      step++;
    }
    cascade = step;
    activate(list.at(-1));
  }

  /**
   * Tile Windows: "horizontal" stacks wide windows from top to bottom,
   * "vertical" puts tall ones side by side; more than three windows share
   * a grid. Tiling covers the whole workspace, as in Windows 98.
   */
  function tileWindows(direction: "horizontal" | "vertical") {
    const list = visibleWindows();
    const count = list.length;
    if (!count) return;
    const width = workspace.clientWidth;
    const height = workspace.clientHeight;
    // Lines run across the tiling direction: columns of stacked windows, or
    // rows of side-by-side ones.
    const lines = count > 3 ? Math.ceil(count / 3) : 1;
    const across = direction === "horizontal" ? width : height;
    const along = direction === "horizontal" ? height : width;
    const span = (index: number, of: number, size: number) => {
      const start = Math.round((index * size) / of);
      return [start, Math.round(((index + 1) * size) / of) - start];
    };
    let index = 0;
    for (let line = 0; line < lines; line++) {
      const inLine = Math.floor(count / lines) + (line < count % lines ? 1 : 0);
      const [lineStart, lineSize] = span(line, lines, across);
      for (let cell = 0; cell < inLine; cell++) {
        const win = list[index++];
        unmaximize(win);
        const [cellStart, cellSize] = span(cell, inLine, along);
        const bounds =
          direction === "horizontal"
            ? { x: lineStart, y: cellStart, w: lineSize, h: cellSize }
            : { x: cellStart, y: lineStart, w: cellSize, h: lineSize };
        setBounds(win, {
          ...bounds,
          w: Math.max(bounds.w, Math.min(win.minWidth, width)),
          h: Math.max(bounds.h, Math.min(win.minHeight, height)),
        });
      }
    }
    activate(list.at(-1));
  }

  function nextWindow() {
    const visible = [...windows.values()].filter(win => !win.element.hidden);
    activate(
      visible.sort(
        (a, b) => +b.element.style.zIndex - +a.element.style.zIndex,
      )[0],
    );
    if (!active) onNoWindow();
  }

  function closeWindow(win: DesktopWindow) {
    unplaced.delete(win);
    if (drag?.win === win) stopDrag();
    if (systemMenu?.win === win) systemMenu.handle.close("programmatic");
    win.dispose?.();
    win.element.remove();
    win.task.remove();
    windows.delete(win.id);
    nextWindow();
  }

  function minimize(win: DesktopWindow) {
    if (drag?.win === win) stopDrag();
    win.element.hidden = true;
    nextWindow();
  }

  function labelMaximize(win: DesktopWindow) {
    const maximized = isMaximized(win);
    win.maximize.setAttribute(
      "aria-label",
      `${maximized ? "Restore" : "Maximize"} ${win.title.textContent}`,
    );
    win.maximize.dataset.tip = maximized ? "Restore" : "Maximize";
    win.maximize.innerHTML = captionGlyph(maximized ? "restore" : "maximize");
  }

  function maximize(win: DesktopWindow) {
    if (drag?.win === win) stopDrag();
    const maximized = win.element.classList.toggle("WinWindow--maximized");
    labelMaximize(win);
    if (!maximized) placeWindow(win);
    if (win.gameFrame && !win.keyboardReleased)
      win.gameFrame.focus({ preventScroll: true });
  }

  /** Renames the caption, task button and caption-button labels. */
  function retitle(win: DesktopWindow, title: string, taskLabel = title) {
    win.title.textContent = title;
    win.element.setAttribute("aria-label", title);
    win.task.querySelector("span")!.textContent = taskLabel;
    win.task.dataset.tip = title;
    win.sysMenu.setAttribute("aria-label", `System menu, ${title}`);
    labelTask(win);
    for (const control of win.element.querySelectorAll<HTMLButtonElement>(
      ".WinWindowControls button",
    ))
      control.setAttribute("aria-label", `${control.dataset.tip} ${title}`);
  }

  /** Swaps the caption and task-button icons, e.g. when Explorer navigates. */
  function setIcon(win: DesktopWindow, icon: string) {
    for (const old of [
      win.sysMenu.querySelector(".Win98Icon"),
      win.task.querySelector(".Win98Icon"),
    ])
      if (old) old.outerHTML = windowsIcon(icon, 16);
  }

  /**
   * The system menu's items. Move and Size need a keyboard sizing mode,
   * which Portfolio 98 does not have, so they stay disabled.
   */
  function systemMenuItems(win: DesktopWindow): MenuEntry[] {
    const minimized = !!win.element.hidden;
    const maximized = isMaximized(win);
    return [
      {
        label: "&Restore",
        glyph: "restore",
        disabled: !minimized && !maximized,
        action: () => {
          if (minimized) activate(win);
          else maximize(win);
        },
      },
      { label: "&Move", disabled: true },
      { label: "&Size", disabled: true },
      {
        label: "Mi&nimize",
        glyph: "minimize",
        disabled: minimized,
        action: () => minimize(win),
      },
      {
        label: "Ma&ximize",
        glyph: "maximize",
        disabled: maximized,
        action: () => {
          if (minimized) activate(win);
          maximize(win);
        },
      },
      "-",
      {
        label: "&Close",
        glyph: "close",
        default: true,
        shortcut: "Alt+F4",
        action: () => closeWindow(win),
      },
    ];
  }

  /**
   * Opens a window's system menu: below its title-bar icon, above its task
   * button, or at a point (a right-click on the title bar).
   */
  function openSystemMenu(
    win: DesktopWindow,
    {
      anchor,
      point,
      keyboard = false,
      returnFocus,
    }: {
      anchor?: HTMLElement;
      point?: { x: number; y: number };
      keyboard?: boolean;
      returnFocus?: HTMLElement | null;
    } = {},
  ) {
    systemMenu?.handle.close("programmatic");
    const options: OpenMenuOptions = {
      items: () => systemMenuItems(win),
      placement: anchor === win.task ? "above" : "below",
      returnFocus: returnFocus ?? anchor ?? win.sysMenu,
      focus: keyboard ? "first" : "menu",
      label: `System menu, ${win.title.textContent}`,
      className: "WinSystemMenu",
      host: root,
      // A second press on the icon closes the menu instead of reopening it.
      ignore: anchor === win.task ? undefined : (anchor ?? win.sysMenu),
      onClose: () => {
        if (systemMenu?.handle === handle) systemMenu = undefined;
      },
    };
    if (point) options.point = point;
    else options.anchor = anchor ?? win.sysMenu;
    const handle = openMenu(options);
    systemMenu = { win, handle };
    return handle;
  }

  function createWindow(
    id: string,
    title: string,
    icon: string,
    options: WindowOptions = {},
  ): DesktopWindow {
    const existing = windows.get(id);
    if (existing) {
      activate(existing);
      return existing;
    }
    const frame = document.createElement("section");
    frame.className = ["WinWindow", options.className]
      .filter(Boolean)
      .join(" ");
    frame.dataset.window = id;
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-label", title);
    frame.tabIndex = -1;
    frame.innerHTML = `<header class="WinTitlebar"><button type="button" class="WinSysMenu" data-crt-hit aria-haspopup="menu" aria-expanded="false" aria-label="System menu, ${escape(title)}">${windowsIcon(icon, 16)}</button><strong>${escape(title)}</strong><div class="WinWindowControls"><button type="button" data-win-action="minimize" data-crt-hit aria-label="Minimize ${escape(title)}" data-tip="Minimize">${captionGlyph("minimize")}</button><button type="button" data-win-action="maximize" data-crt-hit aria-label="Maximize ${escape(title)}" data-tip="Maximize">${captionGlyph("maximize")}</button><button type="button" data-win-action="close" data-crt-hit aria-label="Close ${escape(title)}" data-tip="Close">${captionGlyph("close")}</button></div></header><div class="WinWindowBody"></div><footer class="WinStatus"></footer><div class="WinSizeGrip" data-resize="se" aria-hidden="true"></div>${RESIZE_HANDLES}`;
    const task = taskbar.addTask(title, icon, () => {
      if (active === id && !frame.hidden) minimize(win);
      else activate(win);
    });
    const win: DesktopWindow = {
      id,
      element: frame,
      task,
      x: 0,
      y: 0,
      w: options.w,
      h: options.h,
      minWidth: options.minWidth ?? MIN_WIDTH,
      minHeight: options.minHeight ?? MIN_HEIGHT,
      body: frame.querySelector(".WinWindowBody")!,
      title: frame.querySelector(".WinTitlebar strong")!,
      status: frame.querySelector(".WinStatus")!,
      maximize: frame.querySelector('[data-win-action="maximize"]')!,
      sysMenu: frame.querySelector(".WinSysMenu")!,
    };
    frame.addEventListener("pointerdown", () => activate(win, false));
    frame.addEventListener("focusin", event => {
      const target = event.target as HTMLElement;
      // Activation returns to the control that had the keyboard: not the
      // frame, a game (it has its own rule), caption buttons or the bar.
      if (
        target !== frame &&
        target !== win.gameFrame &&
        !target.matches(CAPTION_CONTROL) &&
        !target.closest(".WinMenuBar")
      )
        win.lastFocus = target;
      if (active !== win.id) activate(win, false);
    });
    // Both clicks of a double-click must press the title bar (or the icon):
    // the first may have hit a control that has gone since.
    frame.querySelector(".WinTitlebar")!.addEventListener("dblclick", event => {
      if (
        !(event.target as Element).closest("button") &&
        pairs.same(target =>
          target.closest("button") ? null : target.closest(".WinTitlebar"),
        )
      )
        maximize(win);
    });
    // The title-bar icon: a click opens the system menu (a second click
    // closes it), and a double-click closes the window.
    win.sysMenu.addEventListener("click", event => {
      if (event.detail > 1) return;
      if (systemMenu?.win === win && !systemMenu.handle.closed) {
        // Back to where the menu came from (the window, for the mouse).
        systemMenu.handle.close("escape");
        return;
      }
      const keyboard = !event.detail;
      openSystemMenu(win, {
        anchor: win.sysMenu,
        keyboard,
        // A mouse-opened menu hands the keyboard back to the window.
        returnFocus: keyboard ? win.sysMenu : focusTarget(win),
      });
    });
    win.sysMenu.addEventListener("dblclick", () => {
      if (!pairs.same(target => target.closest(".WinSysMenu"))) return;
      systemMenu?.handle.close("programmatic");
      closeWindow(win);
    });
    windows.set(id, win);
    layer.append(frame);
    // A program's initial size, before the cascade measures the window.
    if (win.w !== undefined) frame.style.width = `${win.w}px`;
    if (win.h !== undefined) frame.style.height = `${win.h}px`;
    // The next cascade slot, from the measured window so its caption buttons
    // start on-screen; on phones it waits until the workspace is wide.
    unplaced.set(win, "cascade");
    placeWindow(win);
    activate(win);
    return win;
  }

  /** Moves and sizes a window from new model bounds. */
  function setBounds(
    win: DesktopWindow,
    bounds: { x: number; y: number; w?: number; h?: number },
  ) {
    unplaced.delete(win);
    Object.assign(win, bounds);
    placeWindow(win);
  }

  /**
   * Gives the startup window the first-window bounds, now or as soon as the
   * workspace is wider than a phone.
   */
  function placeFirst(win: DesktopWindow) {
    unplaced.set(win, "first");
    placeWindow(win);
  }

  function stopDrag() {
    dragFrame.flush();
    if (drag?.handle.hasPointerCapture(drag.pointer))
      drag.handle.releasePointerCapture(drag.pointer);
    drag = undefined;
    delete layer.dataset.interacting;
  }

  /** Client pixels per workspace pixel: the CRT may scale the desktop. */
  function pointerScale() {
    const rect = workspace.getBoundingClientRect();
    return rect.width > 0 && workspace.clientWidth > 0
      ? rect.width / workspace.clientWidth
      : 1;
  }

  /** Starts moving (or, with edges, resizing) a window with the pointer. */
  function startDrag(
    win: DesktopWindow,
    handle: HTMLElement,
    event: PointerEvent,
    edges?: Edges,
  ) {
    stopDrag();
    // The user places this window now.
    unplaced.delete(win);
    const width = win.element.offsetWidth;
    const height = win.element.offsetHeight;
    drag = {
      win,
      handle,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      // Start where the window is drawn: a smaller workspace may have
      // clamped it away from its model position.
      left: clamp(win.x, 0, workspace.clientWidth - width),
      top: clamp(win.y, 0, workspace.clientHeight - height),
      width,
      height,
      scale: pointerScale(),
      edges,
    };
    // Demo frames would swallow the moves.
    layer.dataset.interacting = "";
    handle.setPointerCapture(event.pointerId);
  }

  /**
   * New bounds for a resize: the dragged edges follow the pointer, the
   * others stay; the window keeps its minimum size and stays inside the
   * workspace.
   */
  function resized(
    { left, top, width, height, edges = "" }: NonNullable<typeof drag>,
    win: DesktopWindow,
    dx: number,
    dy: number,
  ) {
    const areaWidth = workspace.clientWidth;
    const areaHeight = workspace.clientHeight;
    const right = left + width;
    const bottom = top + height;
    const minWidth = Math.min(win.minWidth, right, areaWidth);
    const minHeight = Math.min(win.minHeight, bottom, areaHeight);
    let x = left;
    let y = top;
    let w = width;
    let h = height;
    if (edges.includes("e"))
      w = clamp(
        width + dx,
        Math.min(win.minWidth, areaWidth - left),
        areaWidth - left,
      );
    if (edges.includes("w")) {
      x = clamp(left + dx, 0, right - minWidth);
      w = right - x;
    }
    if (edges.includes("s"))
      h = clamp(
        height + dy,
        Math.min(win.minHeight, areaHeight - top),
        areaHeight - top,
      );
    if (edges.includes("n")) {
      y = clamp(top + dy, 0, bottom - minHeight);
      h = bottom - y;
    }
    return { x, y, w, h };
  }

  const pairs = pressPairs(root, abort.signal);
  root.addEventListener(
    "pointerdown",
    event => {
      const target = event.target as Element;
      // Caption and tool buttons never take the keyboard from the window's
      // client: a mouse or pen press does not focus them (Firefox and
      // Chromium still show them pushed), and an inactive window's own
      // control gets the keyboard. Touch keeps the browser's focus.
      const control =
        event.pointerType === "touch" ? null : target.closest(NO_POINTER_FOCUS);
      if (control) {
        event.preventDefault();
        const frame = control.closest<HTMLElement>("[data-window]");
        const win = windows.get(frame?.dataset.window ?? "");
        // An open menu that the press keeps (the system menu's own icon)
        // keeps the keyboard too.
        const focused = document.activeElement;
        if (
          win &&
          !win.element.contains(focused) &&
          !focused?.closest(".WinMenu")
        )
          focusWindow(win);
      }
      if (event.button !== 0) return;
      // Frame edges, corners and the size grip resize.
      const resize = target.closest<HTMLElement>("[data-resize]");
      if (resize) {
        const frame = resize.closest<HTMLElement>("[data-window]");
        const win = windows.get(frame?.dataset.window ?? "");
        if (!win || isMaximized(win) || isPhone()) return;
        // preventDefault blocks the focus change too: the window being
        // resized takes the keyboard, so keys never act on the one behind.
        event.preventDefault();
        if (!win.element.contains(document.activeElement)) focusWindow(win);
        startDrag(win, resize, event, resize.dataset.resize);
        return;
      }
      const handle = target.closest<HTMLElement>(".WinTitlebar");
      if (!handle || target.closest("button")) return;
      const win = windows.get(handle.parentElement?.dataset.window ?? "");
      if (!win) return;
      // preventDefault keeps text unselected but also blocks the browser's
      // focus change, so give the window the keyboard explicitly.
      event.preventDefault();
      if (!win.element.contains(document.activeElement)) focusWindow(win);
      if (isMaximized(win) || isPhone()) return;
      startDrag(win, handle, event);
    },
    { signal: abort.signal },
  );
  root.addEventListener(
    "pointermove",
    event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const { win, left, top, x, y, width, height, scale, edges } = drag;
      const dx = (event.clientX - x) / scale;
      const dy = (event.clientY - y) / scale;
      if (edges) {
        Object.assign(win, resized(drag, win, dx, dy));
        win.resized = true;
      } else {
        win.x = clamp(left + dx, 0, workspace.clientWidth - width);
        win.y = clamp(top + dy, 0, workspace.clientHeight - height);
      }
      // Every write re-runs the CRT filter: write at most once per frame.
      dragFrame.schedule(() => placeWindow(win));
    },
    { signal: abort.signal },
  );
  root.addEventListener("pointerup", stopDrag, { signal: abort.signal });
  root.addEventListener("pointercancel", stopDrag, { signal: abort.signal });

  const observer = new ResizeObserver(() => {
    // At phone widths CSS owns the layout; keep the model for the way back.
    if (isPhone()) return;
    for (const win of windows.values())
      if (!win.element.hidden && !isMaximized(win)) placeWindow(win);
  });
  observer.observe(workspace);

  return {
    windows,
    get active() {
      return active;
    },
    activate,
    cascadeWindows,
    closeWindow,
    createWindow,
    firstWindowBounds,
    placeFirst,
    focusTarget,
    focusWindow,
    maximize,
    minimize,
    minimizeAll,
    /** Minimize All Windows can be undone (nothing was activated since). */
    get canUndoMinimizeAll() {
      return minimizedByAll().length > 0;
    },
    undoMinimizeAll,
    openSystemMenu,
    tileWindows,
    nextWindow,
    placeWindow,
    retitle,
    setBounds,
    setIcon,
    stopDrag,
    toggleDesktop,
    /** The window that contains keyboard focus, if any. */
    focusedWindow() {
      const frame =
        document.activeElement?.closest<HTMLElement>("[data-window]");
      return frame && root.contains(frame)
        ? windows.get(frame.dataset.window!)
        : undefined;
    },
    dispose() {
      stopDrag();
      dragFrame.cancel();
      for (const win of windows.values()) win.dispose?.();
      observer.disconnect();
      abort.abort();
    },
  };
}
