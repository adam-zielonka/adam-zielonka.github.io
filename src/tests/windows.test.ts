import { readFileSync } from "node:fs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest";
import type { Store } from "../store/store";
import { projects } from "../data/projects";
import { commandFromHash, hashFromCommand } from "../utils/routes";
import { startupCommands } from "../utils/boot";
import { windowsIcon } from "../data/windows-icons";

let store: Store;
// Happy DOM emits hashchange after pushState/replaceState, unlike browsers.
// Suppress those synthetic URL events; route tests dispatch their own event.
const suppressHistoryHashChange = (event: HashChangeEvent) => {
  if (event.newURL) event.stopImmediatePropagation();
};
const desktop = () => document.querySelector<HTMLElement>(".Win98")!;
const explorer = () =>
  desktop().querySelector<HTMLElement>('[data-window="explorer"]')!;
const click = (action: string, root: ParentNode = desktop()) => {
  const button = root.querySelector<HTMLButtonElement>(
    `[data-win-action="${action}"]`,
  );
  expect(button, action).not.toBeNull();
  button!.click();
};

const win = (id: string) =>
  desktop().querySelector<HTMLElement>(`[data-window="${id}"]`)!;
/** Explorer's file-pane items (all of them, or only projects). */
const files = (selector = "") => [
  ...explorer().querySelectorAll<HTMLElement>(
    `.WinFiles [data-list-item]${selector}`,
  ),
];
const projectFiles = () => files('[data-win-action^="project:"]');
/** Explorer's Standard Buttons and Address field. */
const tool = (command: string) =>
  explorer().querySelector<HTMLButtonElement>(`[data-explorer="${command}"]`)!;
/** Opens a window from Start's top level, e.g. Help. */
const openFromStart = (label: string) => {
  click("start");
  menuItem(label).click();
};
/** The open Start menu (null while closed); cascades are separate menus. */
const startMenu = () => desktop().querySelector<HTMLElement>(".WinStartMenu");
/** Picks a choice in the open Shut Down dialog. */
const choose = (value: string) => {
  desktop().querySelector<HTMLInputElement>(
    `.WinMessageBox input[value="${value}"]`,
  )!.checked = true;
};
const key = (
  target: EventTarget,
  value: string,
  init: KeyboardEventInit = {},
) => {
  const event = new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};
const press = (value: string, init?: KeyboardEventInit) =>
  key(document.activeElement ?? desktop(), value, init);
/** Opens Start ▸ Shut Down… with the keyboard. */
const openShutDown = () => {
  click("start");
  menuItem("Shut Down…").click();
  return desktop().querySelector<HTMLElement>(".WinMessageBox")!;
};
const messageButton = (box: ParentNode, id: string) =>
  box.querySelector<HTMLButtonElement>(`[data-message-button="${id}"]`)!;
/** An item of a visible open menu, found by its label. */
const menuItem = (label: string) => {
  const item = [
    ...desktop().querySelectorAll<HTMLElement>(
      ".WinMenu:not([hidden]) .WinMenuItem",
    ),
  ].find(
    element => element.querySelector(".WinMenuLabel")?.textContent === label,
  );
  expect(item, label).toBeDefined();
  return item!;
};
const origin = (element: HTMLElement) => [
  parseFloat(element.style.left),
  parseFloat(element.style.top),
];
const reopen = async () => {
  window.terminal.closeWindows();
  await store.system.addCommand("windows", {
    animateCommand: false,
    focus: true,
  });
};
/**
 * Happy DOM has no layout. Give the workspace a size, windows their CSS size
 * (or their inline model size) and lay desktop icons out in 96 px rows that
 * flow into 106 px columns, as windows.scss does.
 */
function mockLayout(width: number, height: number) {
  const layout = { width, height };
  const proto = HTMLElement.prototype;
  const is = (element: HTMLElement, name: string) =>
    element.classList.contains(name);
  const iconIndex = (element: HTMLElement) =>
    [...element.parentElement!.children].indexOf(element);
  const rows = () => Math.max(1, Math.floor((layout.height - 24) / 96));
  vi.spyOn(proto, "clientWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return is(this, "WinWorkspace") ? layout.width : 0;
  });
  vi.spyOn(proto, "clientHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return is(this, "WinWorkspace") ? layout.height : 0;
  });
  vi.spyOn(proto, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (is(this, "WinWindow"))
      return this.style.width
        ? parseFloat(this.style.width)
        : layout.width <= 700
          ? layout.width - 118
          : Math.min(740, layout.width - 144);
    return this.closest(".WinDesktopIcons") && is(this, "WinShortcut") ? 98 : 0;
  });
  vi.spyOn(proto, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!is(this, "WinWindow")) return 0;
    return this.style.height
      ? parseFloat(this.style.height)
      : Math.min(510, layout.height - 48);
  });
  vi.spyOn(proto, "offsetLeft", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (is(this, "WinDesktopIcons")) return 10;
    if (is(this, "WinShortcut") && this.closest(".WinDesktopIcons"))
      return Math.floor(iconIndex(this) / rows()) * 106;
    return 0;
  });
  return layout;
}
/** Replaces ResizeObserver so a test can deliver the workspace callback. */
function captureResizeObserver() {
  const callbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  return () => callbacks.at(-1)!([], {} as ResizeObserver);
}

