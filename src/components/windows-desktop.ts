import { createApps, isStartChord, recentProjects } from "./win98/apps";
import { createContextMenus } from "./win98/context-menus";
import {
  createListViews,
  initListView,
  LIST_ITEM,
  LIST_VIEW,
  listItem,
  selectItem,
} from "./win98/list-view";
import { closeMenus } from "./win98/menu";
import { isModalOpen } from "./win98/message-box";
import { runDialog, type RunTarget } from "./win98/run";
import { type Folder } from "./win98/shared";
import { createShutDown } from "./win98/shut-down";
import {
  createStartMenu,
  startMenuItems,
  type ToggleSetting,
} from "./win98/start-menu";
import { createTaskbar, taskbarMarkup } from "./win98/taskbar";
import { createTooltips } from "./win98/tooltip";
import { createWindowManager } from "./win98/window-manager";

/**
 * Shared SVG filters, declared once per desktop. win-selected lays a 50%
 * navy dither over a selected icon's opaque pixels; win-disabled embosses a
 * disabled toolbar glyph (dark pixels grey, with a white offset copy).
 */
const SELECTION_FILTERS = `<svg class="WinFilters" width="0" height="0" aria-hidden="true" focusable="false"><filter id="win-selected" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3Cpath d='M0 0h1v1H0zM1 1h1v1H1z'/%3E%3C/svg%3E" x="0" y="0" width="2" height="2" result="cell"/><feTile in="cell" result="checker"/><feFlood flood-color="#000080" result="navy"/><feComposite in="navy" in2="checker" operator="in" result="dots"/><feComposite in="dots" in2="SourceAlpha" operator="in" result="tint"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="tint"/></feMerge></filter><filter id="win-disabled" x="0" y="0" width="120%" height="120%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -0.4 -0.4 -0.4 1 0" result="dark"/><feComponentTransfer in="dark" result="ink"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feFlood flood-color="#fff"/><feComposite in2="ink" operator="in"/><feOffset dx="1" dy="1" result="light"/><feFlood flood-color="#808080"/><feComposite in2="ink" operator="in" result="shade"/><feMerge><feMergeNode in="light"/><feMergeNode in="shade"/></feMerge></filter></svg>`;

/** MS-DOS Prompt returns at once; MS-DOS mode restarts Portfolio 98. */
export type DesktopExit = "prompt" | "dos-mode";
export type DesktopShutdown = "shutdown" | "restart";

