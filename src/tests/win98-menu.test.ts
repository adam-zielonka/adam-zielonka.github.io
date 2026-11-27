import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  MENU_HOVER_DELAY,
  closeMenus,
  menuBar,
  openMenu,
  parseMnemonic,
  type MenuEntry,
} from "../components/win98/menu";
import { messageBox } from "../components/win98/message-box";

let desktop: HTMLElement;
let workspace: HTMLElement;
let opener: HTMLButtonElement;

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
  key(document.activeElement ?? document.body, value, init);
const focused = () => document.activeElement?.textContent?.trim();
const menus = () => [...desktop.querySelectorAll<HTMLElement>(".WinMenu")];

beforeEach(() => {
  document.body.innerHTML = `<section class="Win98" tabindex="-1"><div class="WinWorkspace"><div data-window="app" class="WinWindow" data-active="true"><div class="Bar"></div><input class="Content" aria-label="Content"></div></div><footer class="WinTaskbar"><button class="Opener">Open</button></footer></section>`;
  desktop = document.querySelector<HTMLElement>(".Win98")!;
  workspace = desktop.querySelector<HTMLElement>(".WinWorkspace")!;
  opener = desktop.querySelector<HTMLButtonElement>(".Opener")!;
  opener.focus();
});
afterEach(() => {
  closeMenus();
  vi.useRealTimers();
  document.body.replaceChildren();
});

const fileItems = (log: string[] = []): MenuEntry[] => [
  { label: "&Open", default: true, action: () => log.push("open") },
  { label: "&Save", action: () => log.push("save") },
  "-",
  { label: "&Print", disabled: true, action: () => log.push("print") },
  { label: "E&xit", shortcut: "Alt+F4", action: () => log.push("exit") },
];

test("mnemonics render underlined, expose their key and keep literal ampersands", () => {
  expect(parseMnemonic("E&xit")).toEqual({
    html: "E<u>x</u>it",
    text: "Exit",
    key: "x",
  });
  expect(parseMnemonic("Experiments && Learning")).toMatchObject({
    text: "Experiments & Learning",
    key: undefined,
  });
  expect(parseMnemonic("Q & A").text).toBe("Q & A");
  const menu = openMenu({ items: fileItems(), anchor: opener });
  const exit = menu.element.querySelectorAll(".WinMenuItem")[3];
  expect(exit.querySelector("u")?.textContent).toBe("x");
  expect(exit.textContent).toContain("Alt+F4");
  expect(exit.getAttribute("aria-keyshortcuts")).toBe("Alt+F4");
});

test("renders ARIA menu roles, states, a bold default and separators", () => {
  const menu = openMenu({
    items: [
      { label: "&Open", default: true },
      "-",
      { label: "&Toolbar", check: "check", checked: true },
      { label: "&Large Icons", check: "radio", checked: true },
      { label: "&List", check: "radio" },
      { label: "&Disabled", disabled: true },
      { label: "&More", submenu: [{ label: "&One" }] },
      { label: "&Source code", href: "https://example.com/source" },
    ],
    anchor: opener,
    label: "File",
  });
  const element = menu.element;
  expect(element.getAttribute("role")).toBe("menu");
  expect(element.getAttribute("aria-label")).toBe("File");
  expect(element.parentElement).toBe(desktop);
  expect([...element.children].map(item => item.getAttribute("role"))).toEqual([
    "menuitem",
    "separator",
    "menuitemcheckbox",
    "menuitemradio",
    "menuitemradio",
    "menuitem",
    "menuitem",
    "menuitem",
  ]);
  const [open, , toolbar, large, list, disabled, more, link] = [
    ...element.children,
  ] as HTMLElement[];
  expect(open.classList.contains("WinMenuItem--default")).toBe(true);
  expect(toolbar.getAttribute("aria-checked")).toBe("true");
  expect(large.getAttribute("aria-checked")).toBe("true");
  expect(list.getAttribute("aria-checked")).toBe("false");
  expect(disabled.getAttribute("aria-disabled")).toBe("true");
  expect(more.getAttribute("aria-haspopup")).toBe("menu");
  expect(more.getAttribute("aria-expanded")).toBe("false");
  expect(link).toBeInstanceOf(HTMLAnchorElement);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.textContent).toBe("Source code ↗ (opens in a new tab)");
  expect(link.querySelector(".VisuallyHidden")?.textContent).toBe(
    " (opens in a new tab)",
  );
  // Every item is reachable only through the menu's own roving focus.
  expect(
    [...element.querySelectorAll<HTMLElement>(".WinMenuItem")].every(
      item => item.tabIndex === -1,
    ),
  ).toBe(true);
});

