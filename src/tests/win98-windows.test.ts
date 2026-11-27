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
import { windowsIcon } from "../data/windows-icons";

let store: Store;
// Happy DOM emits hashchange after pushState/replaceState, unlike browsers,
// which would restart Portfolio 98 in the middle of a test.
const suppressHistoryHashChange = (event: HashChangeEvent) => {
  if (event.newURL) event.stopImmediatePropagation();
};
const desktop = () => document.querySelector<HTMLElement>(".Win98")!;
const explorer = () =>
  desktop().querySelector<HTMLElement>('[data-window="explorer"]')!;
const win = (id: string) =>
  desktop().querySelector<HTMLElement>(`[data-window="${id}"]`);
const icon = (action: string) =>
  desktop().querySelector<HTMLElement>(
    `.WinDesktopIcons [data-win-action="${action}"]`,
  )!;
const click = (action: string, root: ParentNode = desktop()) => {
  const button = root.querySelector<HTMLElement>(
    `[data-win-action="${action}"]`,
  );
  expect(button, action).not.toBeNull();
  button!.click();
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
/** The visible open menus' items. */
const menuItems = () => [
  ...desktop().querySelectorAll<HTMLElement>(
    ".WinMenu:not([hidden]) .WinMenuItem",
  ),
];
const labelOf = (item: HTMLElement) =>
  item.querySelector(".WinMenuLabel")!.textContent;
const menuItem = (label: string) => {
  const item = menuItems().find(element => labelOf(element) === label);
  expect(item, label).toBeDefined();
  return item!;
};
const openMenus = () => desktop().querySelectorAll(".WinMenu");
/** A right-click: a cancelable contextmenu at a point. */
const rightClick = (target: Element, x = 300, y = 200) => {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
};
const barItem = (window: HTMLElement, label: string) => {
  const item = [
    ...window.querySelectorAll<HTMLElement>(".WinMenuBarItem"),
  ].find(element => element.textContent === label);
  expect(item, label).toBeDefined();
  return item!;
};
const messageBox = () => desktop().querySelector<HTMLElement>(".WinMessageBox");
const messageButton = (id: string) =>
  messageBox()!.querySelector<HTMLButtonElement>(
    `[data-message-button="${id}"]`,
  )!;
const pointer = (
  target: Element,
  type: string,
  init: PointerEventInit = {},
) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    button: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};
/**
 * Happy DOM has no layout: the workspace gets a size, windows their inline
 * size (or 500 x 400) and nothing else takes room.
 */
function mockLayout(width: number, height: number) {
  const layout = { width, height };
  const proto = HTMLElement.prototype;
  const is = (element: HTMLElement, name: string) =>
    element.classList.contains(name);
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
    return is(this, "WinWindow") ? parseFloat(this.style.width) || 500 : 0;
  });
  vi.spyOn(proto, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return is(this, "WinWindow") ? parseFloat(this.style.height) || 400 : 0;
  });
  return layout;
}
const box = (element: HTMLElement) =>
  ["left", "top", "width", "height"].map(side =>
    parseFloat(element.style.getPropertyValue(side)),
  );
/** Drags a resize handle (or the size grip) by dx, dy, one frame at a time. */
function resize(handle: HTMLElement, dx: number, dy: number) {
  handle.setPointerCapture = vi.fn();
  handle.hasPointerCapture = () => true;
  handle.releasePointerCapture = vi.fn();
  pointer(handle, "pointerdown", { clientX: 500, clientY: 400 });
  pointer(handle, "pointermove", { clientX: 500 + dx, clientY: 400 + dy });
  vi.advanceTimersToNextFrame();
  return () => pointer(handle, "pointerup");
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
    '<div class="CRTScreen"><div id="root"></div></div><button data-toggle-power></button><p id="command-status"></p>';
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

// W2.4 System menu and shortcut menus

test("the title-bar icon is the system menu's button, with items by state", () => {
  const frame = explorer();
  const button = frame.querySelector<HTMLButtonElement>(".WinSysMenu")!;
  expect(button.getAttribute("aria-haspopup")).toBe("menu");
  expect(button.getAttribute("aria-label")).toBe("System menu, My Projects");
  // A keyboard click opens it with the first item focused.
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  const menu = desktop().querySelector<HTMLElement>(".WinSystemMenu")!;
  expect(menu.getAttribute("aria-label")).toBe("System menu, My Projects");
  expect(menuItems().map(labelOf)).toEqual([
    "Restore",
    "Move",
    "Size",
    "Minimize",
    "Maximize",
    "Close",
  ]);
  const disabled = () =>
    menuItems()
      .filter(item => item.getAttribute("aria-disabled") === "true")
      .map(labelOf);
  expect(disabled()).toEqual(["Restore", "Move", "Size"]);
  const close = menuItem("Close");
  expect(close.classList.contains("WinMenuItem--default")).toBe(true);
  expect(close.getAttribute("aria-keyshortcuts")).toBe("Alt+F4");
  expect(document.activeElement).toBe(menuItem("Restore"));
  menuItem("Maximize").click();
  expect(frame.classList.contains("WinWindow--maximized")).toBe(true);
  button.click();
  expect(disabled()).toEqual(["Move", "Size", "Maximize"]);
  menuItem("Restore").click();
  expect(frame.classList.contains("WinWindow--maximized")).toBe(false);
  // A second click closes the menu; Escape returns to the button.
  button.click();
  button.click();
  expect(openMenus()).toHaveLength(0);
  button.click();
  press("Escape");
  expect(document.activeElement).toBe(button);
  // Navigating renames it with the window.
  click("folder:games", frame);
  expect(button.getAttribute("aria-label")).toBe("System menu, Games");
});

test("double-clicking the system-menu icon closes the window, not maximize", () => {
  const frame = explorer();
  const button = frame.querySelector<HTMLButtonElement>(".WinSysMenu")!;
  const mouseClick = (target: Element, detail: number) => {
    pointer(target, "pointerdown", { pointerType: "mouse" });
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
  };
  mouseClick(button, 1);
  expect(openMenus()).toHaveLength(1);
  mouseClick(button, 2);
  button.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, detail: 2 }),
  );
  expect(frame.isConnected).toBe(false);
  expect(openMenus()).toHaveLength(0);
});

