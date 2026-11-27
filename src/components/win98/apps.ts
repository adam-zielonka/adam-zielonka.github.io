import { findProject } from "../../data/projects";
import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import type { Project } from "../../types/project";
import { createExplorer } from "./explorer";
import { createFind } from "./find";
import { menuBar, type MenuEntry } from "./menu";
import { messageBox } from "./message-box";
import { createNotepad } from "./notepad";
import { link, type Folder } from "./shared";
import type { DesktopWindow, WindowManager } from "./window-manager";
import type { StartMenu } from "./start-menu";

export const GAME_STATUS =
  "Ctrl+Alt releases the keyboard · Ctrl+Esc opens Start";

/**
 * Ctrl+Alt with no other key, the PC emulators' "release the mouse and
 * keyboard". AltGr never matches: browsers report it as "AltGraph", or as a
 * lone Control without altKey.
 */
export function isReleaseChord(event: KeyboardEvent) {
  return (
    ((event.key === "Control" && event.altKey) ||
      (event.key === "Alt" && event.ctrlKey)) &&
    !event.shiftKey &&
    !event.metaKey
  );
}

export const isStartChord = (event: KeyboardEvent) =>
  event.key === "Escape" && event.ctrlKey && !event.altKey && !event.metaKey;

/**
 * Projects opened this session, most recent first, for Start ▸ Documents.
 * Like Windows' recent documents it outlives a restart (not a reload).
 */
const recent: string[] = [];
export const recentProjects = (): readonly string[] => recent;
function rememberProject(id: string) {
  const index = recent.indexOf(id);
  if (index >= 0) recent.splice(index, 1);
  recent.unshift(id);
  recent.length = Math.min(recent.length, 10);
}

export type Apps = ReturnType<typeof createApps>;

/** Menu labels use '&' for mnemonics; names keep their literal ampersands. */
const literal = (text: string) => text.replaceAll("&", "&&");