test("arrow keys move one roving focus, wrap, skip separators and reach disabled items", () => {
  openMenu({ items: fileItems(), anchor: opener });
  expect(focused()).toBe("Open");
  press("ArrowDown");
  expect(focused()).toBe("Save");
  press("ArrowDown");
  expect(focused()).toBe("Print");
  press("ArrowDown");
  expect(focused()).toContain("Exit");
  press("ArrowDown");
  expect(focused()).toBe("Open");
  press("ArrowUp");
  expect(focused()).toContain("Exit");
  press("Home");
  expect(focused()).toBe("Open");
  press("End");
  expect(focused()).toContain("Exit");
});

test("a menu opened with the mouse starts on the panel; Down and Up pick the ends", () => {
  openMenu({ items: fileItems(), anchor: opener, focus: "menu" });
  expect(document.activeElement?.getAttribute("role")).toBe("menu");
  press("ArrowUp");
  expect(focused()).toContain("Exit");
  closeMenus();
  openMenu({ items: fileItems(), anchor: opener, focus: "menu" });
  press("ArrowDown");
  expect(focused()).toBe("Open");
});

test("Enter and Space activate, close the chain and return focus first", () => {
  const log: string[] = [];
  const focusDuringAction: (Element | null)[] = [];
  openMenu({
    items: [
      ...fileItems(log),
      {
        label: "&Where",
        action: () => focusDuringAction.push(document.activeElement),
      },
    ],
    anchor: opener,
    returnFocus: opener,
  });
  press("ArrowDown");
  press("Enter");
  expect(log).toEqual(["save"]);
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(opener);
  openMenu({ items: fileItems(log), anchor: opener, returnFocus: opener });
  press(" ");
  expect(log).toEqual(["save", "open"]);
  // Disabled items take focus but do nothing.
  const menu = openMenu({
    items: fileItems(log),
    anchor: opener,
    returnFocus: opener,
  });
  press("ArrowDown");
  press("ArrowDown");
  press("Enter");
  expect(log).toEqual(["save", "open"]);
  expect(menu.closed).toBe(false);
  menu.close();
  openMenu({
    items: [
      {
        label: "&Where",
        action: () => focusDuringAction.push(document.activeElement),
      },
    ],
    anchor: opener,
    returnFocus: opener,
  });
  press("Enter");
  expect(focusDuringAction).toEqual([opener]);
});

test("a mnemonic activates its item; repeated letters cycle through duplicates", () => {
  const log: string[] = [];
  openMenu({ items: fileItems(log), anchor: opener });
  press("x");
  expect(log).toEqual(["exit"]);
  openMenu({
    items: [
      { label: "Games", action: () => log.push("games") },
      { label: "Graphics", action: () => log.push("graphics") },
      { label: "Tools", action: () => log.push("tools") },
      { label: "&Run…", action: () => log.push("run") },
    ],
    anchor: opener,
  });
  // Without explicit mnemonics the first letter is used; duplicates only move.
  press("g");
  expect(focused()).toBe("Graphics");
  press("G");
  expect(focused()).toBe("Games");
  press("t");
  expect(log).toEqual(["exit", "tools"]);
  openMenu({ items: fileItems(log), anchor: opener });
  // A disabled item's mnemonic does nothing; an unknown letter is ignored.
  press("p");
  press("q");
  expect(log).toEqual(["exit", "tools"]);
  expect(menus()).toHaveLength(1);
});