test("a double-click acts only when both clicks pressed the same control", () => {
  const mouseClick = (target: Element, detail: number) => {
    pointer(target, "pointerdown", { pointerType: "mouse" });
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
  };
  const dblclick = (target: Element) =>
    target.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, detail: 2 }),
    );
  // The first click hit a Start menu item that has gone; the second lands
  // on a desktop icon: it is selected, not opened.
  click("start");
  const help = menuItem("Help");
  mouseClick(help, 1);
  const prompt = icon("exit");
  mouseClick(prompt, 2);
  dblclick(prompt);
  expect(store.system.returnToWindows).toBeUndefined();
  expect(desktop()).not.toBeNull();
  // Two clicks on one icon still open it.
  const about = icon("about");
  mouseClick(about, 1);
  mouseClick(about, 2);
  dblclick(about);
  expect(win("about")).not.toBeNull();
  // A Close button's click, then a title bar beneath: no maximize.
  const notepad = win("about")!;
  const title = explorer().querySelector<HTMLElement>(".WinTitlebar strong")!;
  mouseClick(notepad.querySelector('[data-win-action="close"]')!, 1);
  expect(win("about")).toBeNull();
  mouseClick(title, 2);
  dblclick(title);
  expect(explorer().classList.contains("WinWindow--maximized")).toBe(false);
  // Both clicks on the title bar maximize.
  mouseClick(title, 1);
  mouseClick(title, 2);
  dblclick(title);
  expect(explorer().classList.contains("WinWindow--maximized")).toBe(true);
  // The system-menu icon needs both clicks too.
  const sysMenu = explorer().querySelector<HTMLElement>(".WinSysMenu")!;
  mouseClick(title, 1);
  mouseClick(sysMenu, 2);
  dblclick(sysMenu);
  expect(explorer().isConnected).toBe(true);
});

test("Alt+Space opens the focused window's system menu; Minimize and Close work", () => {
  click("about");
  const notepad = win("about")!;
  const text = notepad.querySelector("textarea")!;
  expect(document.activeElement).toBe(text);
  const event = press(" ", { altKey: true });
  expect(event.defaultPrevented).toBe(true);
  expect(desktop().querySelector(".WinSystemMenu")).not.toBeNull();
  menuItem("Minimize").click();
  expect(notepad.hidden).toBe(true);
  // A minimized window's menu (from its task button) can restore it.
  const task = desktop().querySelector<HTMLElement>(
    '.WinTask[data-tip="About Adam.txt - Notepad"]',
  )!;
  expect(rightClick(task).defaultPrevented).toBe(true);
  const items = menuItems();
  expect(
    items
      .filter(item => item.getAttribute("aria-disabled") === "true")
      .map(labelOf),
  ).toEqual(["Move", "Size", "Minimize"]);
  menuItem("Restore").click();
  expect(notepad.hidden).toBe(false);
  // The task button's menu gives the taskbar a real Close.
  rightClick(task);
  menuItem("Close").click();
  expect(win("about")).toBeNull();
});

test("Shift+F10 on an icon opens its menu with a bold Open; Esc returns focus", () => {
  const item = icon("project:paintaz");
  item.focus();
  const event = key(item, "F10", { shiftKey: true });
  expect(event.defaultPrevented).toBe(true);
  expect(item.getAttribute("aria-selected")).toBe("true");
  const items = menuItems();
  expect(labelOf(items[0])).toBe("Open");
  expect(items[0].classList.contains("WinMenuItem--default")).toBe(true);
  expect(document.activeElement).toBe(items[0]);
  expect(items.map(labelOf)).toEqual([
    "Open",
    "Open in New Tab ↗ (opens in a new tab)",
    "Source Code ↗ (opens in a new tab)",
    "Properties",
  ]);
  // The browser's own contextmenu for the same key changes nothing.
  expect(rightClick(document.activeElement!, 0, 0).defaultPrevented).toBe(true);
  expect(openMenus()).toHaveLength(1);
  press("Escape");
  expect(openMenus()).toHaveLength(0);
  expect(document.activeElement).toBe(item);
  // The Menu key does the same; Open opens the project.
  key(item, "ContextMenu");
  menuItem("Open").click();
  expect(win("project:paintaz")).not.toBeNull();
});

test("folder icons offer Explore; Properties describe an item", async () => {
  rightClick(icon("folder:games"));
  expect(menuItems().map(labelOf)).toEqual(["Open", "Explore", "Properties"]);
  menuItem("Explore").click();
  expect(explorer().getAttribute("aria-label")).toBe("Games");
  rightClick(icon("recycle"));
  expect(menuItem("Empty Recycle Bin").getAttribute("aria-disabled")).toBe(
    "true",
  );
  press("Escape");
  rightClick(icon("project:paintaz"));
  menuItem("Properties").click();
  const sheet = messageBox()!;
  expect(sheet.getAttribute("role")).toBe("dialog");
  expect(sheet.querySelector(".WinTitlebar")!.textContent).toContain(
    "paintAZ Properties",
  );
  const rows = [...sheet.querySelectorAll("dt")].map(
    term => `${term.textContent} ${term.nextElementSibling!.textContent}`,
  );
  expect(rows).toEqual([
    "Type: App",
    "Location: C:\\Portfolio\\Applications",
    "Technologies: C++, Qt, WebAssembly",
    "Demo: Yes, runs in a window",
    "Description: A cross-platform drawing app, now also available in the browser.",
  ]);
  messageButton("ok").click();
  expect(messageBox()).toBeNull();
  // Explorer's items share the menu; the drive is a Local Disk.
  click("computer");
  rightClick(explorer().querySelector('[data-name="Portfolio (C:)"]')!);
  menuItem("Properties").click();
  expect(messageBox()!.textContent).toContain("Local Disk");
  messageButton("ok").click();
});