beforeAll(async () => {
  window.addEventListener("hashchange", suppressHistoryHashChange, true);
  document.body.innerHTML =
    '<div class="CRTScreen"><nav class="QuickCommands"><a href="#windows" data-command="windows">windows</a></nav><div id="root"></div><div id="already-inert" inert></div></div><button data-toggle-power></button><p id="command-status"></p>';
  localStorage.setItem("portfolio-animations", "false");
  await import("../main");
  store = window.store;
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
});
beforeEach(async () => {
  store.system.animations = false;
  await store.system.addCommand("windows", {
    animateCommand: false,
    focus: true,
  });
});
afterEach(() => {
  window.terminal.closeWindows();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
afterAll(() => {
  window.removeEventListener("hashchange", suppressHistoryHashChange, true);
  document.body.replaceChildren();
});

test("launches inside CRT, completes the command and keeps focus out of the inert terminal", () => {
  expect(desktop().parentElement?.className).toBe("CRTScreen");
  expect(store.system.isInputAllowed).toBe(true);
  expect(document.getElementById("root")!.inert).toBe(true);
  expect(desktop().contains(document.activeElement)).toBe(true);
  expect(location.hash).toBe("#windows");
  expect(projectFiles()).toHaveLength(projects.length);
  expect(store.commands.helpLines.join("")).toContain("windows");
  expect(store.commands.getCompletions("wind")).toContain("windows");
});

test("supports the win alias and direct links, including power-on startup", async () => {
  expect(commandFromHash("#windows")).toBe("windows");
  expect(hashFromCommand("win")).toBe("#windows");
  expect(startupCommands("#windows")).toEqual(["windows"]);
  await store.system.addCommand("win", { animateCommand: false });
  expect(document.querySelectorAll(".Win98")).toHaveLength(1);
});

test("filters folders without duplicating Explorer and switches views", () => {
  click("folder:games");
  const gameIds = projects
    .filter(project => project.category === "Game")
    .map(project => `project:${project.id}`);
  expect(files().map(item => item.dataset.winAction)).toEqual(gameIds);
  expect(desktop().querySelectorAll('[data-window="explorer"]')).toHaveLength(
    1,
  );
  // Views cycles Large Icons, Small Icons, List and Details.
  tool("views").click();
  expect(explorer().querySelector(".WinFileList--small")).not.toBeNull();
  tool("views").click();
  expect(explorer().querySelector(".WinFileList--list")).not.toBeNull();
  tool("views").click();
  expect(explorer().querySelector("table.WinDetails")).not.toBeNull();
  tool("views").click();
  expect(explorer().querySelector(".WinFileList--large")).not.toBeNull();
  // The view belongs to the window and survives navigation.
  tool("views").click();
  click("folder:projects", explorer());
  expect(explorer().querySelector(".WinFileList--small")).not.toBeNull();
  expect(projectFiles()).toHaveLength(projects.length);
  // Folders and projects share one collection, folders first.
  expect(
    files()
      .slice(0, 4)
      .map(item => item.textContent),
  ).toEqual(["Games", "Applications", "Tools", "Experiments & Learning"]);
});

test("navigates up to My Computer and keeps Explorer captions and icons in sync", () => {
  const win = explorer();
  const task = desktop().querySelector<HTMLButtonElement>(".WinTask")!;
  const captionIcon = () =>
    win.querySelector(".WinSysMenu > .Win98Icon")!.innerHTML;
  const taskIcon = () => task.querySelector(".Win98Icon")!.innerHTML;
  // Captions and task buttons use the 16 px art.
  const icon = (name: string) => {
    const host = document.createElement("div");
    host.innerHTML = windowsIcon(name, 16);
    return host.firstElementChild!.innerHTML;
  };
  click("folder:games");
  expect(task.textContent).toBe("Games");
  expect(captionIcon()).toBe(icon("games"));
  click("minimize", win);
  task.click();
  expect(win.hidden).toBe(false);
  tool("up").click();
  expect(win.getAttribute("aria-label")).toBe("My Projects");
  tool("up").click();
  expect(task.dataset.tip).toBe("My Computer");
  expect(win.querySelector(".WinTitlebar strong")!.textContent).toBe(
    "My Computer",
  );
  expect(
    win.querySelector('[data-win-action="close"]')?.getAttribute("aria-label"),
  ).toBe("Close My Computer");
  expect(captionIcon()).toBe(icon("computer"));
  expect(taskIcon()).toBe(icon("computer"));
  expect(tool("up").getAttribute("aria-disabled")).toBe("true");
  click("folder:projects", win);
  expect(explorer()).toBe(win);
  expect(task.textContent).toBe("My Projects");
  // An open plain folder shows the open folder.
  expect(captionIcon()).toBe(icon("folder-open"));
  expect(taskIcon()).toBe(icon("folder-open"));
  click("computer", desktop().querySelector(".WinDesktopIcons")!);
  expect(win.textContent).toContain("Portfolio (C:)");
});

test("Find searches the catalog and retains results when reopening a running demo", () => {
  click("start");
  menuItem("Find").click();
  menuItem("Projects…").click();
  const find = desktop().querySelector<HTMLElement>('[data-window="find"]')!;
  const named = find.querySelector<HTMLInputElement>('input[name="named"]')!;
  const text = find.querySelector<HTMLInputElement>('input[name="text"]')!;
  const search = (query: string, field = named) => {
    named.value = "";
    text.value = "";
    field.value = query;
    find.querySelector<HTMLButtonElement>('[type="submit"]')!.click();
  };
  const results = () =>
    find.querySelectorAll(".WinFindResults [data-list-item]");
  expect(document.activeElement).toBe(named);
  search("no match here");
  expect(find.querySelector('[role="status"]')?.textContent).toBe(
    "There are no items to show in this view.",
  );
  search("");
  expect(results()).toHaveLength(projects.length);
  search("  PAINTaz ");
  expect(results()).toHaveLength(1);
  click("project:paintaz", find);
  const frame = desktop().querySelector("iframe");
  desktop().dispatchEvent(
    new KeyboardEvent("keydown", { key: "F3", bubbles: true }),
  );
  expect(document.activeElement).toBe(named);
  expect(results()).toHaveLength(1);
  // Technologies are part of what Containing text searches.
  search("webassembly", text);
  click("project:paintaz", find);
  expect(desktop().querySelector("iframe")).toBe(frame);
});

/** A menu-bar title of a window, such as "Help". */
const barItem = (window: HTMLElement, label: string) => {
  const item = [
    ...window.querySelectorAll<HTMLElement>(".WinMenuBarItem"),
  ].find(element => element.textContent === label);
  expect(item, label).toBeDefined();
  return item!;
};

test("runs demos in project windows with a menu bar below the title bar and descriptions in Help", () => {
  for (const project of projects) {
    click(`project:${project.id}`, explorer());
    const win = desktop().querySelector<HTMLElement>(
      `[data-window="project:${project.id}"]`,
    )!;
    expect(win.querySelector(".WinReadme")).toBeNull();
    const bar = win.querySelector(".WinMenuBar")!;
    expect(bar.getAttribute("role")).toBe("menubar");
    expect(bar.previousElementSibling?.className).toBe("WinTitlebar");
    expect(bar.nextElementSibling?.classList.contains("WinWindowBody")).toBe(
      true,
    );
    expect(
      [...bar.querySelectorAll(".WinMenuBarItem")].map(
        item => item.textContent,
      ),
    ).toEqual(["File", "View", "Help"]);
    barItem(win, "File").click();
    const links = [
      ...desktop().querySelectorAll<HTMLAnchorElement>(".WinMenu a"),
    ];
    expect(links.map(item => item.getAttribute("href"))).toContain(
      project.source,
    );
    const iframe = win.querySelector("iframe");
    if (project.demo) {
      const expectedDemo = ["deska", "saper"].includes(project.id)
        ? new URL("full-screen/", project.demo).href
        : project.demo;
      const openInNewTab = links.find(item =>
        item.textContent.includes("Open in New Tab"),
      );
      expect(openInNewTab?.getAttribute("href")).toBe(project.demo);
      expect(iframe?.getAttribute("src")).toBe(expectedDemo);
      expect(iframe?.title).toBe(`${project.name} demo`);
      expect(iframe?.getAttribute("sandbox")).toContain("allow-downloads");
      // allow="fullscreen" grants full screen; the attribute would duplicate it.
      expect(iframe?.getAttribute("allow")).toContain("fullscreen");
      expect(iframe?.hasAttribute("allowfullscreen")).toBe(false);
    } else {
      expect(iframe).toBeNull();
      expect(win.textContent).toContain("This project has no browser demo.");
    }
    if (project.releases)
      expect(links.map(item => item.getAttribute("href"))).toContain(
        project.releases,
      );
    for (const anchor of links) {
      expect(anchor.target).toBe("_blank");
      expect(anchor.rel).toContain("noopener");
    }
    press("Escape");
    expect(desktop().querySelector(".WinMenu")).toBeNull();
    barItem(win, "Help").click();
    menuItem(`${project.name} Help Topics`).click();
    const help = desktop().querySelector<HTMLElement>(
      `[data-window="help:${project.id}"]`,
    )!;
    expect(help.getAttribute("aria-label")).toBe(`${project.name} Help`);
    expect(help.textContent).toContain(project.summary);
    const expectedBody = document.createElement("div");
    expectedBody.innerHTML = project.html;
    expect(help.querySelector(".WinReadme")!.textContent).toBe(
      expectedBody.textContent,
    );
    expect(win.querySelector("iframe")).toBe(iframe);
    click("close", help);
    click("close", win);
    expect(iframe?.isConnected ?? false).toBe(false);
  }
}, 20_000);

test.each(["deska", "saper"])(
  "gives %s keyboard focus on launch and restore",
  id => {
    click(`project:${id}`);
    const win = desktop().querySelector<HTMLElement>(
      `[data-window="project:${id}"]`,
    )!;
    const frame = win.querySelector("iframe")!;
    expect(document.activeElement).toBe(frame);
    click("minimize", win);
    expect(document.activeElement).not.toBe(frame);
    desktop()
      .querySelector<HTMLButtonElement>(
        `.WinTask[data-tip="${win.getAttribute("aria-label")}"]`,
      )!
      .click();
    expect(document.activeElement).toBe(frame);
  },
);

test("keeps a running iframe when reopening, minimizing, maximizing or reading Help", () => {
  click("project:paintaz");
  const win = desktop().querySelector<HTMLElement>(
    '[data-window="project:paintaz"]',
  )!;
  const iframe = win.querySelector("iframe")!;
  // Any reset of the body or src would discard unsaved application state.
  const mutations = vi.fn();
  const observer = new MutationObserver(mutations);
  observer.observe(win.querySelector(".WinWindowBody")!, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  click("minimize", win);
  click("project:paintaz");
  expect(win.hidden).toBe(false);
  click("maximize", win);
  click("maximize", win);
  click("desktop");
  click("project:paintaz");
  barItem(win, "Help").click();
  menuItem("paintAZ Help Topics").click();
  click(
    "close",
    desktop().querySelector<HTMLElement>('[data-window="help:paintaz"]')!,
  );
  expect(document.activeElement).toBe(win);
  expect(win.querySelector("iframe")).toBe(iframe);
  expect(observer.takeRecords()).toHaveLength(0);
  expect(mutations).not.toHaveBeenCalled();
  observer.disconnect();
});

test("project menus close with Escape, an outside press and focus leaving them", () => {
  click("project:paintaz");
  const win = desktop().querySelector<HTMLElement>(
    '[data-window="project:paintaz"]',
  )!;
  const help = barItem(win, "Help");
  const open = () => desktop().querySelector(".WinMenu");
  help.click();
  expect(help.getAttribute("aria-expanded")).toBe("true");
  // Another window taking the keyboard closes the menu.
  click("project:statki", explorer());
  const other = desktop().querySelector<HTMLElement>(
    '[data-window="project:statki"]',
  )!;
  expect(open()).toBeNull();
  expect(help.getAttribute("aria-expanded")).toBe("false");
  const otherHelp = barItem(other, "Help");
  otherHelp.click();
  press("Escape");
  expect(open()).toBeNull();
  expect(document.activeElement).toBe(otherHelp);
  help.click();
  desktop().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(open()).toBeNull();
  help.click();
  press("Tab");
  expect(open()).toBeNull();
});

test("focusing an embedded application activates its window without stealing focus", async () => {
  click("project:paintaz");
  const win = desktop().querySelector<HTMLElement>(
    '[data-window="project:paintaz"]',
  )!;
  const iframe = win.querySelector("iframe")!;
  click("project:statki", explorer());
  click("start");
  // Cross-document events do not bubble; emulate the browser's blur/focus handoff.
  vi.spyOn(document, "activeElement", "get").mockReturnValue(iframe);
  window.dispatchEvent(new Event("blur"));
  await vi.waitFor(() => expect(win.dataset.active).toBe("true"));
  expect(document.activeElement).toBe(iframe);
  expect(startMenu()).toBeNull();
});

test("leaving the desktop removes embedded applications and cancels pending activation", async () => {
  click("project:paintaz");
  const iframe = desktop().querySelector("iframe")!;
  window.dispatchEvent(new Event("blur"));
  window.terminal.closeWindows();
  expect(iframe.isConnected).toBe(false);
  await new Promise(resolve => window.setTimeout(resolve, 5));
  expect(document.querySelector(".Win98")).toBeNull();
});

test("interaction inside same-origin demos switches windows and cleans up on navigation and close", () => {
  const apps = ["paintaz", "statki"].map(id => {
    click(`project:${id}`, explorer());
    const win = desktop().querySelector<HTMLElement>(
      `[data-window="project:${id}"]`,
    )!;
    const iframe = win.querySelector("iframe")!;
    const content = document.implementation.createHTMLDocument();
    const getter = vi
      .spyOn(iframe, "contentDocument", "get")
      .mockReturnValue(content);
    iframe.dispatchEvent(new Event("load"));
    return { win, iframe, content, getter };
  });
  for (const app of [...apps, ...apps]) {
    app.content.dispatchEvent(new Event("pointerdown"));
    expect(app.win.dataset.active).toBe("true");
  }
  const app = apps[0];
  const navigated = document.implementation.createHTMLDocument();
  app.getter.mockReturnValue(navigated);
  app.iframe.dispatchEvent(new Event("load"));
  app.content.dispatchEvent(new Event("pointerdown"));
  expect(app.win.dataset.active).toBe("false");
  navigated.dispatchEvent(new Event("focusin"));
  expect(app.win.dataset.active).toBe("true");
  click("close", app.win);
  navigated.dispatchEvent(new Event("pointerdown"));
  expect(apps[1].win.dataset.active).toBe("true");
});

test("minimizes, restores, maximizes and closes windows through the taskbar", () => {
  const win = explorer();
  click("minimize", win);
  expect(win.hidden).toBe(true);
  const task = desktop().querySelector<HTMLButtonElement>(".WinTask")!;
  task.click();
  expect(win.hidden).toBe(false);
  expect(task.getAttribute("aria-pressed")).toBe("true");
  click("maximize", win);
  expect(win.classList.contains("WinWindow--maximized")).toBe(true);
  click("maximize", win);
  expect(win.classList.contains("WinWindow--maximized")).toBe(false);
  click("close", win);
  expect(desktop().querySelector(".WinWindow")).toBeNull();
  expect(desktop().querySelector(".WinTask")).toBeNull();
  expect(document.activeElement).toBe(desktop().querySelector(".WinStart"));
});

test("reuses project windows and shows the desktop without losing them", () => {
  click("project:paintaz");
  click("project:paintaz");
  expect(
    desktop().querySelectorAll('[data-window="project:paintaz"]'),
  ).toHaveLength(1);
  click("desktop");
  expect(
    [...desktop().querySelectorAll<HTMLElement>(".WinWindow")].every(
      win => win.hidden,
    ),
  ).toBe(true);
  click("project:paintaz");
  expect(
    desktop().querySelector<HTMLElement>('[data-window="project:paintaz"]')!
      .hidden,
  ).toBe(false);
});

test("Start supports keyboard navigation and Escape returns focus to Start", () => {
  click("start");
  const menu = startMenu()!;
  const buttons = menu.querySelectorAll<HTMLButtonElement>(".WinMenuItem");
  expect(document.activeElement).toBe(buttons[0]);
  buttons[0].dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true }),
  );
  expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  expect(document.activeElement?.textContent).toBe("Shut Down…");
  menu.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(startMenu()).toBeNull();
  expect(document.activeElement).toBe(desktop().querySelector(".WinStart"));
});