test("Right opens a cascade on its first item and Left closes it again", () => {
  const log: string[] = [];
  openMenu({
    items: [
      {
        label: "&Programs",
        submenu: [
          {
            label: "&Games",
            submenu: [{ label: "&Deska", action: () => log.push("deska") }],
          },
          { label: "&Tools" },
        ],
      },
      { label: "&Documents" },
    ],
    anchor: opener,
    returnFocus: opener,
  });
  const programs = document.activeElement as HTMLElement;
  press("ArrowRight");
  expect(menus()).toHaveLength(2);
  expect(programs.getAttribute("aria-expanded")).toBe("true");
  expect(focused()).toBe("Games");
  expect(programs.id).not.toBe("");
  expect(menus()[1].getAttribute("aria-labelledby")).toBe(programs.id);
  expect(programs.getAttribute("aria-controls")).toBe(menus()[1].id);
  press("ArrowRight");
  expect(menus()).toHaveLength(3);
  expect(focused()).toBe("Deska");
  press("ArrowLeft");
  expect(menus()).toHaveLength(2);
  expect(focused()).toBe("Games");
  press("ArrowLeft");
  expect(menus()).toHaveLength(1);
  expect(document.activeElement).toBe(programs);
  expect(programs.getAttribute("aria-expanded")).toBe("false");
  expect(programs.hasAttribute("aria-controls")).toBe(false);
  // Enter opens a cascade too, and a command deep inside closes everything.
  press("Enter");
  press("Enter");
  press("Enter");
  expect(log).toEqual(["deska"]);
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(opener);
});

test("Escape closes one level at a time and restores focus to the opener", () => {
  openMenu({
    items: [{ label: "&Programs", submenu: [{ label: "&Games" }] }],
    anchor: opener,
    returnFocus: opener,
  });
  press("ArrowRight");
  expect(menus()).toHaveLength(2);
  const escape = press("Escape");
  expect(escape.defaultPrevented).toBe(true);
  expect(menus()).toHaveLength(1);
  expect(focused()).toBe("Programs");
  press("Escape");
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(opener);
});

test("hover moves the single hot item and opens or closes cascades after a delay", () => {
  vi.useFakeTimers();
  const menu = openMenu({
    items: [
      { label: "&Open" },
      { label: "&Programs", submenu: [{ label: "&Games" }] },
      { label: "&Help" },
    ],
    anchor: opener,
    focus: "menu",
  });
  const [open, programs, help] = [
    ...menu.element.querySelectorAll<HTMLElement>(".WinMenuItem"),
  ];
  // Keyboard on one item, pointer on another: focus follows the pointer.
  press("ArrowDown");
  expect(document.activeElement).toBe(open);
  programs.dispatchEvent(new PointerEvent("pointerenter"));
  expect(document.activeElement).toBe(programs);
  expect(menus()).toHaveLength(1);
  vi.advanceTimersByTime(MENU_HOVER_DELAY);
  expect(menus()).toHaveLength(2);
  // A hover-opened cascade leaves the parent hot until the pointer moves in.
  expect(document.activeElement).toBe(programs);
  const games = menus()[1].querySelector<HTMLElement>(".WinMenuItem")!;
  // Crossing another parent item on the way does not close the cascade.
  help.dispatchEvent(new PointerEvent("pointerenter"));
  menus()[1].dispatchEvent(new PointerEvent("pointerenter"));
  games.dispatchEvent(new PointerEvent("pointerenter"));
  vi.advanceTimersByTime(MENU_HOVER_DELAY);
  expect(document.activeElement).toBe(games);
  expect(menus()).toHaveLength(2);
  // Resting on a plain item closes the cascade after the delay.
  help.dispatchEvent(new PointerEvent("pointerenter"));
  vi.advanceTimersByTime(MENU_HOVER_DELAY);
  expect(menus()).toHaveLength(1);
  expect(document.activeElement).toBe(help);
  // Escape closes a hover-opened cascade first, then the menu itself.
  programs.dispatchEvent(new PointerEvent("pointerenter"));
  vi.advanceTimersByTime(MENU_HOVER_DELAY);
  expect(menus()).toHaveLength(2);
  expect(document.activeElement).toBe(programs);
  expect(press("Escape").defaultPrevented).toBe(true);
  expect(menus()).toHaveLength(1);
  expect(document.activeElement).toBe(programs);
  expect(programs.getAttribute("aria-expanded")).toBe("false");
  press("Escape");
  expect(menus()).toHaveLength(0);
});