test("the desktop's menu arranges icons, system icons first", () => {
  const names = () =>
    [
      ...desktop().querySelectorAll<HTMLElement>(
        ".WinDesktopIcons [data-list-item]",
      ),
    ].map(item => item.dataset.name);
  const workspace = desktop().querySelector(".WinWorkspace")!;
  expect(rightClick(workspace).defaultPrevented).toBe(true);
  expect(menuItems().map(labelOf)).toEqual([
    "Arrange Icons",
    "Line Up Icons",
    "Refresh",
    "Properties",
  ]);
  // The icons always sit on the grid: Auto Arrange is on.
  expect(menuItem("Line Up Icons").getAttribute("aria-disabled")).toBe("true");
  menuItem("Arrange Icons").click();
  menuItem("by Name").click();
  expect(names()).toEqual([
    "My Computer",
    "My Projects",
    "Recycle Bin",
    "About Adam.txt",
    "Contact",
    "Games",
    "MS-DOS Prompt",
    "paintAZ",
  ]);
  rightClick(desktop().querySelector(".WinDesktopIcons")!);
  menuItem("Arrange Icons").click();
  menuItem("by Type").click();
  expect(names()).toEqual([
    "My Computer",
    "My Projects",
    "Recycle Bin",
    "Contact",
    "paintAZ",
    "Games",
    "MS-DOS Prompt",
    "About Adam.txt",
  ]);
});

test("links, text fields and demos keep the browser's menu; chrome has none", () => {
  click("project:paintaz");
  const project = win("project:paintaz")!;
  expect(rightClick(project.querySelector("iframe")!).defaultPrevented).toBe(
    false,
  );
  click("find");
  const named = win("find")!.querySelector("input")!;
  expect(rightClick(named).defaultPrevented).toBe(false);
  click("contact");
  expect(rightClick(win("contact")!.querySelector("a")!).defaultPrevented).toBe(
    false,
  );
  // Window text keeps the browser's menu (Copy); the status bar has none.
  expect(rightClick(win("contact")!.querySelector("p")!).defaultPrevented).toBe(
    false,
  );
  const status = win("contact")!.querySelector(".WinStatus")!;
  expect(rightClick(status).defaultPrevented).toBe(true);
  expect(openMenus()).toHaveLength(0);
  // A title bar opens the window's system menu at the pointer.
  rightClick(win("contact")!.querySelector(".WinTitlebar strong")!);
  expect(desktop().querySelector(".WinSystemMenu")).not.toBeNull();
});

test("Explorer's empty space has the folder's menu", () => {
  const pane = explorer().querySelector<HTMLElement>(".WinFiles")!;
  rightClick(pane);
  expect(menuItems().map(labelOf)).toEqual([
    "View",
    "Arrange Icons",
    "Refresh",
    "Properties",
  ]);
  menuItem("View").click();
  menuItem("Details").click();
  expect(explorer().querySelector("table.WinDetails")).not.toBeNull();
  rightClick(explorer().querySelector(".WinFiles")!);
  menuItem("Properties").click();
  expect(messageBox()!.textContent).toContain(
    `${projects.length} project(s), 4 folder(s)`,
  );
  messageButton("ok").click();
});

test("the taskbar's menu cascades, tiles and minimizes all windows", () => {
  const layout = mockLayout(1200, 700);
  click("about");
  click("contact");
  click("find");
  const frames = () => [
    ...desktop().querySelectorAll<HTMLElement>(".WinWindow"),
  ];
  const tasks = desktop().querySelector(".WinTasks")!;
  rightClick(tasks);
  expect(menuItems().map(labelOf)).toEqual([
    "Cascade Windows",
    "Tile Windows Horizontally",
    "Tile Windows Vertically",
    "Minimize All Windows",
  ]);
  click("maximize", explorer());
  menuItem("Cascade Windows").click();
  const origins = frames().map(frame => box(frame).slice(0, 2).join());
  expect(new Set(origins).size).toBe(frames().length);
  expect(explorer().classList.contains("WinWindow--maximized")).toBe(false);
  rightClick(tasks);
  menuItem("Tile Windows Vertically").click();
  // Four windows side by side would be narrow: two rows of two.
  expect(frames().map(frame => box(frame))).toEqual(
    expect.arrayContaining([
      [0, 0, 600, 350],
      [600, 0, 600, 350],
      [0, 350, 600, 350],
      [600, 350, 600, 350],
    ]),
  );
  rightClick(tasks);
  menuItem("Tile Windows Horizontally").click();
  expect(
    frames()
      .map(frame => box(frame)[2])
      .every(width => width === layout.width / 2),
  ).toBe(true);
  rightClick(tasks);
  menuItem("Minimize All Windows").click();
  expect(frames().every(frame => frame.hidden)).toBe(true);
  rightClick(tasks);
  menuItem("Undo Minimize All").click();
  expect(frames().every(frame => !frame.hidden)).toBe(true);
  rightClick(tasks);
  expect(menuItems().map(labelOf)).not.toContain("Undo Minimize All");
});

test("a touch long press opens the shortcut menu; moving or scrolling cancels it", () => {
  vi.useFakeTimers();
  const item = icon("project:paintaz");
  const touch = { pointerType: "touch", isPrimary: true, pointerId: 5 };
  pointer(item, "pointerdown", { ...touch, clientX: 100, clientY: 100 });
  vi.advanceTimersByTime(499);
  expect(openMenus()).toHaveLength(0);
  vi.advanceTimersByTime(1);
  expect(openMenus()).toHaveLength(1);
  expect(labelOf(menuItems()[0])).toBe("Open");
  expect(item.getAttribute("aria-selected")).toBe("true");
  // The browser's own long-press event does not open a second menu.
  rightClick(item, 100, 100);
  expect(openMenus()).toHaveLength(1);
  // Lifting the finger must not open the project (a tap would), nor let a
  // compatibility mousedown take the keyboard out of the menu.
  pointer(item, "pointerup", { ...touch, clientX: 100, clientY: 100 });
  const down = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    detail: 1,
  });
  item.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  item.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(win("project:paintaz")).toBeNull();
  expect(openMenus()).toHaveLength(1);
  press("Escape");
  // Moving more than 8 px cancels.
  pointer(item, "pointerdown", { ...touch, clientX: 100, clientY: 100 });
  pointer(item, "pointermove", { ...touch, clientX: 106, clientY: 105 });
  pointer(item, "pointermove", { ...touch, clientX: 112, clientY: 100 });
  vi.advanceTimersByTime(600);
  expect(openMenus()).toHaveLength(0);
  pointer(item, "pointerup", touch);
  // So does a scroll, and a mouse press never starts one.
  pointer(item, "pointerdown", { ...touch, clientX: 100, clientY: 100 });
  desktop()
    .querySelector(".WinDesktopIcons")!
    .dispatchEvent(new Event("scroll"));
  vi.advanceTimersByTime(600);
  pointer(item, "pointerdown", { pointerType: "mouse", isPrimary: true });
  vi.advanceTimersByTime(600);
  expect(openMenus()).toHaveLength(0);
  // A later tap opens the item as usual.
  pointer(item, "pointerdown", touch);
  pointer(item, "pointerup", touch);
  item.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(win("project:paintaz")).not.toBeNull();
});