test("MS-DOS action restores the terminal and preserves existing inert state", async () => {
  click("exit");
  await vi.waitFor(() => expect(store.system.state).toBe(""));
  expect(document.querySelector(".Win98")).toBeNull();
  expect(document.getElementById("root")!.inert).toBe(false);
  expect(document.getElementById("already-inert")!.inert).toBe(true);
  expect(document.activeElement).toBe(
    document.querySelector('input[name="command"]'),
  );
  expect(location.hash).toBe("#home");
});

test("route navigation leaves Windows and displays the linked project", async () => {
  window.history.replaceState(null, "", "#project/server-status");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await vi.waitFor(() => expect(store.system.state).toBe(""));
  expect(document.querySelector(".Win98")).toBeNull();
  expect(document.querySelector(".TerminalOutput")!.textContent).toContain(
    "Server Status",
  );
});

test("power-off removes the desktop and stops its clock", () => {
  const clear = vi.spyOn(window, "clearTimeout");
  store.system.togglePower();
  expect(document.querySelector(".Win98")).toBeNull();
  expect(clear).toHaveBeenCalled();
  const screen = document.querySelector<HTMLElement>(".CRTScreen")!;
  expect(screen.dataset.power).toBe("off");
  // Restore the physical shell for the next test without a reload.
  screen.inert = false;
  screen.removeAttribute("aria-hidden");
  delete screen.dataset.power;
  store.system.state = "";
});

test("every project has a distinct valid decorative pixel icon", () => {
  const icons = projects.map(project => windowsIcon(project.id));
  expect(new Set(icons).size).toBe(projects.length);
  for (const icon of icons) {
    const host = document.createElement("div");
    host.innerHTML = icon;
    expect(host.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(host.querySelector("svg")!.getAttribute("viewBox")).toBe(
      "0 0 32 32",
    );
  }
});

test("dragging clamps a window to the workspace and stops on pointer release", () => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  const workspace = desktop().querySelector<HTMLElement>(".WinWorkspace")!;
  const win = explorer();
  const title = win.querySelector<HTMLElement>(".WinTitlebar")!;
  vi.spyOn(workspace, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(workspace, "clientHeight", "get").mockReturnValue(600);
  vi.spyOn(win, "offsetWidth", "get").mockReturnValue(500);
  vi.spyOn(win, "offsetHeight", "get").mockReturnValue(400);
  vi.spyOn(win, "offsetLeft", "get").mockReturnValue(126);
  vi.spyOn(win, "offsetTop", "get").mockReturnValue(24);
  // Happy DOM does not implement pointer capture; the bounds use real handlers.
  title.setPointerCapture = vi.fn();
  title.hasPointerCapture = () => true;
  title.releasePointerCapture = vi.fn();
  title.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 1,
      clientX: 140,
      clientY: 30,
    }),
  );
  title.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      clientX: 1400,
      clientY: 900,
    }),
  );
  // Every write re-runs the CRT filter, so moves are written once per frame.
  const before = win.style.left;
  title.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      clientX: 1500,
      clientY: 950,
    }),
  );
  expect(win.style.left).toBe(before);
  vi.advanceTimersToNextFrame();
  expect(win.style.left).toBe("500px");
  expect(win.style.top).toBe("200px");
  title.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      clientX: -500,
      clientY: -500,
    }),
  );
  // Releasing the pointer writes the final position without waiting a frame.
  title.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
  );
  expect(win.style.left).toBe("0px");
  expect(win.style.top).toBe("0px");
  title.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      clientX: 400,
      clientY: 400,
    }),
  );
  vi.advanceTimersToNextFrame();
  expect(win.style.left).toBe("0px");
  expect(title.releasePointerCapture).toHaveBeenCalledWith(1);
});

test("touch focus changes do not dismiss Start before a menu option is clicked", () => {
  click("start");
  const icon = menuItem("Help").querySelector("svg")!;
  icon.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
    }),
  );
  // Mobile browsers can focus the container rather than the tapped button.
  desktop().focus();
  expect(startMenu()).not.toBeNull();
  icon.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
    }),
  );
  icon.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(win("help").getAttribute("aria-label")).toBe("Portfolio 98 Help");
  expect(startMenu()).toBeNull();
});

test("a touch scroll or cancelled gesture in Start does not activate an item", () => {
  click("start");
  const option = menuItem("Help");
  option.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
    }),
  );
  desktop().focus();
  option.dispatchEvent(
    new PointerEvent("pointercancel", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
    }),
  );
  expect(startMenu()).not.toBeNull();
  expect(win("help")).toBeNull();
  desktop().dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 8,
    }),
  );
  expect(startMenu()).toBeNull();
});

test("keyboard focus leaving Start still dismisses the menu", () => {
  click("start");
  startMenu()!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
  );
  explorer().focus();
  expect(startMenu()).toBeNull();
  // Focus moving away without Tab closes it too.
  click("start");
  explorer().focus();
  expect(startMenu()).toBeNull();
});

test("Start Shut Down asks first, then runs the shutdown screen and cleans up the desktop", async () => {
  click("start");
  menuItem("Shut Down…").click();
  const dialog = desktop().querySelector<HTMLElement>(".WinMessageBox")!;
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.getAttribute("role")).toBe("dialog");
  expect(
    document.getElementById(dialog.getAttribute("aria-labelledby")!)!
      .textContent,
  ).toBe("Shut Down Portfolio 98");
  expect(
    document.getElementById(dialog.getAttribute("aria-describedby")!)!
      .textContent,
  ).toBe("What do you want the computer to do?");
  expect(dialog.querySelector("fieldset legend")!.textContent).toBe(
    "Shut down options",
  );
  expect(dialog.textContent).toContain("Shut Down Portfolio 98");
  expect(dialog.textContent).toContain("What do you want the computer to do?");
  expect(
    [...dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map(
      radio => radio.parentElement!.textContent,
    ),
  ).toEqual(["Stand by", "Shut down", "Restart", "Restart in MS-DOS mode"]);
  // The whole desktop, taskbar included, is dimmed behind the dialog.
  expect(desktop().querySelector(".WinDither")).not.toBeNull();
  expect(desktop().dataset.shutdownDither).toBe("");
  expect(desktop().querySelector<HTMLElement>(".WinTaskbar")!.inert).toBe(true);
  choose("shutdown");
  dialog
    .querySelector<HTMLButtonElement>('[data-message-button="ok"]')!
    .click();
  await vi.waitFor(() => expect(store.system.state).toBe("shutdown"));
  expect(document.querySelector(".Win98")).toBeNull();
  expect(
    document.querySelector(".Experience--shutdown .Shutdown")?.textContent,
  ).toContain("It's now safe to turn off");
  expect(store.history.lastCommand).toBe("shutdown");
  expect(store.system.isInputAllowed).toBe(false);
  expect(document.querySelector('input[name="command"]')).toBeNull();
  expect(
    document.querySelector(".CRTScreen")!.contains(document.activeElement),
  ).toBe(true);
  store.system.togglePower();
  const screen = document.querySelector<HTMLElement>(".CRTScreen")!;
  expect(screen.dataset.power).toBe("off");
  screen.inert = false;
  screen.removeAttribute("aria-hidden");
  delete screen.dataset.power;
  store.system.state = "";
});

test.each(["typed command", "shortcut", "alias", "direct link"])(
  "%s shows Windows startup before opening the desktop",
  async entry => {
    window.terminal.closeWindows();
    vi.useFakeTimers();
    store.system.animations = true;
    let task: Promise<unknown> | undefined;
    if (entry === "typed command") {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="command"]',
      )!;
      input.focus();
      input.value = "windows";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.form!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    } else if (entry === "shortcut") {
      document
        .querySelector<HTMLAnchorElement>(
          '.QuickCommands [data-command="windows"]',
        )!
        .click();
    } else if (entry === "alias") {
      task = store.system.addCommand("win", {
        animateCommand: false,
        route: false,
      });
    } else {
      task = store.system.start(startupCommands("#windows"));
    }
    await vi.advanceTimersByTimeAsync(400);
    const splash = document.querySelector<HTMLDialogElement>(
      ".Experience--windows-startup",
    )!;
    expect(splash.open).toBe(true);
    expect(splash.getAttribute("aria-label")).toBe("Portfolio 98 startup");
    expect(splash.textContent?.trim()).toBe("Portfolio98");
    expect(splash.querySelector(".WindowsProgress")).not.toBeNull();
    expect(splash.parentElement?.className).toBe("CRTScreen");
    expect(document.querySelector(".Win98")).toBeNull();
    expect(document.getElementById("root")!.inert).toBe(true);
    expect(document.activeElement).toBe(splash);
    expect(store.system.isProcessing).toBe(true);
    await vi.advanceTimersByTimeAsync(2500);
    await task;
    expect(splash.isConnected).toBe(false);
    expect(store.system.isInputAllowed).toBe(true);
    expect(desktop()).not.toBeNull();
    expect(desktop().contains(document.activeElement)).toBe(true);
    expect(document.getElementById("root")!.inert).toBe(true);
    click("exit");
    await vi.advanceTimersByTimeAsync(5000);
    expect(document.getElementById("root")!.inert).toBe(false);
  },
);

test.each(["Escape", "Ctrl+C", "power"])(
  "%s handles Windows startup without leaving a delayed desktop",
  async action => {
    window.terminal.closeWindows();
    vi.useFakeTimers();
    store.system.animations = true;
    const task = store.system.addCommand("windows", {
      animateCommand: false,
      route: false,
    });
    await vi.advanceTimersByTimeAsync(100);
    const splash = document.querySelector<HTMLDialogElement>(
      ".Experience--windows-startup",
    )!;
    if (action === "power") store.system.togglePower();
    else
      splash.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: action === "Ctrl+C" ? "c" : action,
          ctrlKey: action === "Ctrl+C",
          bubbles: true,
          cancelable: true,
        }),
      );
    await task;
    await vi.advanceTimersByTimeAsync(5000);
    expect(splash.isConnected).toBe(false);
    if (action === "Escape") {
      expect(desktop()).not.toBeNull();
      expect(store.system.isInputAllowed).toBe(true);
    } else {
      expect(document.querySelector(".Win98")).toBeNull();
      expect(document.getElementById("root")!.inert).toBe(false);
      expect(store.system.state).toBe(action === "power" ? "off" : "");
    }
    if (action === "power") {
      const screen = document.querySelector<HTMLElement>(".CRTScreen")!;
      screen.inert = false;
      screen.removeAttribute("aria-hidden");
      delete screen.dataset.power;
      store.system.state = "";
    }
  },
);

test("disabled animations bypass the startup splash", async () => {
  window.terminal.closeWindows();
  const start = vi.spyOn(window.terminal, "enterWindowsStartup");
  await store.system.addCommand("windows", {
    animateCommand: false,
    route: false,
  });
  expect(start).toHaveBeenCalledOnce();
  expect(document.querySelector(".Experience--windows-startup")).toBeNull();
  expect(desktop()).not.toBeNull();
  expect(store.system.isInputAllowed).toBe(true);
});