test("clicks activate, open cascades at once, and ignore disabled items", () => {
  const log: string[] = [];
  const menu = openMenu({
    items: [
      ...fileItems(log),
      {
        label: "&More",
        submenu: [{ label: "&Deep", action: () => log.push("deep") }],
      },
    ],
    anchor: opener,
  });
  const items = menu.element.querySelectorAll<HTMLElement>(".WinMenuItem");
  items[2].dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(menu.closed).toBe(false);
  items[4].dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(menus()).toHaveLength(2);
  menus()[1]
    .querySelector<HTMLElement>(".WinMenuItem")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(log).toEqual(["deep"]);
  expect(menus()).toHaveLength(0);
  // pointerdown inside a menu keeps focus in the chain.
  const second = openMenu({ items: fileItems(log), anchor: opener });
  const down = new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
  });
  second.element.querySelector(".WinMenuItem")!.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  expect(second.closed).toBe(false);
});

test("an outside pointerdown or focus leaving the chain closes every level", () => {
  const onClose = vi.fn();
  openMenu({
    items: [{ label: "&Programs", submenu: [{ label: "&Games" }] }],
    anchor: opener,
    onClose,
  });
  press("ArrowRight");
  workspace.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(menus()).toHaveLength(0);
  expect(onClose).toHaveBeenCalledWith("outside");
  openMenu({
    items: [{ label: "&Programs", submenu: [{ label: "&Games" }] }],
    anchor: opener,
  });
  press("ArrowRight");
  desktop.querySelector<HTMLInputElement>(".Content")!.focus();
  expect(menus()).toHaveLength(0);
});

test("Tab closes the chain and continues from the element it returns to", () => {
  openMenu({ items: fileItems(), anchor: opener, returnFocus: opener });
  const tab = press("Tab");
  expect(tab.defaultPrevented).toBe(false);
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(opener);
});

test("a link item opens in a new tab and stays connected until it navigates", () => {
  vi.useFakeTimers();
  const menu = openMenu({
    items: [{ label: "&Source code", href: "https://example.com/source" }],
    anchor: opener,
    returnFocus: opener,
  });
  const link = menu.element.querySelector("a")!;
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(false);
  expect(menu.closed).toBe(true);
  expect(link.isConnected).toBe(true);
  expect(menu.element.hidden).toBe(true);
  vi.advanceTimersByTime(0);
  expect(link.isConnected).toBe(false);
});

test("an empty menu shows a disabled (Empty) item", () => {
  const menu = openMenu({ items: () => [], anchor: opener });
  const item = menu.element.querySelector(".WinMenuItem")!;
  expect(item.textContent).toBe("(Empty)");
  expect(item.getAttribute("aria-disabled")).toBe("true");
});

test("menus stay inside the workspace and flip left or up", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
    }) as DOMRect;
  vi.spyOn(desktop, "getBoundingClientRect").mockReturnValue(
    rect(0, 0, 800, 600),
  );
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue(
    rect(0, 0, 800, 570),
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(150);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
  vi.spyOn(opener, "getBoundingClientRect").mockReturnValue(
    rect(700, 540, 60, 22),
  );
  const below = openMenu({ items: fileItems(), anchor: opener });
  // No room below or right of the anchor: it opens above, right-aligned.
  expect(below.element.style.left).toBe("610px");
  expect(below.element.style.top).toBe("440px");
  below.close();
  const point = openMenu({
    items: fileItems(),
    point: { x: 780, y: 560 },
    host: desktop,
  });
  expect(point.element.style.left).toBe("630px");
  expect(point.element.style.top).toBe("460px");
  point.close();
  const item = document.createElement("button");
  desktop.append(item);
  vi.spyOn(item, "getBoundingClientRect").mockReturnValue(
    rect(600, 100, 180, 20),
  );
  const cascade = openMenu({
    items: fileItems(),
    anchor: item,
    placement: "right",
  });
  expect(cascade.element.style.left).toBe("450px");
  expect(cascade.element.style.top).toBe("97px");
});