test("Display Properties applies the animation setting with OK, Apply or Cancel", () => {
  rightClick(desktop().querySelector(".WinWorkspace")!);
  menuItem("Properties").click();
  const sheet = messageBox()!;
  expect(sheet.querySelector(".WinTitlebar")!.textContent).toContain(
    "Display Properties",
  );
  const animations = sheet.querySelector<HTMLInputElement>(
    'input[name="animations"]',
  )!;
  expect(document.activeElement).toBe(animations);
  expect(animations.checked).toBe(false);
  // The terminal wires the CRT picture's Display effects (on by default).
  expect(
    sheet.querySelector<HTMLInputElement>('input[name="effects"]')!.checked,
  ).toBe(true);
  expect(messageButton("apply").disabled).toBe(true);
  animations.click();
  expect(messageButton("apply").disabled).toBe(false);
  messageButton("apply").click();
  expect(store.system.animations).toBe(true);
  expect(messageBox()).not.toBeNull();
  expect(messageButton("apply").disabled).toBe(true);
  animations.click();
  messageButton("cancel").click();
  expect(store.system.animations).toBe(true);
  rightClick(desktop().querySelector(".WinWorkspace")!);
  menuItem("Properties").click();
  messageBox()!
    .querySelector<HTMLInputElement>('input[name="animations"]')!
    .click();
  messageButton("ok").click();
  expect(store.system.animations).toBe(false);
});

test("Display Properties offers Display effects once the CRT setting is wired", async () => {
  const { WindowsDesktop } = await import("../components/windows-desktop");
  let crt = true;
  const other = WindowsDesktop(
    () => {},
    () => {},
    { displayEffects: { get: () => crt, set: on => (crt = on) } },
  );
  document.querySelector(".CRTScreen")!.append(other.element);
  try {
    rightClick(other.element.querySelector(".WinWorkspace")!);
    const properties = [
      ...other.element.querySelectorAll<HTMLElement>(".WinMenuItem"),
    ].find(item => labelOf(item) === "Properties")!;
    properties.click();
    const effects = other.element.querySelector<HTMLInputElement>(
      'input[name="effects"]',
    )!;
    expect(effects.checked).toBe(true);
    effects.click();
    other.element
      .querySelector<HTMLButtonElement>('[data-message-button="ok"]')!
      .click();
    expect(crt).toBe(false);
  } finally {
    other.dispose();
  }
});

// W2.5 Resizable windows

test("resizing follows the edges, keeps the minimum size and stays inside the workspace", () => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  mockLayout(1000, 600);
  click("about");
  const notepad = win("about")!;
  const layer = desktop().querySelector<HTMLElement>(".WinWindowLayer")!;
  const [left, top] = box(notepad);
  expect(notepad.querySelectorAll(".WinResize")).toHaveLength(8);
  // The size grip is the bottom-right handle.
  const grip = notepad.querySelector<HTMLElement>(".WinSizeGrip")!;
  const release = resize(grip, 100, 50);
  expect(layer.hasAttribute("data-interacting")).toBe(true);
  expect(box(notepad)).toEqual([left, top, 600, 450]);
  pointer(grip, "pointermove", { clientX: 5000, clientY: 5000 });
  vi.advanceTimersToNextFrame();
  expect(box(notepad)).toEqual([left, top, 1000 - left, 600 - top]);
  // Notepad keeps at least 240 x 140.
  pointer(grip, "pointermove", { clientX: -5000, clientY: -5000 });
  release();
  expect(layer.hasAttribute("data-interacting")).toBe(false);
  expect(box(notepad)).toEqual([left, top, 240, 140]);
  // The left edge moves the window and keeps the right edge in place.
  const west = notepad.querySelector<HTMLElement>(".WinResize--w")!;
  resize(west, 1000, 0)();
  expect(box(notepad)).toEqual([left, top, 240, 140]);
  resize(west, -5000, 0)();
  expect(box(notepad)).toEqual([0, top, left + 240, 140]);
  // The top edge stops at the workspace.
  resize(notepad.querySelector<HTMLElement>(".WinResize--n")!, 0, -5000)();
  expect(box(notepad)).toEqual([0, 0, left + 240, top + 140]);
  // Explorer and projects keep at least 320 x 200.
  click("project:paintaz");
  const project = win("project:paintaz")!;
  resize(project.querySelector<HTMLElement>(".WinResize--se")!, -5000, -5000)();
  expect(box(project).slice(2)).toEqual([320, 200]);
});

test("a maximized window ignores resizing, and restoring keeps the size", () => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  mockLayout(1000, 600);
  click("about");
  const notepad = win("about")!;
  const grip = notepad.querySelector<HTMLElement>(".WinSizeGrip")!;
  resize(grip, 40, 30)();
  const sized = box(notepad);
  expect(sized.slice(2)).toEqual([540, 430]);
  click("maximize", notepad);
  resize(grip, -100, -100)();
  click("maximize", notepad);
  expect(box(notepad)).toEqual(sized);
  // Minimize and restore keep it too.
  click("minimize", notepad);
  desktop()
    .querySelector<HTMLElement>(
      '.WinTask[data-tip="About Adam.txt - Notepad"]',
    )!
    .click();
  expect(box(notepad)).toEqual(sized);
});