/** A mouse or touch press followed by its click, as a browser sends them. */
const pointerClick = (
  target: Element,
  pointerType: "mouse" | "touch" | "pen",
  detail = 1,
) => {
  target.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType, button: 0 }),
  );
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
};
const doubleClick = (target: Element) => {
  pointerClick(target, "mouse", 1);
  pointerClick(target, "mouse", 2);
  target.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, detail: 2 }),
  );
};
const fileItem = (action: string) =>
  explorer().querySelector<HTMLElement>(
    `.WinFiles [data-win-action="${action}"]`,
  )!;

test("the second click of a double-click never opens what navigation put under the pointer", () => {
  // A tap opens the folder at once; the browser then sends detail 2 to
  // whatever navigation put under the finger.
  pointerClick(fileItem("folder:games"), "touch");
  expect(explorer().getAttribute("aria-label")).toBe("Games");
  const first = files()[0];
  pointerClick(first, "touch", 2);
  first.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
  expect(desktop().querySelector('[data-window^="project:"]')).toBeNull();
  // A double-click opens a folder once; its clicks only select.
  click("folder:projects", explorer());
  doubleClick(fileItem("folder:games"));
  expect(explorer().getAttribute("aria-label")).toBe("Games");
  expect(desktop().querySelector('[data-window^="project:"]')).toBeNull();
  // A click without a pointer (assistive technology) still opens.
  files()[0].click();
  expect(desktop().querySelector('[data-window^="project:"]')).not.toBeNull();
});

test("Classic icons: a mouse click selects, a double-click or Enter opens, a tap opens", () => {
  const icons = desktop().querySelector<HTMLElement>(".WinDesktopIcons")!;
  expect(icons.getAttribute("role")).toBe("listbox");
  const icon = (action: string) =>
    icons.querySelector<HTMLElement>(`[data-win-action="${action}"]`)!;
  const about = icon("about");
  expect(about.getAttribute("role")).toBe("option");
  pointerClick(about, "mouse");
  expect(win("about")).toBeNull();
  expect(about.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(about);
  expect(about.tabIndex).toBe(0);
  // Selecting another icon moves the selection; only one is selected.
  pointerClick(icon("contact"), "mouse");
  expect(about.getAttribute("aria-selected")).toBe("false");
  expect(icons.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
  doubleClick(about);
  expect(win("about")).not.toBeNull();
  click("close", win("about"));
  // A tap opens at once; the rest of a double-tap does nothing more.
  const open = vi.spyOn(HTMLElement.prototype, "focus");
  pointerClick(icon("contact"), "touch");
  expect(win("contact")).not.toBeNull();
  const opened = open.mock.calls.length;
  pointerClick(icon("contact"), "touch", 2);
  icon("contact").dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, detail: 2 }),
  );
  expect(open.mock.calls.length).toBe(opened);
  open.mockRestore();
  click("close", win("contact"));
  // Pens tap too.
  pointerClick(about, "pen");
  expect(win("about")).not.toBeNull();
  click("close", win("about"));
  // Space selects, Enter opens.
  const contact = icon("contact");
  contact.focus();
  pointerClick(about, "mouse");
  contact.focus();
  expect(press(" ").defaultPrevented).toBe(true);
  expect(contact.getAttribute("aria-selected")).toBe("true");
  expect(win("contact")).toBeNull();
  press("Enter");
  expect(win("contact")).not.toBeNull();
  // Clicking the wallpaper clears the selection.
  desktop()
    .querySelector(".WinWorkspace")!
    .dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
    );
  expect(icons.querySelector('[aria-selected="true"]')).toBeNull();
  // So does a press on the list's empty space.
  pointerClick(about, "mouse");
  icons.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
  );
  expect(icons.querySelector('[aria-selected="true"]')).toBeNull();
});

test("each list view is one Tab stop: desktop, Explorer and Find results", () => {
  const stops = (list: Element) =>
    [...list.querySelectorAll<HTMLElement>("[data-list-item]")].filter(
      item => item.tabIndex === 0,
    );
  const icons = desktop().querySelector<HTMLElement>(".WinDesktopIcons")!;
  expect(stops(icons)).toHaveLength(1);
  expect(stops(icons)[0].textContent).toBe("My Computer");
  const pane = explorer().querySelector<HTMLElement>("[data-listview]")!;
  expect(pane.getAttribute("role")).toBe("listbox");
  expect(pane.getAttribute("aria-label")).toBe("My Projects");
  expect(stops(pane)).toHaveLength(1);
  // Explorer opens with the keyboard in its file pane.
  expect(document.activeElement).toBe(stops(pane)[0]);
  // The selection is the Tab stop.
  pointerClick(fileItem("project:paintaz"), "mouse");
  expect(stops(pane)).toEqual([fileItem("project:paintaz")]);
  click("find");
  const find = win("find");
  const results = () => find.querySelector<HTMLElement>("[data-listview]")!;
  // An empty list is itself the Tab stop.
  expect(results().tabIndex).toBe(0);
  find.querySelector<HTMLButtonElement>('[type="submit"]')!.click();
  expect(stops(results())).toHaveLength(1);
  expect(results().hasAttribute("tabindex")).toBe(false);
});

test("arrow keys follow the icon grid; Home, End and type-ahead move the selection", () => {
  mockLayout(1244, 656);
  // Desktop icons flow down 6-row columns: 96 px rows, 106 px columns.
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    function (this: HTMLElement) {
      if (!this.classList.contains("WinShortcut")) return 0;
      if (!this.closest(".WinDesktopIcons")) return 0;
      return ([...this.parentElement!.children].indexOf(this) % 6) * 96;
    },
  );
  const icons = [
    ...desktop().querySelectorAll<HTMLElement>(".WinDesktopIcons .WinShortcut"),
  ];
  const selected = () =>
    icons.filter(icon => icon.getAttribute("aria-selected") === "true");
  icons[0].focus();
  press("ArrowDown");
  expect(document.activeElement).toBe(icons[1]);
  expect(selected()).toEqual([icons[1]]);
  // Right moves to the next column on the same row.
  press("ArrowRight");
  expect(document.activeElement).toBe(icons[7]);
  press("ArrowLeft");
  expect(document.activeElement).toBe(icons[1]);
  // Down a column, the end continues with the next column's first icon.
  icons[5].focus();
  press("ArrowDown");
  expect(document.activeElement).toBe(icons[6]);
  press("ArrowUp");
  expect(document.activeElement).toBe(icons[5]);
  press("End");
  expect(document.activeElement).toBe(icons.at(-1));
  press("Home");
  expect(document.activeElement).toBe(icons[0]);
  // Type-ahead: a prefix within half a second, and one letter cycles.
  vi.useFakeTimers({ toFake: ["Date"] });
  press("m");
  expect(document.activeElement!.textContent).toBe("My Projects");
  press("m");
  expect(document.activeElement!.textContent).toBe("MS-DOS Prompt");
  vi.advanceTimersByTime(600);
  press("a");
  expect(document.activeElement!.textContent).toBe("About Adam.txt");
  vi.advanceTimersByTime(600);
  press("m");
  press("y");
  press(" ");
  press("c");
  expect(document.activeElement!.textContent).toBe("My Computer");
  expect(selected()).toEqual([document.activeElement]);
  // Nothing opened on the way.
  expect(win("about")).toBeNull();
});

test("desktop icons list the system items first", () => {
  expect(
    [
      ...desktop().querySelectorAll<HTMLElement>(
        ".WinDesktopIcons .WinShortcut",
      ),
    ].map(icon => icon.textContent),
  ).toEqual([
    "My Computer",
    "My Projects",
    "Recycle Bin",
    "Games",
    "paintAZ",
    "About Adam.txt",
    "Contact",
    "MS-DOS Prompt",
  ]);
});

test.each([
  [1088, 477, 222, 740, 461],
  [1244, 656, 222, 740, 510],
  [1500, 836, 116, 740, 510],
  [847, 531, 222, 617, 510],
])(
  "at %ix%i the first window opens right of the desktop icons",
  async (width, height, left, windowWidth, windowHeight) => {
    mockLayout(width, height);
    await reopen();
    const icons = [
      ...desktop().querySelectorAll<HTMLElement>(
        ".WinDesktopIcons .WinShortcut",
      ),
    ];
    const iconsRight = Math.max(
      ...icons.map(icon => 10 + icon.offsetLeft + icon.offsetWidth),
    );
    expect(origin(explorer())[0]).toBeGreaterThanOrEqual(iconsRight);
    expect(origin(explorer())).toEqual([left, 8]);
    expect(explorer().style.width).toBe(`${windowWidth}px`);
    expect(explorer().style.height).toBe(`${windowHeight}px`);
  },
);

test("with little room the first window may cover later icon columns, never the first", async () => {
  mockLayout(560, 700);
  await reopen();
  // Two icon columns end at 214 px; 420 px would not fit right of them.
  expect(origin(explorer())).toEqual([132, 8]);
  expect(explorer().style.width).toBe("420px");
  expect(origin(explorer())[0]).toBeGreaterThanOrEqual(108);
});

test.each([
  [653, 794],
  [892, 458],
])(
  "five cascaded windows at %ix%i keep their caption buttons inside",
  async (width, height) => {
    mockLayout(width, height);
    await reopen();
    click("about");
    click("contact");
    openFromStart("Help");
    click("find");
    click("project:paintaz");
    const windows = [...desktop().querySelectorAll<HTMLElement>(".WinWindow")];
    expect(windows).toHaveLength(6);
    for (const item of windows) {
      const [left, top] = origin(item);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      // Close sits at the top-right corner of the frame.
      expect(left + item.offsetWidth).toBeLessThanOrEqual(width);
      expect(top + item.offsetHeight).toBeLessThanOrEqual(height);
    }
  },
);

test("cascading steps from the icon columns and never reuses an occupied slot", async () => {
  mockLayout(1244, 656);
  await reopen();
  click("about");
  click("contact");
  expect(origin(win("about"))).toEqual([244, 30]);
  expect(origin(win("contact"))).toEqual([266, 52]);
  click("close", explorer());
  // Recycle Bin opens a new Explorer window in the next free slot.
  click("recycle");
  expect(explorer().getAttribute("aria-label")).toBe("Recycle Bin");
  const origins = [...desktop().querySelectorAll<HTMLElement>(".WinWindow")]
    .filter(item => !item.hidden)
    .map(item => origin(item).join(","));
  expect(new Set(origins).size).toBe(origins.length);
  expect(origin(explorer())).toEqual([288, 74]);
});