test("a banner sits along the edge, hidden from assistive technology", () => {
  const menu = openMenu({
    items: fileItems(),
    anchor: opener,
    banner: "<span><b>Portfolio</b> 98</span>",
  });
  const banner = menu.element.querySelector(".WinMenuBanner")!;
  expect(banner.getAttribute("aria-hidden")).toBe("true");
  expect(banner.textContent).toBe("Portfolio 98");
  expect(menu.element.classList.contains("WinMenu--banner")).toBe(true);
  // Navigation ignores it.
  press("End");
  expect(focused()).toBe("ExitAlt+F4");
});

test("after places the menu next to its opener in the DOM; cascades keep their own classes", () => {
  const menu = openMenu({
    items: [{ label: "&Programs", submenu: [{ label: "&Games" }] }],
    anchor: opener,
    host: desktop,
    after: opener,
    className: "Root",
    submenuClassName: "Cascade",
  });
  expect(opener.nextElementSibling).toBe(menu.element);
  press("ArrowRight");
  const cascade = menus()[1];
  expect(cascade.classList.contains("Cascade")).toBe(true);
  expect(cascade.classList.contains("Root")).toBe(false);
  // Cascades still go to the host, which positions them.
  expect(cascade.parentElement).toBe(desktop);
});

test("push-in cascades replace their menu with a Back row and return on Back, Left or Escape", () => {
  vi.useFakeTimers();
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
    }) as DOMRect;
  vi.spyOn(desktop, "getBoundingClientRect").mockReturnValue(
    rect(0, 0, 390, 700),
  );
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue(
    rect(0, 0, 390, 700),
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(150);
  const root = openMenu({
    items: [
      { label: "&Programs", submenu: [{ label: "&Games" }] },
      { label: "&Settings", submenu: () => [] },
    ],
    anchor: opener,
    returnFocus: opener,
    pushIn: true,
  });
  vi.spyOn(root.element, "getBoundingClientRect").mockReturnValue(
    rect(10, 400, 200, 260),
  );
  expect(root.element.classList.contains("WinMenu--push")).toBe(true);
  // Hover never opens a pushed-in cascade.
  const programs = root.element.querySelector<HTMLElement>(".WinMenuItem")!;
  programs.dispatchEvent(new PointerEvent("pointerenter"));
  vi.advanceTimersByTime(MENU_HOVER_DELAY * 2);
  expect(menus()).toHaveLength(1);
  // A tap opens it in place, with the keyboard on the new panel.
  programs.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  const pushed = menus()[1];
  expect(root.element.hidden).toBe(true);
  expect(document.activeElement).toBe(pushed);
  expect(pushed.classList.contains("WinMenu--push")).toBe(true);
  expect(pushed.style.minWidth).toBe("200px");
  expect(pushed.style.left).toBe("10px");
  expect(pushed.style.top).toBe("400px");
  const rows = [...pushed.querySelectorAll<HTMLElement>(".WinMenuItem")];
  expect(rows.map(row => row.textContent)).toEqual(["Back", "Games"]);
  expect(rows[0].querySelector("u")?.textContent).toBe("B");
  rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(menus()).toHaveLength(1);
  expect(root.element.hidden).toBe(false);
  expect(document.activeElement).toBe(programs);
  // Keyboard: Right opens on the first row; Left and Escape come back.
  press("ArrowRight");
  expect(focused()).toBe("Back");
  press("ArrowLeft");
  expect(focused()).toBe("Programs");
  press("ArrowRight");
  press("Escape");
  expect(focused()).toBe("Programs");
  expect(root.element.hidden).toBe(false);
  // An empty cascade still has its Back row; choosing a leaf closes it all.
  press("ArrowDown");
  press("Enter");
  expect(
    [...menus()[1].querySelectorAll(".WinMenuItem")].map(
      row => row.textContent,
    ),
  ).toEqual(["Back", "(Empty)"]);
  press("ArrowLeft");
  press("ArrowUp");
  press("ArrowRight");
  press("ArrowDown");
  press("Enter");
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(opener);
});