/** A portfolio desktop with web demos embedded in project windows. */
export function WindowsDesktop(
  onExit: (kind: DesktopExit) => void,
  onShutdown: (kind: DesktopShutdown) => void,
  {
    displayEffects,
  }: {
    /**
     * Start ▸ Settings ▸ Display effects and the Display Properties check
     * box. The terminal passes { get: getCrtEffects, set: setCrtEffects }
     * from src/utils/crt-curvature.ts.
     */
    displayEffects?: ToggleSetting;
  } = {},
) {
  const element = document.createElement("section");
  element.className = "Win98";
  element.setAttribute("aria-label", "Portfolio 98 desktop");
  element.tabIndex = -1;
  // System icons first, so the first window never covers them. The desktop
  // is a list view flowing down its columns.
  element.innerHTML = `
    ${SELECTION_FILTERS}
    <div class="WinWorkspace">
      <div class="WinDesktopIcons" role="listbox" aria-label="Desktop shortcuts" data-listview data-flow="column">
        ${listItem("computer", "My Computer", "computer")}
        ${listItem("folder:projects", "My Projects", "folder")}
        ${listItem("recycle", "Recycle Bin", "recycle")}
        ${listItem("folder:games", "Games", "games")}
        ${listItem("project:paintaz", "paintAZ", "paintaz")}
        ${listItem("about", "About Adam.txt", "notepad")}
        ${listItem("contact", "Contact", "mail")}
        ${listItem("exit", "MS-DOS Prompt", "terminal")}
      </div>
      <div class="WinWallpaper" aria-hidden="true"><span>Adam Zielonka</span><strong>Portfolio<span>98</span></strong><small>PERSONAL PROJECTS · ALWAYS CURIOUS</small></div>
      <div class="WinWindowLayer"></div>
    </div>
    ${taskbarMarkup()}`;
  const workspace = element.querySelector<HTMLElement>(".WinWorkspace")!;
  const icons = element.querySelector<HTMLElement>(".WinDesktopIcons")!;
  initListView(icons);
  const abort = new AbortController();
  const taskbar = createTaskbar(element);
  const start = taskbar.start;
  const wm = createWindowManager({
    root: element,
    workspace,
    layer: element.querySelector<HTMLElement>(".WinWindowLayer")!,
    icons,
    taskbar,
    onNoWindow: () => start.focus(),
  });
  // Start ▸ Settings and Display Properties share these settings.
  const animations: ToggleSetting = {
    get: () => window.store.system.animations,
    set: on => {
      if (on !== window.store.system.animations)
        window.store.system.toggleAnimations();
    },
  };
  // Opening Start hands the foreground to the taskbar, as in Windows 98.
  let foregroundBeforeStart: string | undefined;
  const startMenu = createStartMenu({
    root: element,
    start,
    items: () =>
      startMenuItems({
        openFolder: id => apps.openFolder(id),
        openProject: id => apps.openProject(id),
        openAbout: () => apps.openAbout(),
        openContact: () => apps.openContact(),
        openFind: () => apps.openFind(),
        openHelp: () => apps.openHelp(),
        run: () =>
          void runDialog({ root: element, start, signal: abort.signal, open }),
        shutDown: () => void shutDown.show(),
        msDosPrompt: () => onExit("prompt"),
        recentProjects,
        animations,
        displayEffects,
      }),
    onOpen() {
      foregroundBeforeStart = wm.active;
      wm.activate(undefined, false);
    },
    onCancel() {
      const previous = foregroundBeforeStart
        ? wm.windows.get(foregroundBeforeStart)
        : undefined;
      foregroundBeforeStart = undefined;
      if (previous && !previous.element.hidden && wm.active === undefined)
        wm.activate(previous, false);
    },
  });
  const apps = createApps({
    wm,
    startMenu,
    signal: abort.signal,
    openItem,
  });
  createListViews({ root: element, signal: abort.signal, onOpen: openItem });
  createTooltips({ root: element, bounds: workspace, signal: abort.signal });
  createContextMenus({
    root: element,
    wm,
    icons,
    signal: abort.signal,
    open: openItem,
    run: action => run(action),
    settings: { animations, displayEffects },
  });
  const shutDown = createShutDown({
    root: element,
    start,
    signal: abort.signal,
    onChoice: choice => {
      if (choice === "dos-mode") onExit("dos-mode");
      else onShutdown(choice);
    },
  });
  /** Opens what Start ▸ Run… resolved. */
  function open(target: RunTarget) {
    if (target.kind === "project") apps.openProject(target.id);
    else if (target.kind === "folder") apps.openFolder(target.id);
    else if (target.kind === "about") apps.openAbout();
    else if (target.kind === "computer") apps.openComputer();
    else if (target.kind === "contact") apps.openContact();
    else if (target.kind === "find") apps.openFind();
    else if (target.kind === "help") apps.openHelp();
    else if (target.kind === "recycle") apps.openRecycle();
    else onExit("prompt");
  }
  /** Opens a list item: a desktop icon, a file in Explorer or a Find result. */
  function openItem(item: HTMLElement) {
    startMenu.toggle(false);
    const action = item.dataset.winAction;
    if (action) run(action);
  }
  let pointerInteraction = false;

  element.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const control = target.closest<HTMLElement>("[data-win-action]");
    const action = control?.dataset.winAction;
    if (action !== "start" && !startMenu.contains(target))
      startMenu.toggle(false);
    // List views decide for their items (a mouse click only selects).
    if (!action || control!.closest(`${LIST_VIEW} ${LIST_ITEM}`)) return;
    // The second click of a double-click must not activate whatever a
    // navigation just rendered under the pointer. Keyboard clicks have detail 0.
    if (event.detail > 1) return;
    const frame = control!.closest<HTMLElement>("[data-window]");
    const win = frame ? wm.windows.get(frame.dataset.window!) : undefined;
    if (action === "start") {
      if (startMenu.open && event.detail > 0) startMenu.cancel();
      else startMenu.toggle(!startMenu.open, event.detail === 0);
      return;
    }
    startMenu.toggle(false);
    run(action, win);
  });
  /** Runs a desktop command: an icon, a link or a window control. */
  function run(action: string, win?: ReturnType<typeof wm.windows.get>) {
    if (action.startsWith("folder:"))
      apps.openFolder(action.slice(7) as Folder);
    else if (action.startsWith("project:")) apps.openProject(action.slice(8));
    else if (action === "computer") apps.openComputer();
    else if (action === "find") apps.openFind();
    else if (action === "about") apps.openAbout();
    else if (action === "contact") apps.openContact();
    else if (action === "exit") onExit("prompt");
    else if (action === "shutdown") void shutDown.show();
    else if (action === "recycle") apps.openRecycle();
    else if (action === "desktop") wm.toggleDesktop();
    else if (win) {
      if (action === "close") wm.closeWindow(win);
      if (action === "minimize") wm.minimize(win);
      if (action === "maximize") wm.maximize(win);
    }
  }
  element.addEventListener("keydown", event => {
    // A message box (or Stand by) owns the keyboard: no desktop shortcuts.
    if (isModalOpen(element)) return;
    if (
      event.key === "F3" &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      startMenu.toggle(false);
      // In Notepad, F3 is Find Next.
      const notepad = (event.target as Element).closest?.(
        '[data-window="about"]',
      );
      const win = notepad && wm.windows.get("about");
      if (win) apps.notepadFindNext(win);
      else apps.openFind();
      return;
    }
    // Windows hosts usually take Ctrl+Esc themselves; the Start button stays
    // in the tab order, so this is never the only way to Start.
    if (isStartChord(event)) {
      event.preventDefault();
      startMenu.toggle(!startMenu.open, true);
      return;
    }
    // Alt+Space opens the system menu of the window with the keyboard (when
    // the browser leaves the chord to the page).
    if (
      event.altKey &&
      event.key === " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      const win = wm.focusedWindow();
      if (win) {
        event.preventDefault();
        wm.openSystemMenu(win, {
          keyboard: true,
          returnFocus:
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null,
        });
        return;
      }
    }
    if (startMenu.keydown(event)) return;
    if (
      event.altKey &&
      event.key === "F4" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      // Close the window that has the keyboard, never one behind it.
      const win = wm.focusedWindow();
      event.preventDefault();
      if (win) wm.closeWindow(win);
      // On the desktop or the taskbar, Alt+F4 asks to shut down.
      else if (!(event.target as Element).closest?.(".WinMenu"))
        void shutDown.show();
    }
  });
  // Clicking the wallpaper gives the desktop the foreground and clears the
  // icon selection.
  // A desktop icon takes the foreground too, keeping its selection.
  workspace.addEventListener("pointerdown", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-window]")) return;
    wm.activate(undefined, false);
    if (!target?.closest(".WinShortcut")) selectItem(icons, undefined);
  });
  // Touch browsers may focus the desktop/container before synthesizing click.
  // Keep the menu mounted through that sequence; activate only on click, so
  // scrolling/cancelled touches never launch an item. Keyboard Tab still dismisses.
  document.addEventListener(
    "pointerdown",
    () => {
      pointerInteraction = true;
    },
    { capture: true, signal: abort.signal },
  );
  document.addEventListener(
    "keydown",
    () => {
      pointerInteraction = false;
    },
    { capture: true, signal: abort.signal },
  );
  element.addEventListener("focusout", event => {
    if (
      !pointerInteraction &&
      event.target instanceof Node &&
      startMenu.contains(event.target) &&
      event.relatedTarget instanceof Node &&
      !startMenu.contains(event.relatedTarget)
    )
      startMenu.toggle(false);
  });
  window.addEventListener(
    "blur",
    () => {
      wm.stopDrag();
      // Events inside an iframe do not bubble into the desktop. After focus has
      // settled, activate its window without pulling keyboard focus out of the app.
      window.setTimeout(() => {
        if (abort.signal.aborted) return;
        const focused = document.activeElement;
        if (
          !(focused instanceof HTMLIFrameElement) ||
          !element.contains(focused)
        )
          return;
        closeMenus();
        startMenu.toggle(false);
        const frame = focused.closest<HTMLElement>("[data-window]")!;
        const win = wm.windows.get(frame.dataset.window!);
        if (win && wm.active !== win.id) wm.activate(win, false);
      }, 0);
    },
    { signal: abort.signal },
  );
  return {
    element,
    start() {
      // The first window sits right of the icon columns, as large as fits.
      // At phone widths CSS sizes it until the workspace grows.
      wm.placeFirst(apps.openFolder("projects"));
    },
    dispose() {
      // Popup menus live on the desktop but listen on the document.
      closeMenus();
      wm.dispose();
      taskbar.dispose();
      abort.abort();
      element.remove();
    },
  };
}