test("the workspace observer re-places windows from their model positions", async () => {
  const resize = captureResizeObserver();
  const layout = mockLayout(1244, 656);
  await reopen();
  click("about");
  click("contact");
  openFromStart("Help");
  const about = win("about");
  const contact = win("contact");
  const help = win("help");
  const placed = [about, contact, help].map(origin);
  // Minimized, maximized and phone layouts must not overwrite the model.
  click("minimize", contact);
  click("maximize", about);
  resize();
  layout.width = 400;
  resize();
  layout.width = 1244;
  resize();
  expect(origin(help)).toEqual(placed[2]);
  click("maximize", about);
  expect(origin(about)).toEqual(placed[0]);
  desktop()
    .querySelector<HTMLButtonElement>('.WinTask[data-tip="Address Book"]')!
    .click();
  expect(contact.hidden).toBe(false);
  expect(origin(contact)).toEqual(placed[1]);
  // A smaller workspace clamps; growing again restores the model position.
  layout.width = 800;
  resize();
  expect(origin(help)).toEqual([800 - 656, placed[2][1]]);
  layout.width = 1244;
  resize();
  expect(origin(help)).toEqual(placed[2]);
});

test("windows opened on a phone take their desktop places once the workspace widens", async () => {
  const resize = captureResizeObserver();
  const layout = mockLayout(322, 702);
  await reopen();
  click("about");
  // CSS owns the phone layout; nothing is placed from the phone geometry.
  expect(explorer().style.width).toBe("");
  // Rotating to landscape or widening the browser.
  layout.width = 1244;
  layout.height = 656;
  resize();
  expect(origin(explorer())).toEqual([222, 8]);
  expect(explorer().style.width).toBe("740px");
  expect(origin(win("about"))).toEqual([244, 30]);
  // A window opened later continues the cascade.
  click("contact");
  expect(origin(win("contact"))).toEqual([266, 52]);
});

test("dragging a window that a smaller workspace clamped starts where it is drawn", async () => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  const resize = captureResizeObserver();
  const layout = mockLayout(1244, 656);
  await reopen();
  click("about");
  const about = win("about");
  expect(origin(about)).toEqual([244, 30]);
  // The 740 px window now fits only up to x = 900 - 740.
  layout.width = 900;
  resize();
  expect(origin(about)).toEqual([160, 30]);
  const title = about.querySelector<HTMLElement>(".WinTitlebar")!;
  title.setPointerCapture = vi.fn();
  title.hasPointerCapture = () => true;
  title.releasePointerCapture = vi.fn();
  const pointer = (type: string, clientX: number, clientY: number) =>
    title.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        pointerId: 2,
        clientX,
        clientY,
      }),
    );
  pointer("pointerdown", 400, 40);
  pointer("pointermove", 370, 50);
  pointer("pointerup", 370, 50);
  // 30 px to the left of where it is drawn, not of its old model position.
  expect(origin(about)).toEqual([130, 40]);
});

test("clicking a title bar gives that window the keyboard; Alt+F4 closes the focused window", () => {
  click("about");
  const about = win("about");
  desktop().dispatchEvent(
    new KeyboardEvent("keydown", { key: "F3", bubbles: true }),
  );
  const find = win("find");
  expect(find.contains(document.activeElement)).toBe(true);
  const press = new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 3,
  });
  about.querySelector(".WinTitlebar strong")!.dispatchEvent(press);
  expect(press.defaultPrevented).toBe(true);
  expect(about.dataset.active).toBe("true");
  expect(about.contains(document.activeElement)).toBe(true);
  const altF4 = new KeyboardEvent("keydown", {
    key: "F4",
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.activeElement!.dispatchEvent(altF4);
  expect(altF4.defaultPrevented).toBe(true);
  expect(about.isConnected).toBe(false);
  expect(find.isConnected).toBe(true);
});

