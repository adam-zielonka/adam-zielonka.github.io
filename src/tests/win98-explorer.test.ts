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
import { windowsToolIcon } from "../data/windows-icons";

let store: Store;
const desktop = () => document.querySelector<HTMLElement>(".Win98")!;
const explorer = () =>
  desktop().querySelector<HTMLElement>('[data-window="explorer"]')!;
const win = (id: string) =>
  desktop().querySelector<HTMLElement>(`[data-window="${id}"]`);
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
const menuLabels = () =>
  [
    ...desktop().querySelectorAll<HTMLElement>(
      ".WinMenu:not([hidden]) .WinMenuItem",
    ),
  ].map(item => item.querySelector(".WinMenuLabel")!.textContent);
/** Opens one of Explorer's menu-bar menus. */
const openBarMenu = (label: string) => {
  const item = [
    ...explorer().querySelectorAll<HTMLElement>(".WinMenuBarItem"),
  ].find(element => element.textContent === label);
  expect(item, label).toBeDefined();
  // A mouse press first, as a browser sends: the bar remembers the focus.
  item!.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
  );
  item!.click();
};
const pane = () => explorer().querySelector<HTMLElement>("[data-listview]")!;
const files = () => [
  ...pane().querySelectorAll<HTMLElement>("[data-list-item]"),
];
const fileItem = (action: string) =>
  pane().querySelector<HTMLElement>(`[data-win-action="${action}"]`)!;
const tool = (command: string) =>
  explorer().querySelector<HTMLButtonElement>(`[data-explorer="${command}"]`)!;
const caption = () => explorer().getAttribute("aria-label");
const status = () =>
  [...explorer().querySelectorAll<HTMLElement>(".WinStatusField")].map(
    field => field.textContent,
  );
const mouseSelect = (item: Element) => {
  item.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "mouse",
      button: 0,
    }),
  );
  item.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
};
const games = projects.filter(project => project.category === "Game");

beforeAll(async () => {
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
  vi.useRealTimers();
});
afterAll(() => {
  document.body.replaceChildren();
});

test("Explorer has a menu bar, Standard Buttons and an Address band", () => {
  const bar = explorer().querySelector<HTMLElement>('[role="menubar"]')!;
  expect(
    [...bar.querySelectorAll(".WinMenuBarItem")].map(item => item.textContent),
  ).toEqual(["File", "View", "Go", "Help"]);
  // Directly below the caption, outside the scrolling body.
  expect(bar.previousElementSibling?.className).toBe("WinTitlebar");
  const toolbar = explorer().querySelector<HTMLElement>('[role="toolbar"]')!;
  expect(toolbar.getAttribute("aria-label")).toBe("Standard Buttons");
  expect(
    [...toolbar.querySelectorAll("button")].map(
      button => button.textContent || button.getAttribute("aria-label"),
    ),
  ).toEqual(["Back", "Forward", "Up", "Views", "Choose a view"]);
  // One Tab stop that follows the arrow keys.
  expect([...toolbar.querySelectorAll("button")].map(b => b.tabIndex)).toEqual([
    0, -1, -1, -1, -1,
  ]);
  tool("back").focus();
  press("ArrowRight");
  expect(document.activeElement).toBe(tool("forward"));
  expect(tool("forward").tabIndex).toBe(0);
  expect(tool("back").tabIndex).toBe(-1);
  // Nothing to go back to yet.
  expect(tool("back").getAttribute("aria-disabled")).toBe("true");
  expect(tool("forward").getAttribute("aria-disabled")).toBe("true");
  expect(tool("up").hasAttribute("aria-disabled")).toBe(false);
  const address = explorer().querySelector<HTMLInputElement>(
    ".WinAddressBand input",
  )!;
  expect(address.readOnly).toBe(true);
  expect(address.value).toBe("C:\\Portfolio");
  expect(address.labels?.[0]?.textContent).toBe("Address");
  // The old About button is gone; Help ▸ About Portfolio 98 replaces it.
  expect(explorer().querySelector('[data-win-action="about"]')).toBeNull();
  const glyph = new DOMParser()
    .parseFromString(windowsToolIcon("folder-up"), "text/html")
    .querySelector("img")!;
  expect(glyph.alt).toBe("");
  expect(decodeURIComponent(glyph.src)).toContain('viewBox="0 0 20 20"');
});

