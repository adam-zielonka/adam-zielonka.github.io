import { projects, findProject } from "../data/projects";
import { windowsIcon } from "../data/windows-icons";
import logo from "../assets/portfolio98-logo.png";
import { escape } from "../utils/escape";
import type { Project } from "../types/project";

type Folder = "projects" | "games" | "apps" | "tools" | "lab";
const folders: {
  id: Folder;
  name: string;
  icon: string;
  categories: Project["category"][];
}[] = [
  { id: "projects", name: "My Projects", icon: "folder", categories: [] },
  { id: "games", name: "Games", icon: "games", categories: ["Game"] },
  { id: "apps", name: "Applications", icon: "web", categories: ["App"] },
  { id: "tools", name: "Tools", icon: "tools", categories: ["Tool"] },
  {
    id: "lab",
    name: "Experiments & Learning",
    icon: "computer",
    categories: ["Experiment", "Learning"],
  },
];
type DesktopWindow = {
  id: string;
  element: HTMLElement;
  body: HTMLElement;
  task: HTMLButtonElement;
  title: HTMLElement;
  status: HTMLElement;
  maximize: HTMLButtonElement;
  folder?: Folder;
  list: boolean;
  dispose?: () => void;
};

const button = (action: string, label: string, icon?: string, className = "") =>
  `<button type="button" class="${className}" data-win-action="${escape(action)}">${icon ? windowsIcon(icon) : ""}<span>${escape(label)}</span></button>`;