test("Alt+F4 on the desktop or the taskbar asks to shut down; in a dialog it cancels", async () => {
  const start = desktop().querySelector<HTMLButtonElement>(".WinStart")!;
  const shutDownBox = () =>
    [...desktop().querySelectorAll(".WinMessageBox")].find(box =>
      box.textContent?.includes("Shut Down Portfolio 98"),
    );
  for (const target of [desktop(), start]) {
    target.focus();
    const altF4 = new KeyboardEvent("keydown", {
      key: "F4",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(altF4);
    expect(altF4.defaultPrevented).toBe(true);
    // No window closes; Shut Down asks what to do.
    expect(explorer()).not.toBeNull();
    expect(shutDownBox()).toBeDefined();
    expect(desktop().querySelector(".WinDither")).not.toBeNull();
    // Alt+F4 in the dialog is its Cancel.
    const cancel = new KeyboardEvent("keydown", {
      key: "F4",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.activeElement!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(shutDownBox()).toBeUndefined();
    await vi.waitFor(() =>
      expect(desktop().querySelector(".WinDither")).toBeNull(),
    );
    expect(explorer()).not.toBeNull();
  }
});

test("Start: Up from a mouse-opened menu goes to the last item, Down to the first", () => {
  const start = desktop().querySelector<HTMLButtonElement>(".WinStart")!;
  for (const [key, expected] of [
    ["ArrowUp", "Shut Down…"],
    ["ArrowDown", "Programs"],
  ] as const) {
    start.focus();
    start.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    // A mouse-opened menu has the keyboard but no hot item yet.
    expect(document.activeElement).toBe(startMenu());
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
    expect(document.activeElement?.textContent).toBe(expected);
    start.focus();
    start.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(startMenu()).toBeNull();
  }
  // With the keyboard still on Start (Safari keeps it there), arrows reach the ends.
  start.focus();
  start.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  start.focus();
  start.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
  );
  expect(document.activeElement?.textContent).toBe("Shut Down…");
});

test("Ctrl+Esc opens Start with focus and closes it again", () => {
  const ctrlEsc = () => {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    (document.activeElement ?? desktop()).dispatchEvent(event);
    return event;
  };
  expect(ctrlEsc().defaultPrevented).toBe(true);
  expect(startMenu()!.contains(document.activeElement)).toBe(true);
  ctrlEsc();
  expect(startMenu()).toBeNull();
  expect(document.activeElement).toBe(desktop().querySelector(".WinStart"));
});

test("Start takes the foreground; cancelling it with the pointer gives it back without moving focus", () => {
  const start = desktop().querySelector<HTMLButtonElement>(".WinStart")!;
  const before = document.activeElement;
  start.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(startMenu()).not.toBeNull();
  expect(explorer().dataset.active).toBe("false");
  desktop()
    .querySelector(".WinTray")!
    .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(startMenu()).toBeNull();
  expect(explorer().dataset.active).toBe("true");
  expect(document.activeElement).toBe(before);
  // Escape leaves the keyboard on Start, so the window stays inactive.
  click("start");
  expect(explorer().dataset.active).toBe("false");
  startMenu()!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(document.activeElement).toBe(start);
  expect(explorer().dataset.active).toBe("false");
  // Choosing an item activates the window it opens.
  click("start");
  menuItem("Documents").click();
  menuItem("About Adam.txt").click();
  expect(win("about").dataset.active).toBe("true");
  expect(explorer().dataset.active).toBe("false");
});

test("clicking the wallpaper deactivates every window and greys the caption", async () => {
  const { compileString } = await import("sass");
  const style = document.createElement("style");
  style.textContent = compileString(
    readFileSync("src/styles/windows.scss", "utf8"),
  ).css;
  // Happy DOM keeps hex colours; browsers report rgb().
  const rgb = (color: string) =>
    /^#[\da-f]{6}$/i.test(color)
      ? `rgb(${[1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)).join(", ")})`
      : color;
  document.head.append(style);
  try {
    click("about");
    const workspace = desktop().querySelector<HTMLElement>(".WinWorkspace")!;
    // A desktop icon takes the foreground too, as in Windows 98, and keeps
    // its selection.
    const shortcut = desktop().querySelector<HTMLElement>(
      ".WinDesktopIcons .WinShortcut",
    )!;
    shortcut.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
    );
    expect(win("about").dataset.active).toBe("false");
    expect(shortcut.getAttribute("aria-selected")).toBe("true");
    click("about");
    expect(win("about").dataset.active).toBe("true");
    workspace.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(shortcut.getAttribute("aria-selected")).toBe("false");
    const windows = [...desktop().querySelectorAll<HTMLElement>(".WinWindow")];
    expect(windows.map(item => item.dataset.active)).toEqual([
      "false",
      "false",
    ]);
    expect(
      [...desktop().querySelectorAll(".WinTask")].map(task =>
        task.getAttribute("aria-pressed"),
      ),
    ).toEqual(["false", "false"]);
    expect(
      rgb(getComputedStyle(win("about").querySelector(".WinTitlebar")!).color),
    ).toBe("rgb(192, 192, 192)");
  } finally {
    style.remove();
  }
});

const openGame = (id = "deska") => {
  click(`project:${id}`);
  const game = win(`project:${id}`);
  const iframe = game.querySelector("iframe")!;
  const content = document.implementation.createHTMLDocument();
  vi.spyOn(iframe, "contentDocument", "get").mockReturnValue(content);
  iframe.dispatchEvent(new Event("load"));
  return { game, iframe, content };
};

test("Ctrl+Esc inside a same-origin game opens Start with focus in the menu", () => {
  const { iframe, content } = openGame();
  expect(document.activeElement).toBe(iframe);
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  content.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(startMenu()!.contains(document.activeElement)).toBe(true);
});

test("Ctrl+Alt releases a game's keyboard until the player returns to it", () => {
  const { game, iframe, content } = openGame();
  expect(game.querySelector(".WinStatus")!.textContent).toBe(
    "Ctrl+Alt releases the keyboard · Ctrl+Esc opens Start",
  );
  // Ctrl alone, AltGr and Ctrl+Alt+Shift are not the chord.
  for (const init of [
    { key: "Control", ctrlKey: true },
    { key: "AltGraph", ctrlKey: true, altKey: true },
    { key: "Alt", ctrlKey: true, altKey: true, shiftKey: true },
  ])
    content.body.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, ...init }),
    );
  expect(document.activeElement).toBe(iframe);
  const chord = new KeyboardEvent("keydown", {
    key: "Alt",
    ctrlKey: true,
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  content.body.dispatchEvent(chord);
  expect(chord.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(game);
  // Minimize and restore: activation no longer pulls focus into the game.
  click("minimize", game);
  desktop()
    .querySelector<HTMLButtonElement>('.WinTask[data-tip="Deska"]')!
    .click();
  expect(game.hidden).toBe(false);
  expect(document.activeElement).toBe(game);
  // Enter on the window hands the keyboard back.
  game.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  expect(document.activeElement).toBe(iframe);
  click("minimize", game);
  desktop()
    .querySelector<HTMLButtonElement>('.WinTask[data-tip="Deska"]')!
    .click();
  expect(document.activeElement).toBe(iframe);
});

test("cross-origin games may post release and Start messages from their own frame only", () => {
  const { game, iframe } = openGame();
  const frameWindow = {} as Window;
  vi.spyOn(iframe, "contentWindow", "get").mockReturnValue(frameWindow);
  const post = (type: string, origin: string, source: unknown) => {
    const event = new MessageEvent("message", { data: { type }, origin });
    Object.defineProperty(event, "source", { value: source });
    window.dispatchEvent(event);
  };
  const demoOrigin = "https://adam-zielonka.github.io";
  post("portfolio98:release", demoOrigin, window);
  post("portfolio98:release", "https://example.com", frameWindow);
  expect(document.activeElement).toBe(iframe);
  post("portfolio98:release", demoOrigin, frameWindow);
  expect(document.activeElement).toBe(game);
  post("portfolio98:start", demoOrigin, frameWindow);
  expect(startMenu()!.contains(document.activeElement)).toBe(true);
});

test("Escape or Cancel closes Shut Down without shutting down and focuses Start", async () => {
  for (const close of ["Escape", "Cancel"]) {
    const dialog = openShutDown();
    // Windows focuses the selected choice.
    expect(document.activeElement).toBe(
      dialog.querySelector('input[type="radio"]:checked'),
    );
    if (close === "Escape") press("Escape");
    else messageButton(dialog, "cancel").click();
    expect(dialog.isConnected).toBe(false);
    await vi.waitFor(() =>
      expect(desktop().querySelector(".WinDither")).toBeNull(),
    );
    expect(desktop().dataset.shutdownDither).toBeUndefined();
    expect(desktop().querySelector<HTMLElement>(".WinTaskbar")!.inert).toBe(
      false,
    );
    expect(document.activeElement).toBe(desktop().querySelector(".WinStart"));
    expect(store.system.isInputAllowed).toBe(true);
    expect(store.system.shutdown).toBe(false);
  }
});

test("Shut Down Help explains the choices and keeps the dialog open", async () => {
  const dialog = openShutDown();
  messageButton(dialog, "help").click();
  const boxes = desktop().querySelectorAll<HTMLElement>(".WinMessageBox");
  expect(boxes).toHaveLength(2);
  expect(boxes[1].textContent).toContain("Restart in MS-DOS mode returns");
  expect(dialog.closest<HTMLElement>(".WinModal")!.inert).toBe(true);
  messageButton(boxes[1], "ok").click();
  expect(dialog.isConnected).toBe(true);
  expect(dialog.closest<HTMLElement>(".WinModal")!.inert).toBe(false);
  expect(dialog.contains(document.activeElement)).toBe(true);
  press("Escape");
  await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
});

test("Shut Down choices answer to their underlined letters and the last one is remembered", async () => {
  const dialog = openShutDown();
  messageButton(dialog, "cancel").focus();
  press("t");
  const standBy = dialog.querySelector<HTMLInputElement>('[value="standby"]')!;
  expect(standBy.checked).toBe(true);
  expect(document.activeElement).toBe(standBy);
  expect(standBy.parentElement!.querySelector("u")?.textContent).toBe("t");
  press("Enter");
  await vi.waitFor(() =>
    expect(desktop().querySelector(".WinStandby")).not.toBeNull(),
  );
  press("Shift");
  const again = openShutDown();
  expect(
    again.querySelector<HTMLInputElement>('input[type="radio"]:checked')!.value,
  ).toBe("standby");
  // Cancelling does not change the remembered choice.
  choose("shutdown");
  press("Escape");
  await vi.waitFor(() =>
    expect(desktop().querySelector(".WinDither")).toBeNull(),
  );
  expect(
    openShutDown().querySelector<HTMLInputElement>(
      'input[type="radio"]:checked',
    )!.value,
  ).toBe("standby");
  press("Escape");
});

test("Stand by blanks the screen until any key or press, which does nothing else", async () => {
  const screen = document.querySelector<HTMLElement>(".CRTScreen")!;
  const standBy = async () => {
    const dialog = openShutDown();
    choose("standby");
    messageButton(dialog, "ok").click();
    await vi.waitFor(() =>
      expect(desktop().querySelector(".WinStandby")).not.toBeNull(),
    );
    return desktop().querySelector<HTMLElement>(".WinStandby")!;
  };
  const standby = await standBy();
  expect(screen.dataset.standby).toBe("");
  expect(desktop().querySelector(".WinDither")).toBeNull();
  expect(document.activeElement).toBe(standby);
  expect(standby.getAttribute("aria-label")).toBe("Stand by");
  expect(desktop().querySelector<HTMLElement>(".WinWorkspace")!.inert).toBe(
    true,
  );
  // A key wakes the desktop and is swallowed (F3 would open Find).
  const wake = press("F3");
  expect(wake.defaultPrevented).toBe(true);
  expect(desktop().querySelector(".WinStandby")).toBeNull();
  expect(screen.dataset.standby).toBeUndefined();
  expect(win("find")).toBeNull();
  expect(desktop().querySelector<HTMLElement>(".WinWorkspace")!.inert).toBe(
    false,
  );
  expect(document.activeElement).toBe(desktop().querySelector(".WinStart"));
  // A press wakes it too, and its click does not reach what is underneath.
  await standBy();
  const icon = desktop().querySelector<HTMLElement>(
    '.WinDesktopIcons [data-win-action="recycle"]',
  )!;
  desktop()
    .querySelector(".WinStandby")!
    .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(screen.dataset.standby).toBeUndefined();
  // A click without a pointer (as assistive technology sends) opens icons.
  icon.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(explorer().getAttribute("aria-label")).toBe("My Projects");
  icon.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(explorer().getAttribute("aria-label")).toBe("Recycle Bin");
  // Leaving Portfolio 98 during stand by turns the light back to normal.
  await standBy();
  expect(screen.dataset.standby).toBe("");
  window.terminal.closeWindows();
  expect(screen.dataset.standby).toBeUndefined();
});

test("Restart shows the shutdown and startup screens, then a fresh desktop without reloading", async () => {
  const reload = vi
    .spyOn(window.location, "reload")
    .mockImplementation(() => {});
  click("project:paintaz");
  const old = desktop();
  const dialog = openShutDown();
  choose("restart");
  vi.useFakeTimers();
  store.system.animations = true;
  messageButton(dialog, "ok").click();
  await vi.advanceTimersByTimeAsync(100);
  const shutdown = document.querySelector<HTMLDialogElement>(
    ".Experience--shutdown-animation",
  )!;
  expect(shutdown.dataset.phase).toBe("splash");
  expect(old.isConnected).toBe(true);
  await vi.advanceTimersByTimeAsync(1800);
  expect(shutdown.isConnected).toBe(false);
  expect(document.querySelector(".Experience--windows-startup")).not.toBeNull();
  await vi.advanceTimersByTimeAsync(2500);
  expect(old.isConnected).toBe(false);
  expect(document.querySelectorAll(".Win98")).toHaveLength(1);
  expect(desktop()).not.toBe(old);
  expect(win("project:paintaz")).toBeNull();
  expect(document.querySelector(".Experience")).toBeNull();
  expect(store.system.isInputAllowed).toBe(true);
  expect(desktop().contains(document.activeElement)).toBe(true);
  expect(location.hash).toBe("#windows");
  expect(reload).not.toHaveBeenCalled();
});

test("Ctrl+C on the restart's startup screen leaves the terminal, not a dimmed desktop", async () => {
  const old = desktop();
  const dialog = openShutDown();
  choose("restart");
  vi.useFakeTimers();
  store.system.animations = true;
  messageButton(dialog, "ok").click();
  await vi.advanceTimersByTimeAsync(1900);
  const startup = document.querySelector<HTMLElement>(
    ".Experience--windows-startup",
  )!;
  expect(startup).not.toBeNull();
  startup.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  await vi.advanceTimersByTimeAsync(100);
  // Like an interrupted `windows`: the prompt, with nothing left dimmed.
  expect(old.isConnected).toBe(false);
  expect(document.querySelector(".Win98, .WinDither, .Experience")).toBeNull();
  expect(store.system.isInputAllowed).toBe(true);
  const output = document.querySelector<HTMLElement>(".TerminalOutput")!;
  expect(output.inert).toBe(false);
  expect(document.activeElement).not.toBe(document.body);
  expect(
    document.querySelector(".Terminal")!.contains(document.activeElement),
  ).toBe(true);
});

test("leaving during the desktop's shutdown screen keeps the keyboard in the terminal", async () => {
  const dialog = openShutDown();
  choose("shutdown");
  vi.useFakeTimers();
  store.system.animations = true;
  messageButton(dialog, "ok").click();
  await vi.advanceTimersByTimeAsync(100);
  expect(
    document.querySelector(".Experience--shutdown-animation"),
  ).not.toBeNull();
  // What a route change does (main.ts runRoute): break, then the command.
  await store.system.break();
  await vi.advanceTimersByTimeAsync(10);
  const task = store.system.addCommand("whoami", {
    animateCommand: false,
    route: false,
  });
  await vi.advanceTimersByTimeAsync(3000);
  await task;
  expect(document.querySelector(".Win98, .Experience")).toBeNull();
  expect(document.activeElement).not.toBe(document.body);
  expect(
    document.querySelector(".Terminal")!.contains(document.activeElement),
  ).toBe(true);
});

test("after the MS-DOS Prompt, Find still animates while Animations is on", async () => {
  click("exit");
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
  store.system.animations = true;
  await store.system.addCommand("exit", { animateCommand: false });
  expect(desktop()).not.toBeNull();
  // The prompt skipped the startup screen; the desktop's own animations
  // follow the setting.
  expect(store.system.isAnimationSkipped).toBe(true);
  const find = desktop().querySelector<HTMLElement>(
    '.WinQuickButton[data-win-action="find"]',
  )!;
  find.click();
  win("find")!.querySelector<HTMLButtonElement>('[data-find="now"]')!.click();
  expect(win("find")!.querySelector(".WinStatus")!.textContent).toBe(
    "Searching…",
  );
});

test("Restart without animations opens a fresh desktop at once", async () => {
  const old = desktop();
  const dialog = openShutDown();
  choose("restart");
  messageButton(dialog, "ok").click();
  await vi.waitFor(() => expect(old.isConnected).toBe(false));
  expect(desktop()).not.toBeNull();
  expect(document.querySelector(".Experience")).toBeNull();
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
});

test("typing restart in the terminal just starts Portfolio 98", async () => {
  window.terminal.closeWindows();
  vi.useFakeTimers();
  store.system.animations = true;
  const task = store.system.addCommand("restart", { animateCommand: false });
  await vi.advanceTimersByTimeAsync(100);
  expect(document.querySelector(".Experience--shutdown-animation")).toBeNull();
  expect(document.querySelector(".Experience--windows-startup")).not.toBeNull();
  await vi.advanceTimersByTimeAsync(2500);
  await task;
  expect(desktop()).not.toBeNull();
});

test("Restart in MS-DOS mode leaves for the terminal, and EXIT comes back with the startup screen", async () => {
  const dialog = openShutDown();
  choose("dos-mode");
  messageButton(dialog, "ok").click();
  await vi.waitFor(() => expect(document.querySelector(".Win98")).toBeNull());
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
  const output = document.querySelector(".TerminalOutput")!;
  expect(output.textContent).toContain("Type EXIT to return to Portfolio 98.");
  expect(output.querySelector(".HomeOutput")).not.toBeNull();
  expect(store.system.returnToWindows).toBe("dos-mode");
  const input = document.querySelector<HTMLInputElement>(
    'input[name="command"]',
  )!;
  expect(document.activeElement).toBe(input);
  expect(location.hash).toBe("#home");
  const startup = vi.spyOn(window.terminal, "enterWindowsStartup");
  vi.useFakeTimers();
  store.system.animations = true;
  const task = store.system.addCommand("exit", { animateCommand: false });
  await vi.advanceTimersByTimeAsync(100);
  expect(document.querySelector(".Experience--windows-startup")).not.toBeNull();
  await vi.advanceTimersByTimeAsync(2500);
  await task;
  expect(startup).toHaveBeenCalledOnce();
  expect(desktop()).not.toBeNull();
  expect(store.system.shutdown).toBe(false);
  expect(store.system.returnToWindows).toBeUndefined();
  expect(store.history.lastCommand).toBe("exit");
  expect(location.hash).toBe("#windows");
});

test("MS-DOS Prompt hands straight back: exit and win return without the startup screen", async () => {
  for (const command of ["exit", "win"]) {
    click("exit");
    await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
    expect(document.querySelector(".Win98")).toBeNull();
    expect(store.system.returnToWindows).toBe("prompt");
    store.system.animations = true;
    const task = store.system.addCommand(command, { animateCommand: false });
    expect(document.querySelector(".Experience--windows-startup")).toBeNull();
    await task;
    expect(desktop()).not.toBeNull();
    expect(store.system.returnToWindows).toBeUndefined();
    store.system.animations = false;
  }
});

test("without a way back, exit still shuts down; navigation and power-off forget the way back", async () => {
  click("exit");
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
  expect(store.system.returnToWindows).toBe("prompt");
  // Route navigation leaves the MS-DOS session behind.
  window.history.replaceState(null, "", "#projects");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await vi.waitFor(() => expect(store.history.lastCommand).toBe("projects"));
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
  expect(store.system.returnToWindows).toBeUndefined();
  await store.system.addCommand("exit", { animateCommand: false });
  expect(store.system.shutdown).toBe(true);
  expect(document.querySelector(".Win98")).toBeNull();
  // Power-off clears it as well.
  store.system.togglePower();
  const screen = document.querySelector<HTMLElement>(".CRTScreen")!;
  screen.inert = false;
  screen.removeAttribute("aria-hidden");
  delete screen.dataset.power;
  store.system.state = "";
  store.system.returnToWindows = "dos-mode";
  store.system.togglePower();
  expect(store.system.returnToWindows).toBeUndefined();
  screen.inert = false;
  screen.removeAttribute("aria-hidden");
  delete screen.dataset.power;
  store.system.state = "";
});

test("history Back from Portfolio 98 leaves the keyboard on the terminal output", async () => {
  expect(desktop().contains(document.activeElement)).toBe(true);
  window.history.replaceState(null, "", "#home");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await vi.waitFor(() => expect(document.querySelector(".Win98")).toBeNull());
  await vi.waitFor(() => expect(store.system.isInputAllowed).toBe(true));
  expect(document.activeElement).toBe(
    document.querySelector(".TerminalOutput"),
  );
});

test("Start follows its button, with Windows 98's structure and wording", () => {
  const start = desktop().querySelector<HTMLButtonElement>(".WinStart")!;
  expect(start.getAttribute("aria-haspopup")).toBe("menu");
  expect(start.querySelector("img")).toBeNull();
  expect(start.querySelector("svg.Win98Icon")).not.toBeNull();
  click("start");
  const menu = startMenu()!;
  expect(start.nextElementSibling).toBe(menu);
  expect(start.getAttribute("aria-expanded")).toBe("true");
  expect(start.getAttribute("aria-controls")).toBe(menu.id);
  expect(menu.getAttribute("role")).toBe("menu");
  expect(menu.querySelector(".WinMenuBanner")?.textContent).toBe(
    "Portfolio 98",
  );
  expect(menu.querySelector(".WinStartUser")).toBeNull();
  expect(
    [...menu.querySelectorAll(":scope > .WinMenuItem")].map(
      item => item.textContent,
    ),
  ).toEqual([
    "Programs",
    "Documents",
    "Settings",
    "Find",
    "Help",
    "Run…",
    "Shut Down…",
  ]);
  expect(
    [...menu.querySelectorAll(":scope > .WinMenuItem u")].map(
      letter => letter.textContent,
    ),
  ).toEqual(["P", "D", "S", "F", "H", "R", "u"]);
  // No duplicate shortcuts or mislabelled GitHub item any more.
  expect(menu.textContent).not.toContain("GitHub");
  expect(menu.textContent).not.toContain("MS-DOS mode");
  menuItem("Programs").click();
  const programs = desktop().querySelector<HTMLElement>(".WinStartSubmenu")!;
  expect(
    [...programs.querySelectorAll(".WinMenuItem")].map(
      item => item.textContent,
    ),
  ).toEqual([
    "Games",
    "Applications",
    "Tools",
    "Experiments & Learning",
    "My Projects",
    "MS-DOS Prompt",
  ]);
  menuItem("Games").click();
  const games = [
    ...desktop().querySelectorAll<HTMLElement>(".WinStartSubmenu"),
  ].at(-1)!;
  const items = [...games.querySelectorAll<HTMLElement>(".WinMenuItem")];
  expect(items[0].textContent).toBe("Open folder");
  expect(items[0].classList.contains("WinMenuItem--default")).toBe(true);
  expect(items.slice(1).map(item => item.textContent)).toEqual(
    projects
      .filter(project => project.category === "Game")
      .map(project => project.name),
  );
  items[0].click();
  expect(explorer().getAttribute("aria-label")).toBe("Games");
  expect(startMenu()).toBeNull();
});

test("Start: Right opens Programs on its first item, Left returns, Esc closes one level", () => {
  click("start");
  const programs = menuItem("Programs");
  expect(document.activeElement).toBe(programs);
  press("ArrowRight");
  const submenu = desktop().querySelector<HTMLElement>(".WinStartSubmenu")!;
  expect(document.activeElement).toBe(submenu.querySelector(".WinMenuItem"));
  expect(programs.getAttribute("aria-expanded")).toBe("true");
  press("ArrowLeft");
  expect(submenu.isConnected).toBe(false);
  expect(document.activeElement).toBe(programs);
  press("ArrowRight");
  press("ArrowRight");
  expect(desktop().querySelectorAll(".WinStartSubmenu")).toHaveLength(2);
  press("Escape");
  expect(desktop().querySelectorAll(".WinStartSubmenu")).toHaveLength(1);
  press("Escape");
  expect(desktop().querySelectorAll(".WinStartSubmenu")).toHaveLength(0);
  expect(document.activeElement).toBe(programs);
  press("Escape");
  expect(startMenu()).toBeNull();
  expect(document.activeElement).toBe(desktop().querySelector(".WinStart"));
});

test("Start: the u key chooses Shut Down…", () => {
  click("start");
  press("u");
  expect(startMenu()).toBeNull();
  const dialog = desktop().querySelector<HTMLElement>(".WinMessageBox")!;
  expect(dialog.textContent).toContain("Shut Down Portfolio 98");
  press("Escape");
});

test("Start on a phone pushes cascades in place with a Back row", () => {
  mockLayout(390, 700);
  click("start");
  const menu = startMenu()!;
  expect(menu.classList.contains("WinMenu--push")).toBe(true);
  // A tap opens the cascade in place of Start, without waiting for hover.
  menuItem("Find").dispatchEvent(
    new MouseEvent("click", { bubbles: true, detail: 1 }),
  );
  const find = desktop().querySelector<HTMLElement>(".WinStartSubmenu")!;
  expect(menu.hidden).toBe(true);
  expect(find.contains(document.activeElement)).toBe(true);
  const rows = [...find.querySelectorAll<HTMLElement>(".WinMenuItem")];
  expect(rows.map(row => row.textContent)).toEqual([
    "Back",
    "Projects…F3",
    "People…",
  ]);
  rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(find.isConnected).toBe(false);
  expect(menu.hidden).toBe(false);
  expect(document.activeElement).toBe(menuItem("Find"));
  // Then People… opens the Address Book.
  menuItem("Find").dispatchEvent(
    new MouseEvent("click", { bubbles: true, detail: 1 }),
  );
  menuItem("People…").dispatchEvent(
    new MouseEvent("click", { bubbles: true, detail: 1 }),
  );
  expect(win("contact").getAttribute("aria-label")).toBe("Address Book");
  expect(startMenu()).toBeNull();
});

test("Start ▸ Settings ▸ Animations is a check item bound to the animation preference", () => {
  const before = store.system.animations;
  for (const expected of [!before, before]) {
    click("start");
    menuItem("Settings").click();
    const item = menuItem("Animations");
    expect(item.getAttribute("role")).toBe("menuitemcheckbox");
    expect(item.getAttribute("aria-checked")).toBe(String(!expected));
    item.click();
    expect(store.system.animations).toBe(expected);
    expect(document.documentElement.dataset.animations).toBe(String(expected));
    expect(localStorage.getItem("portfolio-animations")).toBe(String(expected));
  }
  expect(store.system.animations).toBe(before);
});

test("Start ▸ Documents lists About Adam.txt and the projects opened this session", () => {
  click("project:tetris");
  click("project:paintaz");
  click("project:tetris");
  click("start");
  menuItem("Documents").click();
  const documents = desktop().querySelector<HTMLElement>(".WinStartSubmenu")!;
  const labels = [...documents.querySelectorAll(".WinMenuItem")].map(
    item => item.textContent,
  );
  expect(labels.slice(0, 3)).toEqual(["About Adam.txt", "Tetris", "paintAZ"]);
  expect(labels.length).toBeLessThanOrEqual(11);
});

test("startMenuItems offers Display effects only when the CRT setting is wired", async () => {
  const { startMenuItems } = await import("../components/win98/start-menu");
  let crt = true;
  const commands = {
    openFolder() {},
    openProject() {},
    openAbout() {},
    openContact() {},
    openFind() {},
    openHelp() {},
    run() {},
    shutDown() {},
    msDosPrompt() {},
    recentProjects: () => [],
    animations: { get: () => true, set() {} },
  };
  const settings = (items: ReturnType<typeof startMenuItems>) => {
    const entry = items.find(
      item => item !== "-" && item.label === "&Settings",
    );
    const submenu = entry !== "-" ? entry?.submenu : undefined;
    return typeof submenu === "function" ? submenu() : (submenu ?? []);
  };
  expect(
    settings(startMenuItems(commands)).map(item => item !== "-" && item.label),
  ).toEqual(["&Animations"]);
  const withCrt = settings(
    startMenuItems({
      ...commands,
      displayEffects: { get: () => crt, set: on => (crt = on) },
    }),
  );
  const display = withCrt[1];
  expect(display !== "-" && display.label).toBe("&Display effects");
  if (display !== "-") {
    expect(display.checked).toBe(true);
    display.action!();
  }
  expect(crt).toBe(false);
  // The documents list shows (Empty) without recent projects.
  const documents = startMenuItems(commands).find(
    item => item !== "-" && item.label === "&Documents",
  );
  const docs =
    documents !== "-" && typeof documents?.submenu === "function"
      ? documents.submenu()
      : [];
  expect(docs.at(-1)).toEqual({ label: "(Empty)", disabled: true });
});

test("Start ▸ Help opens Portfolio 98 Help", () => {
  click("start");
  menuItem("Help").click();
  const help = win("help");
  expect(help.getAttribute("aria-label")).toBe("Portfolio 98 Help");
  expect(help.textContent).toContain("Ctrl+Esc");
  expect(help.textContent).toContain("Show Desktop");
  expect(help.dataset.active).toBe("true");
});

test("Run resolves names and paths, explains what it cannot find and remembers the entry", async () => {
  const { resolveRunTarget } = await import("../components/win98/run");
  expect(resolveRunTarget("  PaintAZ ")).toEqual({
    kind: "project",
    id: "paintaz",
  });
  expect(resolveRunTarget("tetris")).toEqual({ kind: "project", id: "tetris" });
  expect(resolveRunTarget("Games")).toEqual({ kind: "folder", id: "games" });
  expect(resolveRunTarget("C:\\Portfolio\\Tools\\")).toEqual({
    kind: "folder",
    id: "tools",
  });
  expect(resolveRunTarget("c:\\portfolio")).toEqual({
    kind: "folder",
    id: "projects",
  });
  expect(resolveRunTarget('"notepad.exe"')).toEqual({ kind: "about" });
  expect(resolveRunTarget("About Adam.txt")).toEqual({ kind: "about" });
  expect(resolveRunTarget("explorer")).toEqual({
    kind: "folder",
    id: "projects",
  });
  expect(resolveRunTarget("find")).toEqual({ kind: "find" });
  expect(resolveRunTarget("COMMAND.COM")).toEqual({ kind: "prompt" });
  expect(resolveRunTarget("dos")).toEqual({ kind: "prompt" });
  expect(resolveRunTarget("nope")).toBeUndefined();
  expect(resolveRunTarget("c:\\portfolio\\nope")).toBeUndefined();
  expect(resolveRunTarget("   ")).toBeUndefined();

  click("start");
  menuItem("Run…").click();
  let box = desktop().querySelector<HTMLElement>(".WinMessageBox")!;
  expect(box.textContent).toContain(
    "Type the name of a project, folder or file, and Portfolio 98 will open it for you.",
  );
  const input = box.querySelector<HTMLInputElement>("input")!;
  expect(document.activeElement).toBe(input);
  expect(input.labels?.[0].textContent).toBe("Open:");
  input.value = "solitaire";
  key(input, "Enter");
  const error = desktop().querySelectorAll<HTMLElement>(".WinMessageBox")[1];
  expect(error.getAttribute("role")).toBe("alertdialog");
  // The Run box hands the foreground to its error message.
  expect(box.dataset.active).toBe("false");
  expect(error.textContent).toContain(
    "Cannot find 'solitaire'. Make sure you typed the name correctly, and then try again.",
  );
  messageButton(error, "ok").click();
  await vi.waitFor(() => expect(document.activeElement).toBe(input));
  expect(box.dataset.active).toBe("true");
  expect(box.isConnected).toBe(true);
  input.value = "tetris";
  key(input, "Enter");
  await vi.waitFor(() => expect(win("project:tetris")).not.toBeNull());
  expect(box.isConnected).toBe(false);
  // Run shows the last entry again; Browse… opens My Projects.
  click("minimize", explorer());
  click("start");
  menuItem("Run…").click();
  box = desktop().querySelector<HTMLElement>(".WinMessageBox")!;
  expect(box.querySelector("input")!.value).toBe("tetris");
  messageButton(box, "browse").click();
  await vi.waitFor(() => expect(explorer().hidden).toBe(false));
  expect(explorer().getAttribute("aria-label")).toBe("My Projects");
});

test("Show Desktop toggles: a second press restores the same windows and active window", () => {
  click("about");
  click("contact");
  click("recycle");
  click("minimize", explorer());
  click("about");
  const visible = () =>
    [...desktop().querySelectorAll<HTMLElement>(".WinWindow")]
      .filter(item => !item.hidden)
      .map(item => item.dataset.window);
  const order = () =>
    [...desktop().querySelectorAll<HTMLElement>(".WinWindow:not([hidden])")]
      .sort((a, b) => +a.style.zIndex - +b.style.zIndex)
      .map(item => item.dataset.window);
  const before = order();
  expect(before.at(-1)).toBe("about");
  click("desktop");
  expect(visible()).toEqual([]);
  click("desktop");
  expect(order()).toEqual(before);
  expect(win("about").dataset.active).toBe("true");
  expect(explorer().hidden).toBe(true);
  // Opening a window in between makes the next press hide again.
  click("desktop");
  click("find");
  click("desktop");
  expect(visible()).toEqual([]);
  click("desktop");
  expect(order()).toEqual(["find"]);
  // So does activating one from the taskbar.
  click("desktop");
  desktop()
    .querySelector<HTMLButtonElement>('.WinTask[data-tip="Address Book"]')!
    .click();
  click("desktop");
  expect(visible()).toEqual([]);
});

test("Quick Launch and the task band are toolbars with one Tab stop and arrow keys", () => {
  const launch = desktop().querySelector<HTMLElement>(".WinQuickLaunch")!;
  expect(launch.getAttribute("role")).toBe("toolbar");
  expect(launch.getAttribute("aria-label")).toBe("Quick Launch");
  const quick = [...launch.querySelectorAll<HTMLButtonElement>("button")];
  expect(quick.map(button => button.getAttribute("aria-label"))).toEqual([
    "Show Desktop",
    "My Projects",
    "Find Projects",
  ]);
  expect(quick.map(button => button.tabIndex)).toEqual([0, -1, -1]);
  // Show Desktop has its own icon, not My Computer's.
  const markup = (icon: string) => {
    const host = document.createElement("div");
    host.innerHTML = windowsIcon(icon, 16);
    return host.innerHTML;
  };
  expect(quick[0].innerHTML).toBe(markup("desktop"));
  expect(quick[0].innerHTML).not.toBe(markup("computer"));
  quick[0].focus();
  press("ArrowRight");
  expect(document.activeElement).toBe(quick[1]);
  press("ArrowLeft");
  press("ArrowLeft");
  expect(document.activeElement).toBe(quick[2]);
  const tasks = desktop().querySelector<HTMLElement>(".WinTasks")!;
  expect(tasks.getAttribute("role")).toBe("toolbar");
  expect(tasks.getAttribute("aria-label")).toBe("Running applications");
  click("about");
  const buttons = [...tasks.querySelectorAll<HTMLButtonElement>("button")];
  expect(buttons.map(button => button.tabIndex)).toEqual([-1, 0]);
  buttons[1].focus();
  press("End");
  expect(document.activeElement).toBe(buttons[1]);
  press("Home");
  expect(document.activeElement).toBe(buttons[0]);
  press("ArrowRight");
  expect(document.activeElement).toBe(buttons[1]);
  expect(desktop().getAttribute("aria-label")).toBe("Portfolio 98 desktop");
});

test("the foreground task scrolls into the task band", () => {
  const tasks = desktop().querySelector<HTMLElement>(".WinTasks")!;
  const rect = (left: number, width: number) =>
    ({ left, right: left + width, width }) as DOMRect;
  vi.spyOn(tasks, "getBoundingClientRect").mockReturnValue(rect(100, 300));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const index = [...tasks.children].indexOf(this);
      return rect(100 + index * 160 - tasks.scrollLeft, 160);
    },
  );
  click("about");
  click("contact");
  expect(tasks.scrollLeft).toBe(180);
  desktop().querySelector<HTMLButtonElement>(".WinTask")!.click();
  expect(tasks.scrollLeft).toBe(0);
});