test("the workspace observer keeps a resized window's size", async () => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  const notify = captureResizeObserver();
  window.terminal.closeWindows();
  await store.system.addCommand("windows", {
    animateCommand: false,
    focus: true,
  });
  const layout = mockLayout(1000, 600);
  click("about");
  const notepad = win("about")!;
  resize(notepad.querySelector<HTMLElement>(".WinSizeGrip")!, 200, 100)();
  const [left, top] = box(notepad);
  expect(box(notepad).slice(2)).toEqual([700, 500]);
  layout.width = 600;
  notify();
  // A narrower workspace clamps the window, and keeps the model.
  expect(box(notepad)).toEqual([0, top, 600, 500]);
  layout.width = 1000;
  notify();
  expect(box(notepad)).toEqual([left, top, 700, 500]);
});

// W2.7 Find: Projects

test("Find: Named, Containing text and Look in narrow the results", () => {
  click("find");
  const find = win("find")!;
  const field = (name: string) =>
    find.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const look = find.querySelector("select")!;
  const status = () => find.querySelector('[role="status"]')!.textContent;
  const names = () =>
    [
      ...find.querySelectorAll<HTMLElement>(".WinFindResults [data-list-item]"),
    ].map(item => item.dataset.name);
  expect(find.querySelector("fieldset legend")!.textContent).toBe(
    "Name & Location",
  );
  expect([...look.options].map(option => option.textContent)).toEqual([
    "Portfolio (C:)",
    "Games",
    "Applications",
    "Tools",
    "Experiments & Learning",
  ]);
  expect(find.querySelector(".WinFindResults")!.hasAttribute("hidden")).toBe(
    true,
  );
  // Enter in a field submits: Find Now is the default button.
  field("named").value = "paint";
  expect(key(field("named"), "Enter").defaultPrevented).toBe(true);
  expect(names()).toEqual(["paintAZ"]);
  expect(status()).toBe("1 project(s) found");
  expect(find.getAttribute("aria-label")).toBe("Find: Projects named paint");
  expect(find.querySelector(".WinFindResults")!.hasAttribute("hidden")).toBe(
    false,
  );
  // Containing text searches summaries and descriptions.
  field("named").value = "";
  field("text").value = "drawing app";
  key(look, "Enter");
  expect(names()).toEqual(["paintAZ"]);
  expect(find.getAttribute("aria-label")).toBe("Find: Projects");
  // A phrase from the description, across a line break and in any case.
  const html = document.createElement("template");
  const sample = projects.find(project => project.id === "tetris")!;
  html.innerHTML = sample.html;
  const words = [...html.content.querySelectorAll("p")]
    .map(paragraph => paragraph.textContent!.trim().split(/\s+/))
    .find(paragraph => paragraph.length >= 4)!;
  const phrase = ` ${words.slice(1, 4).join("\n ").toUpperCase()} `;
  field("text").value = phrase;
  key(field("text"), "Enter");
  expect(names()).toContain(sample.name);
  // Look in a folder; Portfolio (C:) without subfolders holds no projects.
  field("text").value = "";
  look.value = "games";
  key(look, "Enter");
  expect(names()).toEqual(
    projects
      .filter(project => project.category === "Game")
      .map(project => project.name),
  );
  look.value = "projects";
  field("subfolders").click();
  key(look, "Enter");
  expect(names()).toEqual([]);
  expect(status()).toBe("There are no items to show in this view.");
  // New Search clears the fields, results and title, and focuses Named.
  field("named").value = "x";
  find.querySelector<HTMLButtonElement>('[data-find="new"]')!.click();
  expect(field("named").value).toBe("");
  expect(field("subfolders").checked).toBe(true);
  expect(names()).toEqual([]);
  expect(status()).toBe("");
  expect(document.activeElement).toBe(field("named"));
  expect(find.getAttribute("aria-label")).toBe("Find: Projects");
});

test("Find shows results in Details with In Folder, or another view", () => {
  click("find");
  const find = win("find")!;
  find.querySelector<HTMLButtonElement>('[data-find="now"]')!.click();
  const table = find.querySelector("table.WinDetails")!;
  expect(
    [...table.querySelectorAll("th")].map(header => header.textContent),
  ).toEqual(["Name", "In Folder", "Type", "Technologies"]);
  const paint = table.querySelector<HTMLElement>(
    '[data-win-action="project:paintaz"]',
  )!;
  expect(
    [...paint.querySelectorAll("td")].map(cell => cell.textContent),
  ).toEqual([
    "paintAZ",
    "C:\\Portfolio\\Applications",
    "App",
    "C++, Qt, WebAssembly",
  ]);
  // Sorting by In Folder puts Applications first.
  find.querySelector<HTMLElement>('[data-sort="folder"]')!.click();
  expect(
    find
      .querySelector("tbody tr td:nth-child(2)")!
      .textContent!.startsWith("C:\\Portfolio\\Applications"),
  ).toBe(true);
  barItem(find, "View").click();
  menuItem("List").click();
  expect(find.querySelector(".WinFileList--list")).not.toBeNull();
  expect(
    find.querySelectorAll(".WinFileList--list [data-list-item]"),
  ).toHaveLength(projects.length);
  // File ▸ Close.
  barItem(find, "File").click();
  menuItem("Close").click();
  expect(win("find")).toBeNull();
});

test("with animations, Find searches for a moment and Stop keeps what it found", () => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "performance"],
  });
  store.system.animations = true;
  click("find");
  const find = win("find")!;
  const now = find.querySelector<HTMLButtonElement>('[data-find="now"]')!;
  const stop = find.querySelector<HTMLButtonElement>('[data-find="stop"]')!;
  expect(stop.disabled).toBe(true);
  now.focus();
  now.click();
  expect(find.querySelector("form")!.hasAttribute("data-searching")).toBe(true);
  expect(stop.disabled).toBe(false);
  expect(now.disabled).toBe(true);
  expect(document.activeElement).toBe(stop);
  vi.advanceTimersByTime(500);
  expect(stop.disabled).toBe(true);
  expect(find.querySelectorAll("tbody tr")).toHaveLength(projects.length);
  // Stopped at once, the search has found nothing yet.
  now.click();
  stop.click();
  expect(find.querySelector("form")!.hasAttribute("data-searching")).toBe(
    false,
  );
  expect(find.querySelectorAll("tbody tr")).toHaveLength(0);
  expect(document.activeElement).toBe(now);
});