const link = (url: string, label: string) =>
  `<a class="WinButton" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;

/** A portfolio desktop with web demos embedded in project windows. */
export function WindowsDesktop(onExit: () => void, onShutdown: () => void) {
  const element = document.createElement("section");
  element.className = "Win98";
  element.setAttribute("aria-label", "Windows 98 portfolio desktop");
  element.tabIndex = -1;
  element.innerHTML = `
    <div class="WinWorkspace">
      <nav class="WinDesktopIcons" aria-label="Desktop shortcuts">
        ${button("computer", "My Computer", "computer", "WinShortcut")}
        ${button("folder:projects", "My Projects", "folder", "WinShortcut")}
        ${button("folder:games", "Games", "games", "WinShortcut")}
        ${button("project:paintaz", "paintAZ", "paintaz", "WinShortcut")}
        ${button("about", "About Adam.txt", "info", "WinShortcut")}
        ${button("contact", "Contact", "mail", "WinShortcut")}
        ${button("recycle", "Recycle Bin", "recycle", "WinShortcut")}
        ${button("exit", "MS-DOS Prompt", "terminal", "WinShortcut")}
      </nav>
      <div class="WinWallpaper" aria-hidden="true"><span>Adam Zielonka</span><strong>Portfolio<span>98</span></strong><small>PERSONAL PROJECTS · ALWAYS CURIOUS</small></div>
      <div class="WinWindowLayer"></div>
    </div>
    <nav id="win-start-menu" class="WinStartMenu" aria-label="Start menu" hidden>
      <div class="WinStartRail" aria-hidden="true">Portfolio <strong>98</strong></div>
      <div class="WinStartItems">
        <div class="WinStartUser">Adam Zielonka<small>Personal computer</small></div>
        ${button("folder:projects", "Programs", "folder")}
        ${button("folder:games", "Games", "games")}
        ${button("folder:tools", "Tools", "tools")}
        ${button("about", "About this portfolio", "info")}
        ${button("find", "Find projects…", "find")}
        ${button("contact", "Find me on GitHub", "mail")}
        <hr>${button("exit", "Restart in MS-DOS mode…", "terminal")}
        ${button("shutdown", "Shut Down…", "shutdown")}
      </div>
    </nav>
    <footer class="WinTaskbar">
      <button type="button" class="WinButton WinStart" data-win-action="start" aria-expanded="false" aria-controls="win-start-menu"><img class="Win98Icon" src="${logo}" alt="" draggable="false" width="32" height="24"><b>Start</b></button>
      <button type="button" class="WinShowDesktop" data-win-action="desktop" aria-label="Show desktop" title="Show desktop">${windowsIcon("computer")}</button>
      <div class="WinTasks" aria-label="Open windows"></div>
      <div class="WinTray">${windowsIcon("computer")}<time></time></div>
    </footer>`;
  const workspace = element.querySelector<HTMLElement>(".WinWorkspace")!;
  const layer = element.querySelector<HTMLElement>(".WinWindowLayer")!;
  const tasks = element.querySelector<HTMLElement>(".WinTasks")!;
  const start = element.querySelector<HTMLButtonElement>(".WinStart")!;
  const menu = element.querySelector<HTMLElement>(".WinStartMenu")!;
  const windows = new Map<string, DesktopWindow>();
  let active: string | undefined;
  let zIndex = 0;
  let pointerInteraction = false;
  let drag:
    | {
        win: DesktopWindow;
        x: number;
        y: number;
        left: number;
        top: number;
        pointer: number;
        handle: HTMLElement;
      }
    | undefined;
  const abort = new AbortController();
  const clock = element.querySelector("time")!;
  function updateClock() {
    const now = new Date();
    clock.dateTime = now.toISOString();
    clock.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    clock.title = now.toLocaleDateString([], { dateStyle: "full" });
  }
  updateClock();
  const timer = window.setInterval(updateClock, 30_000);

  function toggleStart(open: boolean, focus = false) {
    menu.hidden = !open;
    start.setAttribute("aria-expanded", String(open));
    if (focus)
      (open ? menu.querySelector<HTMLButtonElement>("button") : start)?.focus();
  }
  function closeHelpMenus(except?: Node) {
    for (const help of element.querySelectorAll<HTMLDetailsElement>(
      ".WinHelpMenu[open]",
    )) {
      if (!except || !help.contains(except)) help.open = false;
    }
  }
  function activate(win?: DesktopWindow, focus = true) {
    active = win?.id;
    for (const item of windows.values()) {
      const selected = item === win;
      item.element.dataset.active = String(selected);
      item.task.setAttribute("aria-pressed", String(selected));
    }
    if (!win) return;
    win.element.hidden = false;
    win.element.style.zIndex = String(++zIndex);
    if (focus) win.element.focus({ preventScroll: true });
  }
  function nextWindow() {
    const visible = [...windows.values()].filter(win => !win.element.hidden);
    activate(
      visible.sort(
        (a, b) => +b.element.style.zIndex - +a.element.style.zIndex,
      )[0],
    );
    if (!active) start.focus();
  }
  function closeWindow(win: DesktopWindow) {
    win.dispose?.();
    win.element.remove();
    win.task.remove();
    windows.delete(win.id);
    nextWindow();
  }
  function maximize(win: DesktopWindow) {
    const maximized = win.element.classList.toggle("WinWindow--maximized");
    win.maximize.setAttribute(
      "aria-label",
      `${maximized ? "Restore" : "Maximize"} ${win.title.textContent}`,
    );
    win.maximize.title = maximized ? "Restore" : "Maximize";
    win.maximize.textContent = maximized ? "❐" : "□";
  }
  function createWindow(
    id: string,
    title: string,
    icon: string,
  ): DesktopWindow {
    const existing = windows.get(id);
    if (existing) {
      activate(existing);
      return existing;
    }
    const frame = document.createElement("section");
    frame.className = "WinWindow";
    frame.dataset.window = id;
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-label", title);
    frame.tabIndex = -1;
    const offset = (windows.size % 5) * 18;
    frame.style.left = `${Math.min(126 + offset, Math.max(0, workspace.clientWidth - 340))}px`;
    frame.style.top = `${24 + offset}px`;
    frame.innerHTML = `<header class="WinTitlebar">${windowsIcon(icon)}<strong>${escape(title)}</strong><div class="WinWindowControls"><button type="button" data-win-action="minimize" aria-label="Minimize ${escape(title)}" title="Minimize">_</button><button type="button" data-win-action="maximize" aria-label="Maximize ${escape(title)}" title="Maximize">□</button><button type="button" data-win-action="close" aria-label="Close ${escape(title)}" title="Close">×</button></div></header><div class="WinWindowBody"></div><footer class="WinStatus"></footer>`;
    const task = document.createElement("button");
    task.type = "button";
    task.className = "WinButton WinTask";
    task.innerHTML = `${windowsIcon(icon)}<span>${escape(title)}</span>`;
    task.title = title;
    task.addEventListener("click", () => {
      if (active === id && !frame.hidden) {
        frame.hidden = true;
        nextWindow();
      } else activate(win);
    });
    const win: DesktopWindow = {
      id,
      element: frame,
      task,
      list: false,
      body: frame.querySelector(".WinWindowBody")!,
      title: frame.querySelector(".WinTitlebar strong")!,
      status: frame.querySelector(".WinStatus")!,
      maximize: frame.querySelector('[data-win-action="maximize"]')!,
    };
    frame.addEventListener("pointerdown", () => activate(win, false));
    frame.addEventListener("focusin", () => {
      if (active !== win.id) activate(win, false);
    });
    frame.querySelector(".WinTitlebar")!.addEventListener("dblclick", event => {
      if (!(event.target as Element).closest("button")) maximize(win);
    });
    windows.set(id, win);
    layer.append(frame);
    tasks.append(task);
    activate(win);
    return win;
  }
  function openExplorer(name: string) {
    const title = `${name} — Explorer`;
    const win = createWindow("explorer", title, "folder");
    win.title.textContent = title;
    win.element.setAttribute("aria-label", title);
    win.task.querySelector("span")!.textContent = name;
    win.task.title = title;
    for (const control of win.element.querySelectorAll<HTMLButtonElement>(
      ".WinWindowControls button",
    ))
      control.setAttribute("aria-label", `${control.title} ${title}`);
    return win;
  }
  function openComputer() {
    const win = openExplorer("My Computer");
    win.folder = undefined;
    win.body.innerHTML = `<div class="WinAddress"><span>Address</span><div>${windowsIcon("computer")}My Computer</div></div>
      <div class="WinFiles WinDriveList">${button("folder:projects", "Portfolio (C:)", "drive", "WinShortcut")}</div>`;
    win.status.textContent = "1 drive";
  }
  function projectButton(project: Project, list: boolean) {
    return `<button type="button" class="WinShortcut" data-win-action="project:${escape(project.id)}" title="${escape(project.summary)}">${windowsIcon(project.id)}<span>${escape(project.name)}</span>${list ? `<small>${escape(project.category)}</small>` : ""}</button>`;
  }
  function openFolder(id: Folder) {
    const folder = folders.find(item => item.id === id)!;
    const win = openExplorer(folder.name);
    win.folder = id;
    const selected = projects.filter(
      project =>
        !folder.categories.length ||
        folder.categories.includes(project.category),
    );
    win.body.innerHTML = `<div class="WinToolbar">${button(id === "projects" ? "computer" : "folder:projects", "Up", "folder", "WinButton")}${button("view", win.list ? "Large icons" : "List", undefined, "WinButton")}${button("about", "About", "info", "WinButton")}</div>
      <div class="WinAddress"><span>Address</span><div>${windowsIcon(folder.icon)}C:\\Portfolio${id === "projects" ? "" : `\\${escape(folder.name)}`}</div></div>
      <div class="WinExplorer"><aside class="WinExplorerSide">${windowsIcon(folder.icon)}<h2>${escape(folder.name)}</h2><p>Curiosity, written in code.</p><hr><nav aria-label="Project folders">${folders.map(item => `<button type="button" data-win-action="folder:${item.id}" ${item.id === id ? 'aria-current="page"' : ""}>${windowsIcon(item.icon)}<span>${escape(item.name)}</span></button>`).join("")}</nav><small>${projects.length} personal projects<br>Made to be explored.</small></aside>
      <div class="WinFiles ${win.list ? "WinFiles--list" : ""}"><nav class="WinFolderStrip" aria-label="Folders">${(id === "projects" ? folders.slice(1) : []).map(item => button(`folder:${item.id}`, item.name, "folder", "WinShortcut")).join("")}</nav><div class="WinProjectGrid">${selected.map(project => projectButton(project, win.list)).join("")}</div></div></div>`;
    const count =
      selected.length + (id === "projects" ? folders.length - 1 : 0);
    win.status.textContent = `${count} object(s) · Click an icon to open · Web demos run in a window`;
  }
  function openFind() {
    const win = createWindow("find", "Find Projects", "find");
    if (!win.body.querySelector("form")) {
      win.body.innerHTML = `<form class="WinFindForm"><label for="win-find-query">Name or technology</label><input id="win-find-query" type="text" autocomplete="off"><button class="WinButton" type="submit">Find Now</button></form>
        <div class="WinFiles WinFiles--list WinFindResults"><div class="WinProjectGrid"></div></div>`;
      const form = win.body.querySelector("form")!;
      const input = form.querySelector("input")!;
      const results = win.body.querySelector<HTMLElement>(".WinProjectGrid")!;
      win.status.setAttribute("role", "status");
      win.status.textContent = "Look in: C:\\Portfolio";
      form.addEventListener("submit", event => {
        event.preventDefault();
        const query = input.value.trim().toLowerCase();
        const matches = projects.filter(project =>
          [project.name, project.id, ...project.stack].some(value =>
            value.toLowerCase().includes(query),
          ),
        );
        results.innerHTML = matches
          .map(project => projectButton(project, true))
          .join("");
        win.status.textContent = matches.length
          ? `${matches.length} project${matches.length === 1 ? "" : "s"} found`
          : "No projects found. Try another name or technology.";
      });
    }
    win.body.querySelector("input")!.focus();
  }
  function openProject(id: string) {
    const project = findProject(id);
    if (!project) return;
    const existing = windows.get(`project:${id}`);
    if (existing) {
      activate(existing);
      return;
    }
    const win = createWindow(`project:${id}`, project.name, project.id);
    // Keep controls outside the scrolling body and never recreate a running demo.
    win.body.insertAdjacentHTML(
      "beforebegin",
      `<nav class="WinAppMenu" aria-label="${escape(project.name)} menu">${project.demo ? link(project.demo, "Open in new tab") : ""}${link(project.source, "Source code")}${project.releases ? link(project.releases, "Releases") : ""}<details class="WinHelpMenu"><summary>Help</summary><div class="WinHelpDropdown">${button(`project-help:${id}`, `About ${project.name}…`, "info")}</div></details></nav>`,
    );
    win.body.classList.add("WinAppBody");
    win.body.innerHTML = project.demo
      ? `<iframe class="WinAppFrame" src="${escape(project.demo)}" title="${escape(project.name)} demo" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-pointer-lock" allow="fullscreen; clipboard-write" allowfullscreen></iframe>`
      : `<div class="WinEmpty">${windowsIcon(project.id)}<h2>${escape(project.name)}</h2><p>This project has no browser demo.</p><p>Use ${project.releases ? "Releases or Source code" : "Source code"} above to explore it.<br>Open Help for the project description.</p></div>`;
    const iframe = win.body.querySelector("iframe");
    if (iframe) {
      let contentEvents = new AbortController();
      const focusApp = () => {
        closeHelpMenus();
        toggleStart(false);
        if (active !== win.id) activate(win, false);
      };
      iframe.addEventListener("focus", focusApp);
      iframe.addEventListener("load", () => {
        contentEvents.abort();
        contentEvents = new AbortController();
        // Our demos share the portfolio origin. Listen in their documents too:
        // switching directly between frames need not blur the parent window.
        // Cross-origin demos still use the parent window's blur handler.
        try {
          const content = iframe.contentDocument;
          for (const event of ["pointerdown", "focusin"])
            content?.addEventListener(event, focusApp, {
              capture: true,
              signal: contentEvents.signal,
            });
        } catch {
          // A redirected demo may have a different origin.
        }
      });
      win.dispose = () => contentEvents.abort();
    }
    win.status.textContent = project.demo
      ? "Web demo · Blank or unavailable? Use Open in new tab · Description in Help"
      : "No browser demo · Description in Help";
  }
  function openProjectHelp(id: string) {
    const project = findProject(id);
    if (!project) return;
    closeHelpMenus();
    const win = createWindow(`help:${id}`, `${project.name} — Help`, "info");
    win.body.innerHTML = `<article class="WinProject"><header>${windowsIcon(project.id)}<div><small>${escape(project.category)} / PERSONAL PROJECT</small><h2>${escape(project.name)}</h2></div></header><p class="WinSummary">${escape(project.summary)}</p><div class="WinTags">${project.stack.map(item => `<span>${escape(item)}</span>`).join("")}</div><div class="WinReadme">${project.html}</div></article>`;
    win.status.textContent =
      "Project description · Your application stays open in its own window";
  }
  function openAbout() {
    const win = createWindow("about", "About Adam.txt — Notepad", "info");
    win.body.innerHTML = `<article class="WinNotepad"><p>HELLO, WORLD.</p><h2>I'm Adam Zielonka.</h2><p>I build apps, tools and experiments.<br>This is my little corner of the internet.</p><p>From Pascal games to modern web applications, these projects are a record of learning by making things.</p><hr><p>Welcome to Portfolio 98.</p><p>Explore the folders, open a project and try a demo or read the code.</p><p>Click or tap icons to open them. Drag a title bar to move a window. Use the taskbar to switch between windows.</p><p>Back to the terminal?<br>Start → Restart in MS-DOS mode.</p></article>`;
    win.status.textContent = "About Adam.txt · Personal portfolio";
  }
  function openContact() {
    const win = createWindow("contact", "Contact — Address Book", "mail");
    win.body.innerHTML = `<article class="WinProject"><header>${windowsIcon("mail")}<div><small>ADDRESS BOOK</small><h2>Let's talk about code.</h2></div></header><p>Have a question, found a bug or have an idea? Find me on GitHub or open an issue in the project's repository.</p><p>${link("https://github.com/adam-zielonka", "adam-zielonka on GitHub")}</p></article>`;
    win.status.textContent = "1 contact · GitHub";
  }
  element.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const control = target.closest<HTMLElement>("[data-win-action]");
    const action = control?.dataset.winAction;
    if (action !== "start" && !target.closest(".WinStartMenu"))
      toggleStart(false);
    if (!action) return;
    const frame = control!.closest<HTMLElement>("[data-window]");
    const win = frame ? windows.get(frame.dataset.window!) : undefined;
    if (action === "start") {
      toggleStart(menu.hidden === true, event.detail === 0);
      return;
    }
    toggleStart(false);
    if (action.startsWith("folder:")) openFolder(action.slice(7) as Folder);
    else if (action.startsWith("project:")) openProject(action.slice(8));
    else if (action.startsWith("project-help:"))
      openProjectHelp(action.slice(13));
    else if (action === "computer") openComputer();
    else if (action === "find") openFind();
    else if (action === "about") openAbout();
    else if (action === "contact") openContact();
    else if (action === "exit") onExit();
    else if (action === "shutdown") onShutdown();
    else if (action === "recycle") {
      const bin = createWindow("recycle", "Recycle Bin", "recycle");
      bin.body.innerHTML = `<div class="WinEmpty">${windowsIcon("recycle")}<h2>Recycle Bin is empty.</h2><p>No projects were harmed in the making of this portfolio.</p></div>`;
      bin.status.textContent = "0 objects";
    } else if (action === "desktop") {
      for (const item of windows.values()) item.element.hidden = true;
      activate(undefined);
    } else if (win) {
      if (action === "close") closeWindow(win);
      if (action === "minimize") {
        win.element.hidden = true;
        nextWindow();
      }
      if (action === "maximize") maximize(win);
      if (action === "view" && win.folder) {
        win.list = !win.list;
        openFolder(win.folder);
      }
    }
  });
  element.addEventListener("keydown", event => {
    if (
      event.key === "F3" &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      toggleStart(false);
      closeHelpMenus();
      openFind();
      return;
    }
    if (event.key === "Escape") {
      const help =
        element.querySelector<HTMLDetailsElement>(".WinHelpMenu[open]");
      if (help) {
        event.preventDefault();
        help.open = false;
        help.querySelector("summary")!.focus();
        return;
      }
    }
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      toggleStart(false, true);
    }
    if (event.altKey && event.key === "F4" && active) {
      event.preventDefault();
      closeWindow(windows.get(active)!);
    }
    if (
      !menu.hidden &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const items = [...menu.querySelectorAll<HTMLButtonElement>("button")];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[next].focus();
    }
  });
  // Touch browsers may focus the desktop/container before synthesizing click.
  // Keep the menu mounted through that sequence; activate only on click, so
  // scrolling/cancelled touches never launch an item. Keyboard Tab still dismisses.
  document.addEventListener(
    "pointerdown",
    event => {
      pointerInteraction = true;
      closeHelpMenus(event.target instanceof Node ? event.target : undefined);
      if (
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !start.contains(event.target)
      )
        toggleStart(false);
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
    if (!pointerInteraction && event.relatedTarget instanceof Node)
      closeHelpMenus(event.relatedTarget);
    if (
      !pointerInteraction &&
      event.target instanceof Node &&
      (menu.contains(event.target) || start.contains(event.target)) &&
      event.relatedTarget instanceof Node &&
      !menu.contains(event.relatedTarget) &&
      event.relatedTarget !== start
    )
      toggleStart(false);
  });
  function stopDrag() {
    if (drag?.handle.hasPointerCapture(drag.pointer))
      drag.handle.releasePointerCapture(drag.pointer);
    drag = undefined;
  }
  element.addEventListener("pointerdown", event => {
    const target = event.target as Element;
    const handle = target.closest<HTMLElement>(".WinTitlebar");
    if (!handle || target.closest("button") || event.button !== 0) return;
    const win = windows.get(handle.parentElement!.dataset.window!)!;
    if (
      win.element.classList.contains("WinWindow--maximized") ||
      workspace.clientWidth <= 540
    )
      return;
    event.preventDefault();
    drag = {
      win,
      handle,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: win.element.offsetLeft,
      top: win.element.offsetTop,
    };
    handle.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { win, left, top, x, y } = drag;
    win.element.style.left = `${Math.max(0, Math.min(workspace.clientWidth - win.element.offsetWidth, left + event.clientX - x))}px`;
    win.element.style.top = `${Math.max(0, Math.min(workspace.clientHeight - win.element.offsetHeight, top + event.clientY - y))}px`;
  });
  element.addEventListener("pointerup", stopDrag);
  element.addEventListener("pointercancel", stopDrag);
  window.addEventListener(
    "blur",
    () => {
      stopDrag();
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
        closeHelpMenus();
        toggleStart(false);
        const frame = focused.closest<HTMLElement>("[data-window]")!;
        const win = windows.get(frame.dataset.window!);
        if (win && active !== win.id) activate(win, false);
      }, 0);
    },
    { signal: abort.signal },
  );
  const observer = new ResizeObserver(() => {
    for (const win of windows.values()) {
      win.element.style.left = `${Math.max(0, Math.min(win.element.offsetLeft, workspace.clientWidth - win.element.offsetWidth))}px`;
      win.element.style.top = `${Math.max(0, Math.min(win.element.offsetTop, workspace.clientHeight - win.element.offsetHeight))}px`;
    }
  });
  observer.observe(workspace);
  return {
    element,
    start() {
      openFolder("projects");
    },
    dispose() {
      stopDrag();
      for (const win of windows.values()) win.dispose?.();
      window.clearInterval(timer);
      observer.disconnect();
      abort.abort();
      element.remove();
    },
  };
}