test("Back, Forward and Up keep the window's history; Backspace and Alt+arrows too", () => {
  fileItem("folder:games").focus();
  press("Enter");
  expect(caption()).toBe("Games");
  expect(tool("back").hasAttribute("aria-disabled")).toBe(false);
  // Focus lands in the new pane, never on the frame.
  expect(document.activeElement).toBe(files()[0]);
  press("ArrowLeft", { altKey: true });
  expect(caption()).toBe("My Projects");
  expect(tool("forward").hasAttribute("aria-disabled")).toBe(false);
  press("ArrowRight", { altKey: true });
  expect(caption()).toBe("Games");
  expect(tool("forward").getAttribute("aria-disabled")).toBe("true");
  // Backspace goes up, and that is a new place in the history.
  press("Backspace");
  expect(caption()).toBe("My Projects");
  tool("back").click();
  expect(caption()).toBe("Games");
  tool("forward").click();
  expect(caption()).toBe("My Projects");
  tool("up").click();
  expect(caption()).toBe("My Computer");
  expect(tool("up").getAttribute("aria-disabled")).toBe("true");
  tool("up").click();
  press("Backspace");
  expect(caption()).toBe("My Computer");
  // Go menu: the same commands, with their state.
  openBarMenu("Go");
  expect(menuLabels()).toEqual([
    "Back",
    "Forward",
    "Up One Level",
    "My Computer",
    "My Projects",
  ]);
  expect(menuItem("Back").getAttribute("aria-keyshortcuts")).toBe(
    "Alt+ArrowLeft",
  );
  expect(menuItem("Forward").getAttribute("aria-disabled")).toBe("true");
  expect(menuItem("Up One Level").getAttribute("aria-disabled")).toBe("true");
  menuItem("My Projects").click();
  expect(caption()).toBe("My Projects");
  // Opening a place from the desktop joins the same window's history.
  click("recycle", desktop().querySelector(".WinDesktopIcons")!);
  expect(caption()).toBe("Recycle Bin");
  expect(desktop().querySelectorAll('[data-window="explorer"]')).toHaveLength(
    1,
  );
  tool("back").click();
  expect(caption()).toBe("My Projects");
});

test("a view change keeps focus on its control; the View menu returns it to the pane", () => {
  tool("views").focus();
  tool("views").click();
  expect(document.activeElement).toBe(tool("views"));
  expect(pane().classList.contains("WinFileList--small")).toBe(true);
  // From the menu bar, focus goes back to the selected item in the new view.
  mouseSelect(fileItem("project:paintaz"));
  openBarMenu("View");
  expect(
    [...desktop().querySelectorAll(".WinMenu .WinMenuItem")]
      .filter(item => item.getAttribute("role") === "menuitemradio")
      .map(item => [item.textContent, item.getAttribute("aria-checked")]),
  ).toEqual([
    ["Large Icons", "false"],
    ["Small Icons", "true"],
    ["List", "false"],
    ["Details", "false"],
  ]);
  menuItem("List").click();
  expect(pane().classList.contains("WinFileList--list")).toBe(true);
  expect(pane().dataset.flow).toBe("column");
  expect(document.activeElement).toBe(fileItem("project:paintaz"));
  expect(fileItem("project:paintaz").getAttribute("aria-selected")).toBe(
    "true",
  );
  // The Views arrow opens the same choices.
  tool("views-menu").click();
  expect(tool("views-menu").getAttribute("aria-expanded")).toBe("true");
  menuItem("Large Icons").click();
  expect(pane().classList.contains("WinFileList--large")).toBe(true);
  expect(document.activeElement).toBe(tool("views-menu"));
  // A Web View link navigates and puts the keyboard in the pane.
  click("folder:tools", explorer().querySelector(".WinWebView")!);
  expect(caption()).toBe("Tools");
  expect(document.activeElement).toBe(files()[0]);
});