// W2.8 Notepad

test("Notepad shows About Adam.txt as read-only plain text without a status bar", () => {
  click("about");
  const notepad = win("about")!;
  const text = notepad.querySelector<HTMLTextAreaElement>(
    "textarea.WinNotepadText",
  )!;
  expect(text.readOnly).toBe(true);
  expect(text.spellcheck).toBe(false);
  expect(text.getAttribute("aria-label")).toBe("About Adam.txt");
  expect(text.value).toMatch(/I'm Adam Zielonka/i);
  expect(text.value).toContain("-".repeat(32));
  expect(text.value).toContain(
    "Start ▸ Shut Down… ▸ Restart in MS-DOS mode returns to the terminal",
  );
  expect(notepad.querySelector("h2, hr, article")).toBeNull();
  const status = notepad.querySelector<HTMLElement>(".WinStatus")!;
  expect(status.hidden).toBe(true);
  expect(status.textContent).toBe("");
  expect(
    [...notepad.querySelectorAll(".WinMenuBarItem")].map(
      item => item.textContent,
    ),
  ).toEqual(["File", "Edit", "Search", "Help"]);
  // Word Wrap is on and toggles the wrap attribute.
  expect(text.getAttribute("wrap")).toBe("soft");
  barItem(notepad, "Edit").click();
  expect(menuItem("Word Wrap").getAttribute("aria-checked")).toBe("true");
  expect(menuItem("Copy").getAttribute("aria-disabled")).toBe("true");
  menuItem("Word Wrap").click();
  expect(text.getAttribute("wrap")).toBe("off");
  barItem(notepad, "Edit").click();
  menuItem("Select All").click();
  expect(text.selectionEnd - text.selectionStart).toBe(text.value.length);
  barItem(notepad, "Help").click();
  menuItem("About Notepad").click();
  expect(messageBox()!.textContent).toContain("Portfolio 98 Notepad");
  messageButton("ok").click();
  // The shortcut, caption and task button use the notepad icon, not info
  // (the caption its 16 px art).
  const markup = (element: Element) => element.querySelector("svg")!.innerHTML;
  const notepadIcon = (size: 16 | 32) => {
    const host = document.createElement("div");
    host.innerHTML = windowsIcon("notepad", size);
    return markup(host);
  };
  expect(markup(icon("about"))).toBe(notepadIcon(32));
  expect(markup(notepad.querySelector(".WinSysMenu")!)).toBe(notepadIcon(16));
  expect(markup(icon("about"))).not.toBe(
    markup(win("explorer") ?? icon("contact")),
  );
});

test("in Notepad, F3 finds the next match instead of opening Find", async () => {
  click("about");
  const notepad = win("about")!;
  const text = notepad.querySelector("textarea")!;
  key(text, "F3");
  expect(win("find")).toBeNull();
  const dialog = messageBox()!;
  expect(dialog.querySelector(".WinTitlebar")!.textContent).toContain("Find");
  dialog.querySelector("input")!.value = "TERMINAL";
  messageButton("next").click();
  await vi.waitFor(() =>
    expect(text.value.slice(text.selectionStart, text.selectionEnd)).toBe(
      "terminal",
    ),
  );
  const first = text.selectionStart;
  // F3 is Find Next: the next match, then a message when there is none.
  key(text, "F3");
  expect(text.selectionStart).toBeGreaterThan(first);
  expect(text.value.slice(text.selectionStart, text.selectionEnd)).toBe(
    "terminal",
  );
  key(text, "F3");
  expect(messageBox()!.textContent).toContain('Cannot find "TERMINAL"');
  messageButton("ok").click();
  expect(document.activeElement).toBe(text);
  // Elsewhere F3 still opens Find.
  key(desktop(), "F3");
  expect(win("find")).not.toBeNull();
});

// W2.9 Project windows

test("project menu bars work from the keyboard; About shows the project", () => {
  click("project:paintaz");
  const project = win("project:paintaz")!;
  const items = [...project.querySelectorAll<HTMLElement>(".WinMenuBarItem")];
  // F10 focuses File; arrows move along the bar and open menus.
  key(project, "F10");
  expect(document.activeElement).toBe(items[0]);
  press("ArrowRight");
  expect(document.activeElement).toBe(items[1]);
  press("ArrowDown");
  expect(labelOf(document.activeElement as HTMLElement)).toBe("Maximize");
  press("Enter");
  expect(project.classList.contains("WinWindow--maximized")).toBe(true);
  // F10 always highlights File, as in Windows 98.
  key(project, "F10");
  expect(document.activeElement).toBe(items[0]);
  press("ArrowRight");
  press("ArrowDown");
  expect(labelOf(document.activeElement as HTMLElement)).toBe("Restore");
  press("ArrowRight");
  expect(menuItems().map(labelOf)).toEqual([
    "paintAZ Help Topics",
    "About paintAZ…",
  ]);
  press("a");
  const about = messageBox()!;
  expect(about.querySelector(".WinTitlebar")!.textContent).toContain(
    "About paintAZ",
  );
  expect(about.textContent).toContain("Category: App");
  expect(about.textContent).toContain("Technologies: C++, Qt, WebAssembly");
  messageButton("ok").click();
  barItem(project, "Help").click();
  menuItem("paintAZ Help Topics").click();
  expect(win("help:paintaz")!.getAttribute("aria-label")).toBe("paintAZ Help");
});

test("demo frames: no allowfullscreen, a busy pointer until loaded, a shield when inactive", () => {
  click("project:paintaz");
  const project = win("project:paintaz")!;
  const frame = project.querySelector("iframe")!;
  expect(frame.hasAttribute("allowfullscreen")).toBe(false);
  expect(frame.getAttribute("allow")).toBe("fullscreen; clipboard-write");
  expect(frame.getAttribute("sandbox")).toContain("allow-scripts");
  expect(project.hasAttribute("data-loading")).toBe(true);
  frame.dispatchEvent(new Event("load"));
  expect(project.hasAttribute("data-loading")).toBe(false);
  // The demo is cross-origin here: an inactive window shields it, and a
  // press on the shield activates the window and gives the demo the keyboard.
  const body = project.querySelector<HTMLElement>(".WinAppBody")!;
  expect(body.hasAttribute("data-shield")).toBe(true);
  click("contact");
  expect(project.dataset.active).toBe("false");
  const event = pointer(body, "pointerdown");
  expect(event.defaultPrevented).toBe(true);
  expect(project.dataset.active).toBe("true");
  expect(document.activeElement).toBe(frame);
});

// Review fixes: modality, keyboard focus and shell details

/** Opens About Portfolio 98 from Explorer's Help menu. */
function openAbout() {
  barItem(explorer(), "Help").click();
  menuItem("About Portfolio 98").click();
  return messageBox()!;
}

test("a modal box blocks the desktop: presses, menus and shortcuts stay out", () => {
  const box = openAbout();
  const ok = messageButton("ok");
  expect(document.activeElement).toBe(ok);
  // A press outside the box lands on its layer and keeps the keyboard.
  const layer = desktop().querySelector<HTMLElement>(".WinModal")!;
  expect(pointer(layer, "pointerdown").defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(ok);
  // Focus that reaches the desktop itself comes back.
  desktop().focus();
  expect(box.contains(document.activeElement)).toBe(true);
  // No shell menu opens through the box, by mouse or keyboard.
  expect(rightClick(desktop()).defaultPrevented).toBe(true);
  expect(rightClick(layer).defaultPrevented).toBe(true);
  key(desktop(), "F10", { shiftKey: true });
  expect(openMenus()).toHaveLength(0);
  // Desktop shortcuts do nothing behind it; Ctrl+Esc does not cancel it.
  key(desktop(), "F3");
  key(desktop(), "Escape", { ctrlKey: true });
  key(ok, "Escape", { ctrlKey: true });
  expect(win("find")).toBeNull();
  expect(desktop().querySelector(".WinStartMenu")).toBeNull();
  expect(messageBox()).toBe(box);
  // Alt+F4 closes it as Cancel does.
  key(ok, "F4", { altKey: true });
  expect(messageBox()).toBeNull();
  // The desktop's menu works again.
  rightClick(desktop().querySelector(".WinWorkspace")!);
  expect(menuItems().map(labelOf)).toContain("Properties");
});

test("switching windows returns the keyboard to the control that had it", () => {
  press("F3");
  const find = win("find")!;
  const named = find.querySelector<HTMLInputElement>('input[name="named"]')!;
  expect(document.activeElement).toBe(named);
  const task = (title: string) =>
    desktop().querySelector<HTMLElement>(`.WinTask[data-tip="${title}"]`)!;
  // Explorer had no remembered control: its file pane takes the keyboard.
  task("My Projects").click();
  expect(document.activeElement?.closest("[data-listview]")).not.toBeNull();
  expect(explorer().contains(document.activeElement)).toBe(true);
  key(document.activeElement!, "ArrowRight");
  const item = document.activeElement as HTMLElement;
  expect(item.dataset.winAction).toBe("folder:apps");
  // Back to Find: the Named field again, then back to the same item.
  task("Find: Projects").click();
  expect(document.activeElement).toBe(named);
  task("My Projects").click();
  expect(document.activeElement).toBe(item);
  // Restoring a minimized window and clicking a title bar do the same.
  task("My Projects").click();
  expect(explorer().hidden).toBe(true);
  task("My Projects").click();
  expect(document.activeElement).toBe(item);
  pointer(find.querySelector(".WinTitlebar strong")!, "pointerdown");
  expect(document.activeElement).toBe(named);
  // Notepad's default is its text.
  click("about");
  const text = win("about")!.querySelector("textarea")!;
  task("My Projects").click();
  task("About Adam.txt - Notepad").click();
  expect(document.activeElement).toBe(text);
});

test("caption and tool buttons keep the keyboard in the window; touch is left alone", () => {
  click("about");
  const text = win("about")!.querySelector("textarea")!;
  expect(document.activeElement).toBe(text);
  // A mouse press on a caption button does not focus it (the click still
  // runs it): Enter then acts on the client, not the button.
  const maximize = explorer().querySelector<HTMLElement>(
    '[data-win-action="maximize"]',
  )!;
  const down = pointer(maximize, "pointerdown", { pointerType: "mouse" });
  expect(down.defaultPrevented).toBe(true);
  // The inactive window's own control takes the keyboard.
  expect(explorer().contains(document.activeElement)).toBe(true);
  expect(document.activeElement?.closest("[data-listview]")).not.toBeNull();
  maximize.click();
  expect(explorer().classList.contains("WinWindow--maximized")).toBe(true);
  // Tool buttons too; a touch press keeps the browser's own focus.
  const up = explorer().querySelector<HTMLElement>('[data-explorer="up"]')!;
  expect(
    pointer(up, "pointerdown", { pointerType: "pen" }).defaultPrevented,
  ).toBe(true);
  expect(
    pointer(maximize, "pointerdown", { pointerType: "touch" }).defaultPrevented,
  ).toBe(false);
  // Caption buttons are never where activation returns the keyboard.
  maximize.focus();
  click("about");
  explorer()
    .ownerDocument.querySelector<HTMLElement>(
      '.WinTask[data-tip="My Projects"]',
    )!
    .click();
  expect(document.activeElement).not.toBe(maximize);
  expect(explorer().contains(document.activeElement)).toBe(true);
});

test("resizing a window gives it the keyboard, so Alt+F4 closes that one", () => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
  });
  mockLayout(1000, 600);
  click("contact");
  expect(win("contact")!.contains(document.activeElement)).toBe(true);
  resize(explorer().querySelector<HTMLElement>(".WinResize--e")!, -10, 0)();
  expect(explorer().dataset.active).toBe("true");
  expect(explorer().contains(document.activeElement)).toBe(true);
  press("F4", { altKey: true });
  expect(win("explorer")).toBeNull();
  expect(win("contact")).not.toBeNull();
});