/** The desktop's programs: Explorer, Find, Notepad, project windows and Help. */
export function createApps({
  wm,
  startMenu,
  signal,
  openItem,
}: {
  wm: WindowManager;
  startMenu: StartMenu;
  signal: AbortSignal;
  /** Runs a list item's action, for Explorer's File ▸ Open. */
  openItem: (item: HTMLElement) => void;
}) {
  const explorer = createExplorer({ wm, signal, open: openItem });
  const find = createFind({ wm, signal, openHelp: () => openHelp() });
  const notepad = createNotepad({ wm, signal });

  /**
   * Moves keyboard focus out of a captured demo until the user returns. It
   * goes to the window itself, where Enter hands it back to the game.
   */
  function releaseKeyboard(win: DesktopWindow) {
    win.keyboardReleased = true;
    if (wm.active !== win.id) wm.activate(win, false);
    win.element.focus({ preventScroll: true });
  }
  function openStartFromApp() {
    startMenu.toggle(true, true);
  }

  // Cross-origin demos (dev server, preview) cannot be observed directly; they
  // may opt in by posting these messages to the desktop.
  window.addEventListener(
    "message",
    event => {
      const type = (event.data as { type?: unknown } | null)?.type;
      if (type !== "portfolio98:release" && type !== "portfolio98:start")
        return;
      for (const win of wm.windows.values()) {
        if (!win.frame || event.source !== win.frame.contentWindow) continue;
        if (!event.source || event.origin !== win.demoOrigin) return;
        if (type === "portfolio98:release") releaseKeyboard(win);
        else openStartFromApp();
        return;
      }
    },
    { signal },
  );

  const openComputer = () => explorer.open("computer");
  const openFolder = (id: Folder) => explorer.open(`folder:${id}`);
  const openRecycle = () => explorer.open("recycle");
  const openFind = () => find.open();
  function watchDemo(win: DesktopWindow, iframe: HTMLIFrameElement) {
    let contentEvents = new AbortController();
    const focusApp = () => {
      startMenu.toggle(false);
      // Interacting with the demo gives it the keyboard again.
      win.keyboardReleased = false;
      if (wm.active !== win.id) wm.activate(win, false);
    };
    const contentKeydown = (event: KeyboardEvent) => {
      if (isStartChord(event)) {
        event.preventDefault();
        event.stopPropagation();
        openStartFromApp();
      } else if (isReleaseChord(event)) {
        event.preventDefault();
        event.stopPropagation();
        releaseKeyboard(win);
      }
    };
    iframe.addEventListener("focus", focusApp);
    iframe.addEventListener("load", () => {
      contentEvents.abort();
      contentEvents = new AbortController();
      // Our demos share the portfolio origin. Listen in their documents too:
      // switching directly between frames need not blur the parent window,
      // and keys pressed inside a game never reach the desktop otherwise.
      // Cross-origin demos still use the parent window's blur handler.
      try {
        const content = iframe.contentDocument;
        for (const event of ["pointerdown", "focusin"])
          content?.addEventListener(event, focusApp, {
            capture: true,
            signal: contentEvents.signal,
          });
        content?.addEventListener("keydown", contentKeydown, {
          capture: true,
          signal: contentEvents.signal,
        });
      } catch {
        // A redirected demo may have a different origin.
      }
    });
    // Enter on a released game's window hands the keyboard back to the game.
    win.element.addEventListener("keydown", event => {
      if (
        event.key !== "Enter" ||
        event.target !== win.element ||
        !win.gameFrame
      )
        return;
      event.preventDefault();
      win.keyboardReleased = false;
      win.gameFrame.focus({ preventScroll: true });
    });
    return () => contentEvents.abort();
  }

  /** Help ▸ About <Project>…: the icon, name, category and technologies. */
  function aboutProject(project: Project) {
    void messageBox({
      title: `About ${project.name}`,
      icon: project.id,
      body: `${project.name}\nCategory: ${project.category}\nTechnologies: ${project.stack.join(", ")}`,
    });
  }

  /** A project window's menu bar: File, View and Help, left-aligned. */
  function projectMenus(
    win: DesktopWindow,
    project: Project,
    signal: AbortSignal,
  ) {
    const bar = document.createElement("div");
    win.body.before(bar);
    const name = literal(project.name);
    const file: MenuEntry[] = [];
    if (project.demo)
      file.push({ label: "Open in &New Tab", href: project.demo });
    file.push({ label: "View &Source Code", href: project.source });
    if (project.releases)
      file.push({ label: "&Releases", href: project.releases });
    file.push("-", { label: "&Close", action: () => wm.closeWindow(win) });
    menuBar(
      bar,
      [
        { label: "&File", items: file },
        {
          label: "&View",
          items: () => [
            win.element.classList.contains("WinWindow--maximized")
              ? { label: "&Restore", action: () => wm.maximize(win) }
              : { label: "Ma&ximize", action: () => wm.maximize(win) },
          ],
        },
        {
          label: "&Help",
          items: [
            {
              label: `${name} &Help Topics`,
              action: () => openProjectHelp(project.id),
            },
            "-",
            {
              label: `&About ${name}…`,
              action: () => aboutProject(project),
            },
          ],
        },
      ],
      { label: `${project.name} menu`, signal },
    );
  }
  function openProject(id: string) {
    const project = findProject(id);
    if (!project) return;
    rememberProject(project.id);
    const existing = wm.windows.get(`project:${id}`);
    if (existing) {
      wm.activate(existing);
      return existing;
    }
    const win = wm.createWindow(`project:${id}`, project.name, project.id, {
      minWidth: 320,
      minHeight: 200,
    });
    const demo = project.windowsDemo ?? project.demo;
    const abort = new AbortController();
    signal.addEventListener("abort", () => abort.abort(), {
      signal: abort.signal,
    });
    // Keep the menu bar outside the scrolling body and never recreate a
    // running demo.
    projectMenus(win, project, abort.signal);
    win.body.classList.add("WinAppBody");
    // The sandbox is advisory: our demos share the portfolio's origin, and
    // allow-scripts with allow-same-origin lets a framed page lift it. It
    // still documents what a demo may do; allow="fullscreen" grants full
    // screen (the allowfullscreen attribute would only duplicate it).
    win.body.innerHTML = demo
      ? `<iframe class="WinAppFrame" src="${escape(demo)}" title="${escape(project.name)} demo" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-pointer-lock" allow="fullscreen; clipboard-write"></iframe>`
      : `<div class="WinEmpty">${windowsIcon(project.id)}<h2>${escape(project.name)}</h2><p>This project has no browser demo.</p><p>Use File ▸ ${project.releases ? "Releases or View Source Code" : "View Source Code"} to explore it.<br>Help ▸ ${escape(project.name)} Help Topics describes it.</p></div>`;
    const iframe = win.body.querySelector("iframe");
    let stopWatching: (() => void) | undefined;
    if (iframe && demo) {
      win.frame = iframe;
      win.demoOrigin = new URL(demo, location.href).origin;
      stopWatching = watchDemo(win, iframe);
      // The demo is still loading: a busy pointer until it arrives.
      win.element.dataset.loading = "";
      const loaded = () => delete win.element.dataset.loading;
      iframe.addEventListener("load", loaded, { once: true });
      iframe.addEventListener("error", loaded, { once: true });
      window.setTimeout(loaded, 15_000);
      // A cross-origin demo cannot be watched for presses: an inactive
      // window shields its frame, so a press activates the window first.
      if (win.demoOrigin !== location.origin) {
        win.body.dataset.shield = "";
        win.body.addEventListener(
          "pointerdown",
          event => {
            if (
              event.target !== win.body ||
              win.element.dataset.active === "true"
            )
              return;
            event.preventDefault();
            wm.activate(win, false);
            // The press was meant for the demo: it gets the keyboard.
            iframe.focus({ preventScroll: true });
          },
          { signal: abort.signal },
        );
      }
      if (project.windowsDemo) {
        win.gameFrame = iframe;
        iframe.focus({ preventScroll: true });
      }
    }
    win.dispose = () => {
      stopWatching?.();
      abort.abort();
    };
    win.status.textContent = project.windowsDemo
      ? GAME_STATUS
      : demo
        ? "Web demo · Blank or unavailable? Use File ▸ Open in New Tab · Description in Help"
        : "No browser demo · Description in Help";
    return win;
  }
  function openProjectHelp(id: string) {
    const project = findProject(id);
    if (!project) return;
    const win = wm.createWindow(`help:${id}`, `${project.name} Help`, "help");
    win.body.innerHTML = `<article class="WinProject"><header>${windowsIcon(project.id)}<div><small>${escape(project.category)} / PERSONAL PROJECT</small><h2>${escape(project.name)}</h2></div></header><p class="WinSummary">${escape(project.summary)}</p><div class="WinTags">${project.stack.map(item => `<span>${escape(item)}</span>`).join("")}</div><div class="WinReadme">${project.html}</div></article>`;
    win.status.textContent =
      "Project description · Your application stays open in its own window";
    return win;
  }
  const openAbout = () => notepad.open();
  function openContact() {
    const win = wm.createWindow("contact", "Address Book", "mail");
    win.body.innerHTML = `<article class="WinProject"><header>${windowsIcon("mail")}<div><small>ADDRESS BOOK</small><h2>Let's talk about code.</h2></div></header><p>Have a question, found a bug or have an idea? Find me on GitHub or open an issue in the project's repository.</p><p>${link("https://github.com/adam-zielonka", "adam-zielonka on GitHub")}</p></article>`;
    win.status.textContent = "1 contact · GitHub";
    return win;
  }
  function openHelp() {
    const win = wm.createWindow("help", "Portfolio 98 Help", "help");
    win.body.innerHTML = `<article class="WinProject WinHelp"><header>${windowsIcon("help")}<div><small>PORTFOLIO 98 HELP</small><h2>Getting around</h2></div></header>
      <h3>Opening</h3><p>Click an icon to select it and see its description; double-click it, or press Enter, to open it. On a touch screen, tap an icon to open it. Tab moves between the desktop, toolbars and lists, and the arrow keys or the first letters of a name move between icons. Start → Programs lists every project by folder; Start → Find → Projects… (F3) searches names, descriptions and technologies, in every folder or in one.</p>
      <h3>Shortcut menus</h3><p>Right-click an icon, the desktop, the taskbar or a title bar for its shortcut menu; on a touch screen, press and hold. Shift+F10 opens the menu of the selected item. An icon's Properties describe it, and the desktop's Properties hold the display settings. The taskbar's menu cascades or tiles the windows, or minimizes them all.</p>
      <h3>Exploring</h3><p>Back, Forward and Up move between folders, and the Address list jumps to any of them. Views switches between Large Icons, Small Icons, List and Details; in Details, click a column heading to sort, and click it again to reverse the order. The panel on the left describes the selected item. Web demos run in their own window.</p>
      <h3>Moving and sizing</h3><p>Drag a title bar to move its window, and drag a border, a corner or the size grip at the right end of the status bar to resize it. Maximize it with □ or by double-clicking the title bar, and use the same button to restore it. _ minimizes the window to its taskbar button; click the button to bring it back. The icon at the left of the title bar opens the window's menu (Restore, Minimize, Maximize and Close); double-click it to close the window.</p>
      <h3>Taskbar</h3><p>Show Desktop, next to Start, minimizes every window; press it again to bring them all back. Use the arrow keys to move between taskbar buttons.</p>
      <h3>Shortcuts</h3><dl class="WinHelpKeys"><dt>Ctrl+Esc</dt><dd>Open Start</dd><dt>Esc</dt><dd>Close the open menu</dd><dt>Alt+F4</dt><dd>Close the window or dialog you are using; on the desktop, shut down</dd><dt>Alt+Space</dt><dd>Open the window's menu</dd><dt>Shift+F10</dt><dd>Open the shortcut menu</dd><dt>F3</dt><dd>Find projects; in Notepad, find the next match</dd><dt>Enter</dt><dd>Open the selected icon</dd><dt>Backspace</dt><dd>Go up one folder</dd><dt>Alt+← / Alt+→</dt><dd>Go back or forward</dd><dt>Ctrl+Alt</dt><dd>Release a game's keyboard; click the game to return</dd></dl><p>Your browser or operating system may keep some of these keys for itself; Start, the taskbar and every window control also work without them.</p>
      <h3>Leaving</h3><p>Start → Shut Down… can stand by, shut down, restart, or restart in MS-DOS mode. MS-DOS Prompt opens the terminal; type EXIT there to return to Portfolio 98.</p></article>`;
    win.status.textContent = "Portfolio 98 Help";
    return win;
  }
  return {
    /** F3 inside Notepad searches its text instead of the portfolio. */
    notepadFindNext: (win: DesktopWindow) => notepad.findNext(win),
    openAbout,
    openComputer,
    openContact,
    openFind,
    openFolder,
    openHelp,
    openProject,
    openProjectHelp,
    openRecycle,
    releaseKeyboard,
  };
}