test("a minimized window's task says so", () => {
  const task = desktop().querySelector<HTMLButtonElement>(".WinTask")!;
  expect(task.getAttribute("aria-label")).toBe("My Projects");
  click("minimize", explorer());
  expect(task.getAttribute("aria-label")).toBe("My Projects, minimized");
  expect(task.getAttribute("aria-pressed")).toBe("false");
  task.click();
  expect(task.getAttribute("aria-label")).toBe("My Projects");
  click("desktop");
  expect(task.getAttribute("aria-label")).toBe("My Projects, minimized");
  click("folder:games");
  expect(task.getAttribute("aria-label")).toBe("Games");
});

test("the clock shows the short time and changes on the minute", async () => {
  window.terminal.closeWindows();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 27, 9, 5, 45));
  await store.system.addCommand("windows", { animateCommand: false });
  const tray = desktop().querySelector<HTMLElement>(".WinClock")!;
  const clock = tray.querySelector("time")!;
  const short = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  expect(clock.textContent).toBe(short(new Date(2026, 10, 27, 9, 5)));
  expect(clock.textContent).not.toMatch(/^0/);
  // Not a control: the full date is read with the time, and the tooltip
  // shows it on hover.
  expect(tray.tagName).not.toBe("BUTTON");
  expect(tray.querySelector("button, [tabindex]")).toBeNull();
  expect(tray.querySelector(".VisuallyHidden")!.textContent).toContain("2026");
  expect(tray.dataset.tip).toContain("2026");
  expect(clock.dateTime).toBe(new Date(2026, 10, 27, 9, 5, 45).toISOString());
  await vi.advanceTimersByTimeAsync(14_000);
  expect(clock.textContent).toBe(short(new Date(2026, 10, 27, 9, 5)));
  await vi.advanceTimersByTimeAsync(1_100);
  expect(clock.textContent).toBe(short(new Date(2026, 10, 27, 9, 6)));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(clock.textContent).toBe(short(new Date(2026, 10, 27, 9, 7)));
  const { nextMinuteDelay } = await import("../components/win98/taskbar");
  expect(nextMinuteDelay(Date.UTC(2026, 0, 1, 0, 0, 45))).toBe(15_050);
});

test("the taskbar keeps its height when tasks overflow: no scrollbar, icon-sized tasks", async () => {
  const { compileString } = await import("sass");
  const css = compileString(
    readFileSync("src/styles/windows.scss", "utf8"),
  ).css;
  const rule = (selector: string) =>
    css.match(
      new RegExp(
        `(?:^|\\n)${selector.replace(/[.:-]/g, "\\$&")} \\{([^}]*)\\}`,
      ),
    )?.[1] ?? "";
  expect(rule(".WinTasks")).toContain("scrollbar-width: none");
  expect(rule(".WinTasks::-webkit-scrollbar")).toContain("display: none");
  expect(rule(".WinTask")).toContain("min-width: 40px");
  expect(rule(".WinTask")).toContain("flex: 0 1 160px");
});