test("a second press on the system-menu icon closes its menu, by mouse or touch", () => {
  const button = explorer().querySelector<HTMLButtonElement>(".WinSysMenu")!;
  for (const pointerType of ["mouse", "touch"]) {
    const down = pointer(button, "pointerdown", { pointerType });
    // A touch press focuses the icon before its click, as browsers do.
    if (!down.defaultPrevented) button.focus();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(openMenus()).toHaveLength(1);
    const again = pointer(button, "pointerdown", { pointerType });
    if (!again.defaultPrevented) button.focus();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(openMenus()).toHaveLength(0);
    // A mouse-opened menu hands the keyboard back to the window.
    if (pointerType === "mouse")
      expect(document.activeElement?.closest("[data-listview]")).not.toBeNull();
  }
  // The system menu shows the caption glyphs beside their commands.
  button.click();
  const glyphs = menuItems()
    .filter(item => item.querySelector(".WinMenuCheck .WinCaptionGlyph"))
    .map(labelOf);
  expect(glyphs).toEqual(["Restore", "Minimize", "Maximize", "Close"]);
});

test("Start's own shortcut menu opens My Projects, explores and finds", () => {
  const start = desktop().querySelector<HTMLElement>(".WinStart")!;
  click("close", explorer());
  expect(rightClick(start).defaultPrevented).toBe(true);
  expect(menuItems().map(labelOf)).toEqual(["Open", "Explore", "Find…"]);
  expect(menuItem("Open").classList.contains("WinMenuItem--default")).toBe(
    true,
  );
  menuItem("Explore").click();
  expect(explorer().getAttribute("aria-label")).toBe("My Computer");
  rightClick(start);
  menuItem("Find…").click();
  expect(win("find")).not.toBeNull();
  // The rest of the taskbar keeps its own menu.
  rightClick(desktop().querySelector(".WinTasks")!);
  expect(menuItems().map(labelOf)).toContain("Cascade Windows");
});