test("pushed-in panels above their anchor keep the bottom edge in place", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
    }) as DOMRect;
  vi.spyOn(desktop, "getBoundingClientRect").mockReturnValue(
    rect(0, 0, 390, 700),
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(150);
  const root = openMenu({
    items: [{ label: "&Programs", submenu: [{ label: "&Games" }] }],
    anchor: opener,
    placement: "above",
    bounds: desktop,
    pushIn: true,
  });
  vi.spyOn(root.element, "getBoundingClientRect").mockReturnValue(
    rect(4, 400, 200, 260),
  );
  press("ArrowRight");
  expect(menus()[1].style.top).toBe("560px");
});

test("focus moving away during a press inside a menu waits for the click", () => {
  const log: string[] = [];
  openMenu({ items: fileItems(log), anchor: opener });
  const save = menus()[0].querySelectorAll<HTMLElement>(".WinMenuItem")[1];
  save.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }),
  );
  // Some touch browsers focus the page before they send the click.
  desktop.focus();
  expect(menus()).toHaveLength(1);
  save.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }),
  );
  save.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(log).toEqual(["save"]);
  expect(menus()).toHaveLength(0);
  // A cancelled press (a scroll) ends the wait: focus leaving closes again.
  const onClose = vi.fn();
  openMenu({ items: fileItems(log), anchor: opener, onClose });
  const open = menus()[0].querySelector<HTMLElement>(".WinMenuItem")!;
  open.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  open.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
  desktop.focus();
  expect(menus()).toHaveLength(0);
  expect(onClose).toHaveBeenCalledWith("blur");
});

test("a menu bar has one Tab stop, moves with arrows and opens menus", () => {
  const log: string[] = [];
  const bar = menuBar(
    desktop.querySelector<HTMLElement>(".Bar")!,
    [
      { label: "&File", items: fileItems(log) },
      {
        label: "&View",
        items: () => [{ label: "&Refresh", action: () => log.push("refresh") }],
      },
      {
        label: "&Help",
        items: [{ label: "&About", action: () => log.push("about") }],
      },
    ],
    { label: "App" },
  );
  const [file, view, help] = bar.items;
  expect(bar.element.getAttribute("role")).toBe("menubar");
  expect(bar.items.map(item => item.tabIndex)).toEqual([0, -1, -1]);
  expect(file.getAttribute("aria-haspopup")).toBe("menu");
  file.focus();
  press("ArrowRight");
  expect(document.activeElement).toBe(view);
  expect(bar.items.map(item => item.tabIndex)).toEqual([-1, 0, -1]);
  press("ArrowLeft");
  press("ArrowLeft");
  expect(document.activeElement).toBe(help);
  press("ArrowDown");
  expect(help.getAttribute("aria-expanded")).toBe("true");
  expect(focused()).toBe("About");
  expect(menus()[0].getAttribute("aria-labelledby")).toBe(help.id);
  // Left and Right inside an open menu move to the neighbouring menus.
  press("ArrowRight");
  expect(file.getAttribute("aria-expanded")).toBe("true");
  expect(help.getAttribute("aria-expanded")).toBe("false");
  expect(focused()).toBe("Open");
  press("ArrowLeft");
  expect(focused()).toBe("About");
  press("Escape");
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(help);
  // Plain letters work once the bar has focus.
  press("v");
  expect(focused()).toBe("Refresh");
  press("Enter");
  expect(log).toEqual(["refresh"]);
});

test("F10 and Alt+Shift+mnemonic reach the bar; a command returns focus to the content", () => {
  const log: string[] = [];
  const bar = menuBar(desktop.querySelector<HTMLElement>(".Bar")!, [
    { label: "&File", items: fileItems(log) },
    {
      label: "&Edit",
      items: [{ label: "Select &All", action: () => log.push("all") }],
    },
  ]);
  const content = desktop.querySelector<HTMLInputElement>(".Content")!;
  content.focus();
  press("F10");
  expect(document.activeElement).toBe(bar.items[0]);
  press("Escape");
  expect(document.activeElement).toBe(content);
  // Browsers keep Alt+E for themselves; Alt+Shift+E is the safe accelerator.
  const accelerator = press("E", {
    altKey: true,
    shiftKey: true,
    code: "KeyE",
  });
  expect(accelerator.defaultPrevented).toBe(true);
  expect(focused()).toBe("Select All");
  press("a");
  expect(log).toEqual(["all"]);
  expect(document.activeElement).toBe(content);
});

