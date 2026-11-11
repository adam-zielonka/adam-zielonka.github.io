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
  expect(explorer().querySelectorAll(".WinProjectGrid button")).toHaveLength(
    projects.length,
  );
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

test("filters folders without duplicating Explorer and supports list view", () => {
  click("folder:games");
  const gameIds = projects
    .filter(project => project.category === "Game")
    .map(project => `project:${project.id}`);
  expect(
    [...explorer().querySelectorAll<HTMLElement>(".WinProjectGrid button")].map(
      item => item.dataset.winAction,
    ),
  ).toEqual(gameIds);
  expect(desktop().querySelectorAll('[data-window="explorer"]')).toHaveLength(
    1,
  );
  click("view", explorer());
  expect(explorer().querySelector(".WinFiles--list")).not.toBeNull();
  click("folder:projects", explorer());
  expect(explorer().querySelectorAll(".WinProjectGrid button")).toHaveLength(
    projects.length,
  );
});

test("opens real project descriptions and safe demo/source links", () => {
  for (const project of projects) {
    click(`project:${project.id}`, explorer());
    const win = desktop().querySelector<HTMLElement>(
      `[data-window="project:${project.id}"]`,
    )!;
    expect(win.textContent).toContain(project.summary);
    const expectedBody = document.createElement("div");
    expectedBody.innerHTML = project.html;
    expect(win.querySelector(".WinReadme")!.textContent).toBe(
      expectedBody.textContent,
    );
    const links = [
      ...win.querySelectorAll<HTMLAnchorElement>(".WinProjectLinks a"),
    ];
    expect(links.map(item => item.getAttribute("href"))).toContain(
      project.source,
    );
    if (project.demo)
      expect(links.map(item => item.getAttribute("href"))).toContain(
        project.demo,
      );
    for (const anchor of links) {
      expect(anchor.target).toBe("_blank");
      expect(anchor.rel).toContain("noopener");
    }
    click("close", win);
  }
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
  const menu = desktop().querySelector<HTMLElement>(".WinStartMenu")!;
  const buttons = menu.querySelectorAll<HTMLButtonElement>("button");
  expect(menu.hidden).toBe(false);
  expect(document.activeElement).toBe(buttons[0]);
  buttons[0].dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true }),
  );
  expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  menu.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(menu.hidden).toBe(true);
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
  const clear = vi.spyOn(window, "clearInterval");
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
  expect(win.style.left).toBe("0px");
  expect(win.style.top).toBe("0px");
  title.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
  );
  title.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      clientX: 400,
      clientY: 400,
    }),
  );
  expect(win.style.left).toBe("0px");
  expect(title.releasePointerCapture).toHaveBeenCalledWith(1);
});

test("touch focus changes do not dismiss Start before a menu option is clicked", () => {
  click("start");
  const menu = desktop().querySelector<HTMLElement>(".WinStartMenu")!;
  const option = menu.querySelector<HTMLButtonElement>(
    '[data-win-action="folder:games"]',
  )!;
  const icon = option.querySelector("svg")!;
  icon.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
    }),
  );
  // Mobile browsers can focus the container rather than the tapped button.
  desktop().focus();
  expect(menu.hidden).toBe(false);
  icon.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
    }),
  );
  icon.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(explorer().getAttribute("aria-label")).toBe("Games — Explorer");
  expect(menu.hidden).toBe(true);
});

test("a touch scroll or cancelled gesture in Start does not activate an item", () => {
  click("start");
  const menu = desktop().querySelector<HTMLElement>(".WinStartMenu")!;
  const option = menu.querySelector<HTMLButtonElement>(
    '[data-win-action="folder:games"]',
  )!;
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
  expect(menu.hidden).toBe(false);
  expect(explorer().getAttribute("aria-label")).toBe("My Projects — Explorer");
  desktop().dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 8,
    }),
  );
  expect(menu.hidden).toBe(true);
});

test("keyboard focus leaving Start still dismisses the menu", () => {
  click("start");
  const menu = desktop().querySelector<HTMLElement>(".WinStartMenu")!;
  menu.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
  );
  explorer().focus();
  expect(menu.hidden).toBe(true);
});

test("Start Shut Down runs the terminal shutdown screen and cleans up the desktop", async () => {
  click("start");
  const menu = desktop().querySelector<HTMLElement>(".WinStartMenu")!;
  click("shutdown", menu);
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
    expect(splash.textContent).toContain("Starting Windows 98");
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