test("Details is a sortable grid; Arrange Icons sorts too, folders first", () => {
  openBarMenu("View");
  menuItem("Details").click();
  const table = pane();
  expect(table.tagName).toBe("TABLE");
  expect(table.getAttribute("role")).toBe("grid");
  const headers = [
    ...table.querySelectorAll<HTMLButtonElement>(".WinColumnHeader"),
  ];
  expect(headers.map(header => header.textContent)).toEqual([
    "Name",
    "Type",
    "Technologies",
    "Demo",
  ]);
  const names = () => files().map(row => row.querySelector("td")!.textContent);
  const folders = ["Games", "Applications", "Tools", "Experiments & Learning"];
  expect(names().slice(0, 4)).toEqual(folders);
  headers[0].click();
  const byName = [...projects]
    .map(project => project.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  expect(names()).toEqual([
    ...[...folders].sort((a, b) => a.localeCompare(b)),
    ...byName,
  ]);
  expect(pane().querySelector("th[aria-sort]")?.getAttribute("aria-sort")).toBe(
    "ascending",
  );
  // A second click reverses; the header keeps the keyboard.
  pane().querySelector<HTMLButtonElement>('[data-sort="name"]')!.focus();
  pane().querySelector<HTMLButtonElement>('[data-sort="name"]')!.click();
  expect(names().slice(4)).toEqual([...byName].reverse());
  expect(pane().querySelector("th[aria-sort]")?.getAttribute("aria-sort")).toBe(
    "descending",
  );
  expect(document.activeElement).toBe(
    pane().querySelector('[data-sort="name"]'),
  );
  // The header row is one Tab stop: Right moves, Down enters the rows.
  press("ArrowRight");
  expect(document.activeElement).toBe(
    pane().querySelector('[data-sort="type"]'),
  );
  press("ArrowDown");
  expect(document.activeElement).toBe(files()[0]);
  // Rows are selected and opened like icons.
  press("ArrowDown");
  expect(files()[1].getAttribute("aria-selected")).toBe("true");
  // Arrange Icons ▸ by Type.
  openBarMenu("View");
  menuItem("Arrange Icons").click();
  menuItem("by Type").click();
  const types = files()
    .slice(4)
    .map(row => row.querySelectorAll("td")[1].textContent!);
  expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b)));
  expect(pane().querySelector("th[aria-sort]")!.textContent).toBe("Type");
});

test("the Web View and status panes describe the selection", () => {
  const info = explorer().querySelector<HTMLElement>(".WinWebViewInfo")!;
  // Only the status pane announces: the Web View is read on demand.
  expect(info.hasAttribute("aria-live")).toBe(false);
  expect(
    explorer().querySelectorAll("[aria-live], [role=status]"),
  ).toHaveLength(1);
  expect(info.textContent).toBe("Select an item to view its description.");
  expect(explorer().querySelector(".WinWebView h2")!.textContent).toBe(
    "My Projects",
  );
  expect(status()).toEqual([
    `${projects.length + 4} object(s)`,
    "",
    "Portfolio (C:)",
  ]);
  // Only the first pane is a status region.
  expect(
    [...explorer().querySelectorAll(".WinStatusField")].map(field =>
      field.getAttribute("role"),
    ),
  ).toEqual(["status", null, null]);
  const project = projects.find(item => item.id === "paintaz")!;
  mouseSelect(fileItem("project:paintaz"));
  expect(status()[0]).toBe(`${project.summary}1 object(s) selected`);
  expect(explorer().querySelector(".WinStatusCount")!.textContent).toBe(
    "1 object(s) selected",
  );
  // Phones show the summary in the first pane instead.
  expect(explorer().querySelector(".WinStatusSummary")!.textContent).toBe(
    project.summary,
  );
  expect(status()[1]).toBe(`${project.category} · Browser demo`);
  expect(info.textContent).toContain(project.name);
  expect(info.textContent).toContain(`Type: ${project.category}`);
  expect(info.textContent).toContain(project.summary);
  expect(info.textContent).toContain("Browser demo: Yes");
  expect(
    info.querySelector<HTMLAnchorElement>("a.WinWebLink")!.getAttribute("href"),
  ).toBe(project.source);
  // Open in the Web View opens the project.
  click("project:paintaz", info);
  expect(win("project:paintaz")).not.toBeNull();
  click("close", win("project:paintaz")!);
  // A folder describes its contents.
  mouseSelect(fileItem("folder:games"));
  expect(info.textContent).toContain("File Folder");
  expect(info.textContent).toContain(`${games.length} project(s)`);
  expect(status()[1]).toBe("File Folder");
  // Empty space clears the selection.
  pane().dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }),
  );
  expect(info.textContent).toBe("Select an item to view its description.");
  expect(status()[0]).toBe(`${projects.length + 4} object(s)`);
  // View ▸ Status Bar, as Web Page and Toolbars hide their parts.
  for (const [label, selector] of [
    ["Status Bar", ".WinStatus"],
    ["as Web Page", ".WinWebView"],
    ["Toolbars", ".WinRebar"],
  ]) {
    openBarMenu("View");
    expect(menuItem(label).getAttribute("aria-checked")).toBe("true");
    menuItem(label).click();
    expect(explorer().querySelector<HTMLElement>(selector)!.hidden).toBe(true);
    // Each part stays hidden across navigation.
    click("folder:games", desktop().querySelector(".WinDesktopIcons")!);
    expect(explorer().querySelector<HTMLElement>(selector)!.hidden).toBe(true);
    openBarMenu("View");
    expect(menuItem(label).getAttribute("aria-checked")).toBe("false");
    menuItem(label).click();
    expect(explorer().querySelector<HTMLElement>(selector)!.hidden).toBe(false);
  }
});