test("mouse use of a menu bar: click opens on the panel, hover switches menus", () => {
  const bar = menuBar(desktop.querySelector<HTMLElement>(".Bar")!, [
    { label: "&File", items: fileItems() },
    { label: "&Edit", items: [{ label: "&Copy" }] },
  ]);
  const [file, edit] = bar.items;
  const content = desktop.querySelector<HTMLInputElement>(".Content")!;
  content.focus();
  const down = new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
  });
  file.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  file.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(document.activeElement?.getAttribute("role")).toBe("menu");
  edit.dispatchEvent(new PointerEvent("pointerenter"));
  expect(edit.getAttribute("aria-expanded")).toBe("true");
  expect(menus()).toHaveLength(1);
  // The click that follows the hover keeps the menu hovering opened (a
  // pointerdown on the bar is not "outside")...
  const clickTitle = (title: HTMLElement) => {
    title.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    title.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  };
  clickTitle(edit);
  expect(menus()).toHaveLength(1);
  expect(edit.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement?.getAttribute("role")).toBe("menu");
  // ...and clicking the open title again closes it, returning the keyboard
  // to the content rather than dropping it.
  clickTitle(edit);
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(content);
  // A click on a closed title opens it; on the open one, closes it.
  clickTitle(file);
  expect(menus()).toHaveLength(1);
  clickTitle(file);
  expect(menus()).toHaveLength(0);
  expect(document.activeElement).toBe(content);
  bar.dispose();
  file.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  expect(menus()).toHaveLength(0);
});