test("Alt+Shift accelerators switch menus while one is open; F10 starts at File", () => {
  const items = [
    ...explorer().querySelectorAll<HTMLElement>(".WinMenuBarItem"),
  ];
  const chord = (code: string) =>
    key(document.activeElement!, code.slice(3).toLowerCase(), {
      altKey: true,
      shiftKey: true,
      code,
    });
  focusExplorerPane();
  chord("KeyV");
  expect(items[1].getAttribute("aria-expanded")).toBe("true");
  // The open menu lives outside the window; the chord still reaches the bar.
  expect(document.activeElement?.closest(".WinMenu")).not.toBeNull();
  chord("KeyH");
  expect(items[1].getAttribute("aria-expanded")).toBe("false");
  expect(items[3].getAttribute("aria-expanded")).toBe("true");
  expect(labelOf(document.activeElement as HTMLElement)).toBe(
    "About Portfolio 98",
  );
  press("Escape");
  press("Escape");
  // F10 highlights File, not the menu used last.
  key(document.activeElement!, "F10");
  expect(document.activeElement).toBe(items[0]);
});

/** Puts the keyboard in Explorer's file pane. */
function focusExplorerPane() {
  const list = explorer().querySelector<HTMLElement>(
    ".WinFiles [data-listview]",
  )!;
  list.querySelector<HTMLElement>('[tabindex="0"]')!.focus();
}

test("taskbar toolbars are one Tab stop that follows the arrow keys", () => {
  const launch = desktop().querySelector<HTMLElement>(".WinQuickLaunch")!;
  const buttons = [...launch.querySelectorAll<HTMLElement>("button")];
  const stops = () => buttons.map(button => button.tabIndex);
  expect(stops()).toEqual([0, -1, -1]);
  buttons[0].focus();
  press("ArrowRight");
  press("ArrowRight");
  expect(document.activeElement).toBe(buttons[2]);
  expect(stops()).toEqual([-1, -1, 0]);
  // The task band too, until the next activation resets it.
  click("about");
  const tasks = () => [
    ...desktop().querySelectorAll<HTMLElement>(".WinTasks .WinTask"),
  ];
  tasks()[1].focus();
  press("Home");
  expect(document.activeElement).toBe(tasks()[0]);
  expect(tasks().map(task => task.tabIndex)).toEqual([0, -1]);
});

test("Display effects shows off and unavailable while high contrast forces it off", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      media: query,
      matches: query.includes("forced-colors"),
      addEventListener() {},
      removeEventListener() {},
    })),
  );
  const crt = () => document.documentElement.dataset.crt;
  expect(crt()).not.toBe("off");
  click("start");
  menuItem("Settings").click();
  const effects = menuItem("Display effects");
  expect(effects.getAttribute("aria-checked")).toBe("false");
  expect(effects.getAttribute("aria-disabled")).toBe("true");
  effects.click();
  expect(crt()).not.toBe("off");
  press("Escape");
  press("Escape");
  press("Escape");
  rightClick(desktop().querySelector(".WinWorkspace")!);
  menuItem("Properties").click();
  const box = messageBox()!;
  const input = box.querySelector<HTMLInputElement>('input[name="effects"]')!;
  expect(input.disabled).toBe(true);
  expect(input.checked).toBe(false);
  expect(input.nextElementSibling!.textContent).toContain(
    "off in high contrast",
  );
  // Changing animations applies without touching the stored CRT choice.
  box.querySelector<HTMLInputElement>('input[name="animations"]')!.click();
  messageButton("ok").click();
  expect(store.system.animations).toBe(true);
  expect(crt()).not.toBe("off");
});

test("dialogs right-align their buttons; property sheets show their tab", () => {
  rightClick(icon("project:paintaz"));
  menuItem("Properties").click();
  const sheet = messageBox()!;
  expect(sheet.classList.contains("WinMessageBox--dialog")).toBe(true);
  expect(sheet.querySelector(".WinSheetTabs")!.textContent).toBe("General");
  expect(
    sheet.querySelector(".WinSheetTabs")!.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(sheet.querySelector(".WinSheetPage")).not.toBeNull();
  messageButton("ok").click();
  // Run is a dialog without a tab; About is a plain message box.
  click("start");
  menuItem("Run…").click();
  const run = messageBox()!;
  expect(run.classList.contains("WinMessageBox--dialog")).toBe(true);
  expect(run.querySelector(".WinSheetTabs")).toBeNull();
  messageButton("cancel").click();
  const about = openAbout();
  expect(about.classList.contains("WinMessageBox--dialog")).toBe(false);
});