test("My Computer and Recycle Bin are Explorer places with their own Web View", () => {
  click("computer", desktop().querySelector(".WinDesktopIcons")!);
  expect(caption()).toBe("My Computer");
  expect(
    explorer().querySelector<HTMLInputElement>(".WinCombo input")!.value,
  ).toBe("My Computer");
  expect(tool("up").getAttribute("aria-disabled")).toBe("true");
  expect(status()).toEqual(["1 object(s)", "", "My Computer"]);
  expect(files().map(item => item.textContent)).toEqual(["Portfolio (C:)"]);
  const info = explorer().querySelector<HTMLElement>(".WinWebViewInfo")!;
  mouseSelect(files()[0]);
  expect(info.textContent).toContain("Local Disk");
  expect(info.textContent).toContain(
    `${projects.length} projects in 4 folders`,
  );
  expect(
    [...info.querySelectorAll(".WinDiskLegend li")].map(
      item => item.textContent,
    ),
  ).toContain(`Games: ${games.length}`);
  expect(status()[1]).toBe("Local Disk");
  click("recycle", desktop().querySelector(".WinDesktopIcons")!);
  expect(caption()).toBe("Recycle Bin");
  expect(
    explorer().querySelector<HTMLInputElement>(".WinCombo input")!.value,
  ).toBe("Recycle Bin");
  expect(tool("up").getAttribute("aria-disabled")).toBe("true");
  expect(status()).toEqual(["0 object(s)", "", "My Computer"]);
  expect(files()).toHaveLength(0);
  // An empty pane is still the pane's Tab stop.
  expect(document.activeElement).toBe(pane());
  expect(pane().tabIndex).toBe(0);
  expect(explorer().querySelector(".WinWebViewInfo")!.textContent).toContain(
    "No projects have been deleted.",
  );
  const empty = [
    ...explorer().querySelectorAll<HTMLButtonElement>(".WinWebView button"),
  ].find(button => button.textContent === "Empty Recycle Bin")!;
  expect(empty.disabled).toBe(true);
  // The menu bar and Standard Buttons are shared.
  expect(explorer().querySelector('[role="menubar"]')).not.toBeNull();
  expect(tool("back").hasAttribute("aria-disabled")).toBe(false);
});

test("the Address list shows the hierarchy with the current place, and navigates", () => {
  const button = tool("address");
  expect(button.getAttribute("aria-haspopup")).toBe("menu");
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  const menu = desktop().querySelector<HTMLElement>(".WinAddressMenu")!;
  expect(button.getAttribute("aria-controls")).toBe(menu.id);
  expect(menuLabels()).toEqual([
    "Desktop",
    "My Computer",
    "Portfolio (C:)",
    "My Projects",
    "Games",
    "Applications",
    "Tools",
    "Experiments & Learning",
    "Recycle Bin",
  ]);
  expect(menuItem("Desktop").getAttribute("aria-disabled")).toBe("true");
  expect(menuItem("Games").style.getPropertyValue("--menu-indent")).toBe("4");
  // It opens on the current place.
  expect(document.activeElement).toBe(menuItem("My Projects"));
  expect(menuItem("My Projects").getAttribute("aria-checked")).toBe("true");
  menuItem("Tools").click();
  expect(caption()).toBe("Tools");
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(desktop().querySelector(".WinAddressMenu")).toBeNull();
  // Alt+Down on the field opens it from the keyboard, as combo boxes do.
  const input = explorer().querySelector<HTMLInputElement>(".WinCombo input")!;
  expect(input.value).toBe("C:\\Portfolio\\Tools");
  input.focus();
  press("ArrowDown", { altKey: true });
  expect(document.activeElement).toBe(menuItem("Tools"));
  press("Escape");
  expect(document.activeElement).toBe(input);
  expect(desktop().querySelector(".WinAddressMenu")).toBeNull();
  // The read-only field shows focus as its selected address.
  expect([input.selectionStart, input.selectionEnd]).toEqual([
    0,
    input.value.length,
  ]);
});