test("a message box is modal: inert desktop, trapped Tab, Enter and Escape, focus returned", async () => {
  const already = desktop.querySelector<HTMLElement>(".WinTaskbar")!;
  already.inert = false;
  workspace.inert = false;
  const result = messageBox({
    title: "Shut Down Portfolio 98",
    icon: "shutdown",
    body: "Are you sure?\nUnsaved demos are lost.",
    buttons: [
      { id: "ok", label: "OK", default: true },
      { id: "cancel", label: "Cancel", cancel: true },
      { id: "help", label: "Help" },
    ],
  });
  const box = desktop.querySelector<HTMLElement>(".WinMessageBox")!;
  expect(box.getAttribute("role")).toBe("alertdialog");
  expect(box.getAttribute("aria-modal")).toBe("true");
  expect(
    document.getElementById(box.getAttribute("aria-labelledby")!)?.textContent,
  ).toBe("Shut Down Portfolio 98");
  expect(
    document.getElementById(box.getAttribute("aria-describedby")!)?.textContent,
  ).toBe("Are you sure?Unsaved demos are lost.");
  expect(workspace.inert).toBe(true);
  expect(already.inert).toBe(true);
  // The owner window's caption turns inactive while the box is up.
  expect(
    desktop.querySelector<HTMLElement>("[data-window]")!.dataset.active,
  ).toBe("false");
  const buttons = [...box.querySelectorAll<HTMLButtonElement>(".WinButton")];
  const close = box.querySelector<HTMLButtonElement>(".WinMessageBoxClose")!;
  expect(document.activeElement).toBe(buttons[0]);
  expect(buttons[0].classList.contains("WinButton--default")).toBe(true);
  // Tab wraps inside the box in both directions.
  buttons[2].focus();
  expect(press("Tab").defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(close);
  expect(press("Tab", { shiftKey: true }).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(buttons[2]);
  // Enter on another push button is left to that button.
  expect(press("Enter").defaultPrevented).toBe(false);
  // Desktop shortcuts never reach the windows behind.
  const behind = vi.fn();
  desktop.addEventListener("keydown", behind);
  press("F3");
  expect(behind).not.toHaveBeenCalled();
  press("Escape");
  await expect(result).resolves.toBe("cancel");
  expect(desktop.querySelector(".WinModal")).toBeNull();
  expect(workspace.inert).toBe(false);
  expect(already.inert).toBe(false);
  expect(
    desktop.querySelector<HTMLElement>("[data-window]")!.dataset.active,
  ).toBe("true");
  expect(document.activeElement).toBe(opener);
});

test("Enter in a field chooses the default button; Close cancels", async () => {
  const body = document.createElement("label");
  body.innerHTML = 'Open: <input type="text">';
  const field = body.querySelector("input")!;
  const ok = messageBox({
    title: "Run",
    body,
    role: "dialog",
    initialFocus: field,
    buttons: [
      { id: "ok", label: "OK", default: true },
      { id: "cancel", label: "Cancel", cancel: true },
    ],
  });
  const box = desktop.querySelector<HTMLElement>(".WinMessageBox")!;
  expect(box.getAttribute("role")).toBe("dialog");
  expect(document.activeElement).toBe(field);
  expect(press("Enter").defaultPrevented).toBe(true);
  await expect(ok).resolves.toBe("ok");
  const cancelled = messageBox({
    title: "Run",
    body: "Text",
    buttons: [
      { id: "ok", label: "OK", default: true },
      { id: "cancel", label: "Cancel", cancel: true },
    ],
  });
  desktop.querySelector<HTMLElement>(".WinMessageBoxClose")!.click();
  await expect(cancelled).resolves.toBe("cancel");
});

test("onButton can keep a box open for a nested one; inert state unwinds in order", async () => {
  const opened: Promise<string>[] = [];
  const outer = messageBox({
    title: "Shut Down Portfolio 98",
    body: "What do you want the computer to do?",
    buttons: [
      { id: "ok", label: "OK", default: true },
      { id: "cancel", label: "Cancel", cancel: true },
      { id: "help", label: "Help" },
    ],
    onButton: id => {
      if (id !== "help") return;
      opened.push(messageBox({ title: "Help", body: "Choose an option." }));
      return false;
    },
  });
  const outerBox = desktop.querySelector<HTMLElement>(".WinMessageBox")!;
  const help = outerBox.querySelector<HTMLButtonElement>(
    '[data-message-button="help"]',
  )!;
  help.focus();
  help.click();
  expect(desktop.querySelectorAll(".WinModal")).toHaveLength(2);
  expect(outerBox.closest<HTMLElement>(".WinModal")!.inert).toBe(true);
  // A single OK button is also the cancel button.
  press("Escape");
  await expect(opened[0]).resolves.toBe("ok");
  expect(outerBox.closest<HTMLElement>(".WinModal")!.inert).toBe(false);
  expect(workspace.inert).toBe(true);
  expect(document.activeElement).toBe(help);
  press("Escape");
  await expect(outer).resolves.toBe("cancel");
  expect(workspace.inert).toBe(false);
});

test("without a cancel button Escape and Close do nothing; aborting closes", async () => {
  const abort = new AbortController();
  const answer = messageBox({
    title: "Question",
    body: "Continue?",
    buttons: [
      { id: "yes", label: "Yes", default: true },
      { id: "no", label: "No" },
    ],
    signal: abort.signal,
  });
  const box = desktop.querySelector<HTMLElement>(".WinMessageBox")!;
  expect(
    box.querySelector<HTMLButtonElement>(".WinMessageBoxClose")!.disabled,
  ).toBe(true);
  press("Escape");
  expect(box.isConnected).toBe(true);
  abort.abort();
  await expect(answer).resolves.toBe("");
  expect(box.isConnected).toBe(false);
  expect(workspace.inert).toBe(false);
});

test("opening a message box closes open menus and later returns to their opener", async () => {
  openMenu({ items: fileItems(), anchor: opener, returnFocus: opener });
  expect(focused()).toBe("Open");
  const note = messageBox({ title: "Note", body: "Hello" });
  expect(menus()).toHaveLength(0);
  desktop.querySelector<HTMLElement>("[data-message-button]")!.click();
  await expect(note).resolves.toBe("ok");
  expect(document.activeElement).toBe(opener);
});