test("File ▸ Open opens the selection; Help ▸ About Portfolio 98 shows a message box", async () => {
  openBarMenu("File");
  expect(menuLabels()).toEqual(["Open", "Close"]);
  expect(menuItem("Open").getAttribute("aria-disabled")).toBe("true");
  press("Escape");
  mouseSelect(fileItem("project:paintaz"));
  openBarMenu("File");
  expect(menuItem("Open").hasAttribute("aria-disabled")).toBe(false);
  expect(menuItem("Open").classList.contains("WinMenuItem--default")).toBe(
    true,
  );
  menuItem("Open").click();
  expect(win("project:paintaz")).not.toBeNull();
  click("close", win("project:paintaz")!);
  openBarMenu("Help");
  menuItem("About Portfolio 98").click();
  const box = await vi.waitFor(() => {
    const element = desktop().querySelector<HTMLElement>(".WinMessageBox");
    expect(element).not.toBeNull();
    return element!;
  });
  expect(box.querySelector(".WinTitlebar")!.textContent).toContain(
    "About Portfolio 98",
  );
  expect(box.textContent).toContain(`${projects.length} projects`);
  box.querySelector<HTMLButtonElement>("[data-message-button]")!.click();
  expect(desktop().querySelector(".WinMessageBox")).toBeNull();
  openBarMenu("File");
  menuItem("Close").click();
  expect(win("explorer")).toBeNull();
});

test("captions follow Windows 98: the place alone, or 'Document - Application'", () => {
  click("about");
  expect(win("about")!.getAttribute("aria-label")).toBe(
    "About Adam.txt - Notepad",
  );
  click("contact");
  expect(win("contact")!.getAttribute("aria-label")).toBe("Address Book");
  click("find");
  expect(win("find")!.getAttribute("aria-label")).toBe("Find: Projects");
  click("project:paintaz", desktop().querySelector(".WinDesktopIcons")!);
  [...win("project:paintaz")!.querySelectorAll<HTMLElement>(".WinMenuBarItem")]
    .find(item => item.textContent === "Help")!
    .click();
  menuItem("paintAZ Help Topics").click();
  expect(win("help:paintaz")!.getAttribute("aria-label")).toBe("paintAZ Help");
  // Usage hints live in Help and Notepad, not in Explorer's status bar.
  expect(explorer().querySelector(".WinStatus")!.textContent).not.toContain(
    "Click",
  );
  expect(win("about")!.textContent).toContain("Double-click (or tap) an icon");
});

test("selection styles: navy only while the list has focus, a dithered icon, no hover fill", async () => {
  const { compileString } = await import("sass");
  const css = compileString(
    readFileSync("src/styles/windows.scss", "utf8"),
  ).css;
  expect(css).not.toMatch(/\.WinShortcut:hover/);
  expect(css).toContain("filter: url(#win-selected)");
  expect(css).toMatch(
    /\[data-listview\]:focus-within \[aria-selected=true\] > span[^{]*\{[^}]*background: #000080/,
  );
  expect(css).toMatch(
    /\.WinShortcut:focus-visible span \{[^}]*outline: 1px dotted currentColor/,
  );
  // The shared filters are declared once per desktop.
  expect(desktop().querySelectorAll("#win-selected")).toHaveLength(1);
  expect(desktop().querySelectorAll("#win-disabled")).toHaveLength(1);
});

test("pressing a list button again closes its list and keeps the keyboard in the window", () => {
  const item = fileItem("folder:games");
  mouseSelect(item);
  expect(document.activeElement).toBe(item);
  const mousePress = (button: HTMLElement) => {
    button.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  };
  // Views ▼ opened with the mouse: a second press closes it, and the
  // keyboard goes back to the file pane, not to the page.
  const views = tool("views-menu");
  mousePress(views);
  expect(desktop().querySelectorAll(".WinMenu")).toHaveLength(1);
  mousePress(views);
  expect(desktop().querySelectorAll(".WinMenu")).toHaveLength(0);
  expect(document.activeElement).toBe(item);
  // A view chosen with the mouse also hands the keyboard back to the pane.
  mousePress(views);
  menuItem("Details").click();
  expect(document.activeElement?.closest(".WinFiles")).not.toBeNull();
  // The Address list returns to its field.
  const address = tool("address");
  mousePress(address);
  expect(desktop().querySelector(".WinAddressMenu")).not.toBeNull();
  mousePress(address);
  expect(desktop().querySelector(".WinAddressMenu")).toBeNull();
  expect(document.activeElement).toBe(
    explorer().querySelector(".WinCombo input"),
  );
});
