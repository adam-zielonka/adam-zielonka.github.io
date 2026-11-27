import { readFileSync } from "node:fs";
import { compileString } from "sass";
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
import { windowsIcon, windowsIconNames } from "../data/windows-icons";
import { Experience } from "../components/experience";
import {
  getCrtEffects,
  setCrtEffects,
  videoModeOf,
} from "../utils/crt-curvature";

// Portfolio 98's look: scrollbars, caption buttons, the CRT hit contract,
// metrics, high contrast, icons, the shut-down screens and the CRT picture.

let store: Store;
// Happy DOM emits hashchange after pushState/replaceState, unlike browsers,
// which would restart Portfolio 98 in the middle of a test.
const suppressHistoryHashChange = (event: HashChangeEvent) => {
  if (event.newURL) event.stopImmediatePropagation();
};
const desktop = () => document.querySelector<HTMLElement>(".Win98")!;
const explorer = () =>
  desktop().querySelector<HTMLElement>('[data-window="explorer"]')!;
const click = (action: string, root: ParentNode = desktop()) => {
  const button = root.querySelector<HTMLElement>(
    `[data-win-action="${action}"]`,
  );
  expect(button, action).not.toBeNull();
  button!.click();
};
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
const key = (target: EventTarget, value: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: value, bubbles: true }),
  );
/** An icon's size and grid: [width, viewBox]. */
const iconOf = (element: Element | null) => {
  const svg = element?.querySelector("svg.Win98Icon") ?? element;
  expect(svg?.tagName.toLowerCase()).toBe("svg");
  return [svg!.getAttribute("width"), svg!.getAttribute("viewBox")];
};
const markup = (name: string, size: 16 | 32 = 32) => {
  const host = document.createElement("div");
  host.innerHTML = windowsIcon(name, size);
  return host.firstElementChild!.outerHTML;
};

const windowsCss = compileString(
  readFileSync("src/styles/windows.scss", "utf8"),
).css;
const shutdownCss = compileString(
  readFileSync("src/styles/shutdown.scss", "utf8"),
).css;
const crtCss = compileString(readFileSync("src/styles/crt.scss", "utf8")).css;
/** The body of the first at-rule block whose prelude starts with `prelude`. */
const block = (css: string, prelude: string) => {
  const start = css.indexOf(`${prelude} {`);
  expect(start, prelude).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = css.indexOf("{", start); index < css.length; index++) {
    if (css[index] === "{") depth++;
    else if (css[index] === "}" && --depth === 0)
      return css.slice(css.indexOf("{", start) + 1, index);
  }
  return "";
};
/** The declarations of every rule with exactly this selector list. */
const rule = (css: string, selector: string) =>
  [
    ...css.matchAll(
      new RegExp(
        `(?:^|[\\n{}])\\s*${selector.replace(/[.*+?^$()|[\]\\:-]/g, "\\$&")} \\{([^}]*)\\}`,
        "g",
      ),
    ),
  ]
    .map(match => match[1])
    .join("");

beforeAll(async () => {
  window.addEventListener("hashchange", suppressHistoryHashChange, true);
  document.body.innerHTML =
    '<div class="CRTScreen"><nav class="QuickCommands"><a href="#windows" data-command="windows">windows</a></nav><div id="root"></div></div><button data-toggle-power></button><p id="command-status"></p>';
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

test("caption buttons are original pixel glyphs and keep their names", () => {
  const win = explorer();
  const buttons = [
    ...win.querySelectorAll<HTMLButtonElement>(".WinWindowControls button"),
  ];
  expect(buttons.map(button => button.getAttribute("aria-label"))).toEqual([
    "Minimize My Projects",
    "Maximize My Projects",
    "Close My Projects",
  ]);
  for (const button of buttons) {
    // No font glyphs: the label is an aria-hidden 16 x 14 crisp SVG.
    expect(button.textContent).toBe("");
    const svg = button.querySelector("svg.WinCaptionGlyph")!;
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("14");
    expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("path")!.getAttribute("fill")).toBe(
      "currentColor",
    );
  }
  const glyph = () => buttons[1].querySelector("path")!.getAttribute("d") ?? "";
  const maximizeGlyph = glyph();
  click("maximize", win);
  expect(buttons[1].getAttribute("aria-label")).toBe("Restore My Projects");
  expect(buttons[1].dataset.tip).toBe("Restore");
  expect(glyph()).not.toBe(maximizeGlyph);
  click("maximize", win);
  expect(glyph()).toBe(maximizeGlyph);
  // Message boxes share the Close glyph.
  click("start");
  menuItem("Shut Down…").click();
  const close = desktop().querySelector(".WinMessageBoxClose")!;
  expect(close.querySelector("path")!.getAttribute("d")).toBe(
    buttons[2].querySelector("path")!.getAttribute("d"),
  );
});

test("small edge controls opt in to the CRT picture's hit compensation", () => {
  click("about");
  const marked = [...desktop().querySelectorAll<HTMLElement>("[data-crt-hit]")];
  const has = (selector: string) =>
    [...desktop().querySelectorAll(selector)].every(element =>
      marked.includes(element as HTMLElement),
    );
  expect(has(".WinWindowControls button")).toBe(true);
  expect(has(".WinSysMenu")).toBe(true);
  expect(has(".WinStart")).toBe(true);
  expect(has(".WinQuickButton")).toBe(true);
  expect(has(".WinTask")).toBe(true);
  expect(has(".WinClock")).toBe(true);
  expect(desktop().querySelectorAll(".WinTask")).toHaveLength(2);
  // Only leaf controls: nothing marked contains another marked control.
  for (const element of marked)
    expect(element.querySelector("[data-crt-hit]")).toBeNull();
  // The contract: marked controls never use ::before, are not positioned
  // absolutely and do not clip themselves.
  const classes = [
    "WinWindowControls button",
    "WinSysMenu",
    "WinStart",
    "WinQuickButton",
    "WinTask",
    "WinClock",
    "WinMessageBoxClose",
  ];
  for (const name of classes) {
    expect(windowsCss).not.toMatch(
      new RegExp(`\\.${name.replace(" ", "\\s+")}[^{},]*::?before`),
    );
    expect(rule(windowsCss, `.${name}`)).not.toMatch(
      /position: (absolute|fixed)|overflow: (hidden|clip|auto)/,
    );
  }
  // Pads stay within half the gap to a marked neighbour.
  expect(rule(windowsCss, ".WinQuickButton")).toContain("--crt-hit-pad: 0px");
  expect(block(windowsCss, "@media (pointer: coarse)")).toBeTruthy();
  expect(windowsCss).toMatch(
    /\.Win98 :is\(\.WinStart, \.WinClock, \.WinMessageBoxClose\) \{\s*--crt-hit-pad: 6px;/,
  );
  // The scrolling task band leaves room above its buttons for their moved
  // hit areas.
  expect(rule(windowsCss, ".WinTasks")).toMatch(
    /margin-top: -4px;\s*padding-top: 4px;/,
  );
});

test("Windows 98 scrollbars on fine pointers, Firefox colours and none on touch", () => {
  const fine = block(
    windowsCss,
    "@media (pointer: fine) and (forced-colors: none)",
  );
  expect(rule(fine, ".Win98 ::-webkit-scrollbar")).toMatch(
    /width: 16px;\s*height: 16px;/,
  );
  expect(rule(fine, ".Win98 ::-webkit-scrollbar-track")).toContain(
    "var(--win-dither)",
  );
  expect(rule(fine, ".Win98 ::-webkit-scrollbar-thumb")).toContain(
    "var(--win-raised-window)",
  );
  expect(rule(fine, ".Win98 ::-webkit-scrollbar-button:single-button")).toMatch(
    /display: block;[\s\S]*width: 16px;[\s\S]*height: 16px;/,
  );
  for (const part of [
    "vertical:decrement",
    "vertical:increment",
    "horizontal:decrement",
    "horizontal:increment",
  ])
    expect(
      rule(fine, `.Win98 ::-webkit-scrollbar-button:single-button:${part}`),
    ).toContain("background-image: url(");
  expect(rule(fine, ".Win98 ::-webkit-scrollbar-corner")).toContain("#c0c0c0");
  expect(block(fine, "@supports not selector(::-webkit-scrollbar)")).toContain(
    "scrollbar-color: #c0c0c0 #dfdfdf",
  );
  // Chrome ignores ::-webkit-scrollbar wherever scrollbar-width is set; only
  // the bar-less task band sets it.
  expect(windowsCss.match(/scrollbar-width: [a-z]+/g)).toEqual([
    "scrollbar-width: none",
  ]);
});

test("exact Windows 98 metrics, bevels and cursors on fine pointers", () => {
  const exact = block(
    block(windowsCss, "@media (pointer: fine)"),
    "@container (min-width: 541px)",
  );
  expect(rule(exact, ".Win98")).toMatch(
    /font-size: 11px;\s*line-height: 13px;\s*-webkit-font-smoothing: none;/,
  );
  expect(rule(exact, ".WinTitlebar")).toMatch(/height: 18px;/);
  expect(rule(exact, ".WinWindowControls button")).toMatch(
    /width: 16px;\s*height: 14px;/,
  );
  expect(rule(exact, ".WinWindowControls")).toContain("gap: 0");
  expect(rule(exact, ".WinTaskbar")).toContain("height: 28px");
  expect(rule(exact, ".WinStart")).toMatch(
    /min-width: 54px;[\s\S]*height: 22px;/,
  );
  expect(rule(exact, ".WinButton")).toMatch(
    /min-width: 75px;\s*min-height: 23px;/,
  );
  // The 4-colour edges are tokens; windows cast no shadow; a maximized
  // window's frame sits beyond the workspace.
  const base = rule(windowsCss, ".Win98");
  for (const token of [
    "--win-raised:",
    "--win-raised-window:",
    "--win-pressed:",
    "--win-sunken:",
    "--win-status:",
    "--win-dither:",
  ])
    expect(base).toContain(token);
  expect(rule(windowsCss, ".WinWindow")).toContain(
    "box-shadow: var(--win-raised-window)",
  );
  expect(windowsCss).not.toContain("#0005");
  expect(rule(windowsCss, ".WinWindow--maximized")).toContain(
    "inset: -3px !important",
  );
  // The arrow, not the hand, on controls; links keep the hand.
  expect(windowsCss).toMatch(
    /\.Win98 :where\(button, summary, \[role\^=menuitem\], \[role=option\], \[role=tab\]\) \{\s*cursor: default;/,
  );
});

test("high contrast keeps frames, buttons and the active window distinguishable", () => {
  const forced = block(windowsCss, "@media (forced-colors: active)");
  expect(forced).toMatch(
    /\.WinWindow,\s*\.WinMenu,\s*\.WinMessageBox[^{]*\{\s*border: 1px solid CanvasText;/,
  );
  expect(forced).toMatch(
    /\.WinButton,\s*\.WinWindowControls button,\s*\.WinQuickButton[^{]*\{\s*border: 1px solid ButtonText;/,
  );
  expect(forced).toMatch(
    /\[aria-pressed=true\][^{]*\{\s*forced-color-adjust: none;\s*color: HighlightText;\s*background: Highlight;/,
  );
  expect(forced).toMatch(
    /\.WinTitlebar \{\s*forced-color-adjust: none;\s*color: HighlightText;\s*background: Highlight;/,
  );
  expect(forced).toMatch(
    /\[data-active=false\] \.WinTitlebar \{\s*color: GrayText;\s*background: Canvas;/,
  );
  expect(forced).toMatch(/\.Win98Icon,[^{]*\{\s*forced-color-adjust: none;/);
  // The Windows 98 scrollbars give way to the system's.
  expect(windowsCss).toContain(
    "@media (pointer: fine) and (forced-colors: none)",
  );
});

test("16 px places use hand-drawn 16 px art; 32 px art is never stretched", () => {
  // Chrome icons have their own 16-unit art.
  for (const name of [
    "folder",
    "folder-open",
    "computer",
    "drive",
    "document",
    "notepad",
    "info",
    "help",
    "find",
    "mail",
    "recycle",
    "terminal",
    "shutdown",
    "games",
    "tools",
    "web",
    "experiments",
  ]) {
    const host = document.createElement("div");
    host.innerHTML = windowsIcon(name, 16);
    const svg = host.querySelector("svg")!;
    expect(
      [svg.getAttribute("width"), svg.getAttribute("viewBox")],
      name,
    ).toEqual(["16", "0 0 16 16"]);
    expect(svg.classList.contains("Win98Icon--small")).toBe(true);
    expect(markup(name, 16)).not.toBe(markup(name));
  }
  // Without 16 px art, a project icon is shrunk; unknown names are documents.
  expect(
    iconOf(
      new DOMParser().parseFromString(windowsIcon("paintaz", 16), "text/html")
        .body,
    ),
  ).toEqual(["16", "0 0 32 32"]);
  expect(markup("no-such-icon")).toBe(markup("document"));
  expect(markup("no-such-icon", 16)).toBe(markup("document", 16));
  // Every icon is valid decorative art.
  for (const name of windowsIconNames())
    for (const size of [16, 32] as const) {
      const host = document.createElement("div");
      host.innerHTML = windowsIcon(name, size);
      const svg = host.querySelector('svg[aria-hidden="true"]');
      expect(svg, name).not.toBeNull();
      expect(svg!.getAttribute("shape-rendering")).toBe("crispEdges");
      expect(svg!.querySelector("rect, path")).not.toBeNull();
    }
});

test("the trademark-like flag is gone and shell objects have their own icons", () => {
  expect(windowsIconNames()).not.toContain("start");
  // Experiments & Learning no longer borrows My Computer.
  const lab = desktop().querySelector(
    '.WinFiles [data-win-action="folder:lab"]',
  );
  expect(lab).not.toBeNull();
  click("folder:lab", explorer());
  expect(explorer().querySelector(".WinSysMenu svg")!.outerHTML).toBe(
    markup("experiments", 16),
  );
  // Start: 32 px icons at the top level, each its own; 16 px in cascades.
  click("start");
  const top = [
    ...desktop().querySelectorAll<HTMLElement>(".WinStartMenu > .WinMenuItem"),
  ];
  const art = top.map(item => item.querySelector("svg")!.outerHTML);
  expect(new Set(art).size).toBe(top.length);
  for (const [label, name] of [
    ["Programs", "programs"],
    ["Documents", "documents"],
    ["Settings", "settings"],
    ["Find", "find"],
    ["Help", "help"],
    ["Run…", "run"],
    ["Shut Down…", "shutdown"],
  ])
    expect(menuItem(label).querySelector("svg")!.outerHTML, label).toBe(
      markup(name),
    );
  menuItem("Programs").click();
  const cascade = desktop().querySelector(".WinStartSubmenu")!;
  for (const svg of cascade.querySelectorAll("svg.Win98Icon"))
    expect(svg.getAttribute("width")).toBe("16");
});

test("title bars, tasks, Quick Launch, lists and menus use 16 px icons", () => {
  const win = explorer();
  expect(iconOf(win.querySelector(".WinSysMenu"))).toEqual(["16", "0 0 16 16"]);
  for (const element of desktop().querySelectorAll(
    ".WinTask, .WinQuickButton, .WinStart, .WinTray",
  ))
    expect(iconOf(element)[0]).toBe("16");
  expect(iconOf(win.querySelector(".WinComboIcon"))[0]).toBe("16");
  expect(iconOf(win.querySelector(".WinStatusZone"))[0]).toBe("16");
  // Desktop and Large Icons: 32 px; the other views 16 px.
  expect(
    iconOf(desktop().querySelector(".WinDesktopIcons [data-list-item]"))[0],
  ).toBe("32");
  expect(iconOf(win.querySelector(".WinFiles [data-list-item]"))[0]).toBe("32");
  for (const view of ["Small Icons", "List", "Details"]) {
    [...win.querySelectorAll<HTMLElement>(".WinMenuBarItem")]
      .find(item => item.textContent === "View")!
      .click();
    menuItem(view).click();
    const items = [...win.querySelectorAll(".WinFiles [data-list-item]")];
    expect(items.length, view).toBeGreaterThan(projects.length);
    for (const item of items) expect(iconOf(item)[0], view).toBe("16");
  }
  // Window captions of projects shrink their 32 px art to 16 px.
  click("project:paintaz", desktop().querySelector(".WinDesktopIcons")!);
  const project = desktop().querySelector('[data-window="project:paintaz"]');
  expect(iconOf(project!.querySelector(".WinSysMenu"))).toEqual([
    "16",
    "0 0 32 32",
  ]);
});

test("the safe-to-turn-off screen uses a proportional face and the solid dither", () => {
  const title = rule(shutdownCss, ".Shutdown h2");
  expect(title).toMatch(/font: 700 clamp\(24px, 4\.8cqi, 68px\)\/1\.2 Tahoma/);
  // Inside the CRT, --sans is the terminal's monospace.
  expect(title).not.toContain("var(--sans)");
  expect(title).toContain("text-wrap: balance");
  // Solid black 50% cells, for the shutdown screen and the Shut Down dialog.
  const checkerboard =
    /--dither: conic-gradient\(#000 25%, #0000 0 50%, #000 0 75%, #0000 0\) 0 0 \/\s+2px\s+2px;/;
  for (const [css, selector] of [
    [shutdownCss, ".ShutdownDesktop"],
    [windowsCss, ".WinDither"],
  ]) {
    expect(rule(css, selector)).toMatch(checkerboard);
    expect(rule(css, selector)).toContain("background: var(--dither)");
    // Under the CRT filter the checkerboard would beat into moiré waves, so
    // it is an even 50% dim while the filter bends the picture...
    const filtered = `html:not([data-crt=off]) .CRTScreen ${selector}`;
    expect(rule(css, filtered)).toContain(
      "background: rgba(0, 0, 0, 0.5019607843)",
    );
    // ...and the checkerboard again wherever crt.scss drops the filter.
    const unfiltered =
      "@media (prefers-contrast: more), (forced-colors: active)";
    expect(rule(block(css, unfiltered), filtered)).toContain(
      "background: var(--dither)",
    );
    expect(
      rule(
        block(crtCss, unfiltered),
        ".CRTScreen,\n  .CRTScreen[data-crt-samples]",
      ),
    ).toContain("filter: none");
  }
  expect(rule(crtCss, "html[data-crt=off] .CRTScreen")).toContain(
    "filter: none",
  );
  // The dialog's dither is not doubled by the shutdown screen's.
  expect(
    rule(
      shutdownCss,
      ".Win98[data-shutdown-dither] ~ .Experience--shutdown-animation .ShutdownDesktop",
    ),
  ).toContain("background: none");
  expect(rule(shutdownCss, ".WindowsProgress")).toContain(
    "height: clamp(6px, 2cqh, 16px)",
  );
});

test("Windows 98 tooltips follow the mouse after half a second, never touch", () => {
  vi.useFakeTimers();
  const root = desktop();
  const workspace = root.querySelector<HTMLElement>(".WinWorkspace")!;
  const tip = root.querySelector<HTMLElement>(".WinTooltip")!;
  expect(tip.getAttribute("aria-hidden")).toBe("true");
  const box = (left: number, top: number, right: number, bottom: number) =>
    ({
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    }) as DOMRect;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue(box(0, 0, 800, 600));
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue(
    box(0, 0, 800, 572),
  );
  vi.spyOn(tip, "offsetWidth", "get").mockReturnValue(100);
  vi.spyOn(tip, "offsetHeight", "get").mockReturnValue(15);
  const hover = (
    element: Element,
    x: number,
    y: number,
    pointerType = "mouse",
  ) =>
    element.dispatchEvent(
      new PointerEvent("pointerover", {
        bubbles: true,
        pointerType,
        clientX: x,
        clientY: y,
      }),
    );
  const close = explorer().querySelector('[data-win-action="close"]')!;
  const maximize = explorer().querySelector('[data-win-action="maximize"]')!;
  // Names stay in aria-label; no native title tooltips.
  expect(close.hasAttribute("title")).toBe(false);
  expect(close.getAttribute("aria-label")).toBe("Close My Projects");
  hover(close.querySelector("svg")!, 500, 10);
  vi.advanceTimersByTime(499);
  expect(tip.hidden).toBe(true);
  vi.advanceTimersByTime(1);
  expect(tip.hidden).toBe(false);
  expect(tip.textContent).toBe("Close");
  // Below and right of the pointer.
  expect([tip.style.left, tip.style.top]).toEqual(["500px", "30px"]);
  // Moving to the next tool swaps the text at once.
  hover(maximize, 480, 10);
  expect(tip.textContent).toBe("Maximize");
  // A press hides it until the pointer leaves the tool.
  maximize.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(tip.hidden).toBe(true);
  hover(maximize.querySelector("svg")!, 481, 10);
  vi.advanceTimersByTime(1000);
  expect(tip.hidden).toBe(true);
  // The clock's date shows above the taskbar, inside the workspace.
  const clock = root.querySelector<HTMLElement>(".WinClock")!;
  hover(clock, 790, 590);
  vi.advanceTimersByTime(500);
  expect(tip.textContent).toBe(clock.dataset.tip);
  expect(clock.dataset.tip).toMatch(/\d{4}/);
  expect([tip.style.left, tip.style.top]).toEqual(["700px", "557px"]);
  key(document.body, "a");
  expect(tip.hidden).toBe(true);
  // Touch and pen never show tooltips.
  hover(close, 500, 10, "touch");
  vi.advanceTimersByTime(1000);
  expect(tip.hidden).toBe(true);
  // A task button shows its title only while its label is cut off.
  const task = root.querySelector<HTMLElement>(".WinTask")!;
  const label = task.querySelector("span")!;
  vi.spyOn(label, "clientWidth", "get").mockReturnValue(80);
  const width = vi.spyOn(label, "scrollWidth", "get").mockReturnValue(80);
  hover(task, 300, 590);
  vi.advanceTimersByTime(500);
  expect(tip.hidden).toBe(true);
  hover(root.querySelector(".WinWallpaper")!, 300, 300);
  width.mockReturnValue(120);
  hover(task, 300, 590);
  vi.advanceTimersByTime(500);
  expect(tip.textContent).toBe("My Projects");
  root.dispatchEvent(new PointerEvent("pointerleave"));
  expect(tip.hidden).toBe(true);
  vi.useRealTimers();
});

// W4.1 The CRT picture

test("Start ▸ Settings and Display Properties switch the CRT display effects", () => {
  const html = document.documentElement;
  expect(getCrtEffects()).toBe(true);
  try {
    click("start");
    menuItem("Settings").click();
    const item = menuItem("Display effects");
    expect(item.getAttribute("role")).toBe("menuitemcheckbox");
    expect(item.getAttribute("aria-checked")).toBe("true");
    item.click();
    expect(html.dataset.crt).toBe("off");
    expect(localStorage.getItem("portfolio-crt")).toBe("off");
    click("start");
    menuItem("Settings").click();
    expect(menuItem("Display effects").getAttribute("aria-checked")).toBe(
      "false",
    );
    click("start");
    // Display Properties shows the same setting and turns it back on.
    desktop()
      .querySelector(".WinWorkspace")!
      .dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 300,
          clientY: 200,
        }),
      );
    menuItem("Properties").click();
    const sheet = desktop().querySelector<HTMLElement>(".WinMessageBox")!;
    const effects = sheet.querySelector<HTMLInputElement>(
      'input[name="effects"]',
    )!;
    expect(effects.closest("label")!.textContent).toBe(
      "Display effects (CRT picture)",
    );
    expect(effects.checked).toBe(false);
    effects.click();
    sheet
      .querySelector<HTMLButtonElement>('[data-message-button="ok"]')!
      .click();
    expect(html.dataset.crt).toBe("on");
    expect(localStorage.getItem("portfolio-crt")).toBe("on");
  } finally {
    setCrtEffects(true);
  }
});

test("the CRT shows the desktop and the startup and shutdown screens in graphics mode", () => {
  const screen = document.querySelector<HTMLElement>(".CRTScreen")!;
  expect(screen.contains(desktop())).toBe(true);
  expect(videoModeOf(screen)).toBe("graphics");
  window.terminal.closeWindows();
  expect(videoModeOf(screen)).toBe("text");
  // The animated screens, as the terminal mounts them.
  store.system.animations = true;
  try {
    window.terminal.enterWindowsStartup();
    expect(screen.querySelector(".Experience--windows-startup")).not.toBeNull();
    expect(videoModeOf(screen)).toBe("graphics");
    window.terminal.finishExperience();
    window.terminal.enterShutdownAnimation();
    expect(
      screen.querySelector(".Experience--shutdown-animation"),
    ).not.toBeNull();
    expect(videoModeOf(screen)).toBe("graphics");
    window.terminal.finishExperience();
    expect(videoModeOf(screen)).toBe("text");
  } finally {
    store.system.animations = false;
  }
  // The safe-to-turn-off screen and the boot log are text mode.
  const fixture = document.createElement("div");
  for (const kind of ["shutdown", "boot"] as const) {
    fixture.replaceChildren(Experience(kind, () => {}).dialog);
    expect(videoModeOf(fixture), kind).toBe("text");
  }
  // Graphics modes use tighter raster corners, so Start and a maximized
  // window's Close keep their outer bevels.
  expect(rule(crtCss, ".CRTScreen[data-video-mode=graphics]")).toContain(
    "--crt-raster-radius: 6px",
  );
});

test("Stand by blanks the CRT and turns its power light amber", async () => {
  const screen = document.querySelector<HTMLElement>(".CRTScreen")!;
  click("start");
  menuItem("Shut Down…").click();
  const dialog = desktop().querySelector<HTMLElement>(".WinMessageBox")!;
  dialog.querySelector<HTMLInputElement>('[value="standby"]')!.click();
  dialog
    .querySelector<HTMLButtonElement>('[data-message-button="ok"]')!
    .click();
  await vi.waitFor(() => expect(screen.dataset.standby).toBe(""));
  // crt.scss keys the amber light, the blank tube and the resting filter off
  // the screen that holds the desktop.
  expect(desktop().closest(".CRTScreen[data-standby]")).toBe(screen);
  expect(
    rule(
      crtCss,
      ".TerminalWindow:has(.CRTScreen[data-standby]) .CRTLED--power::after",
    ),
  ).toMatch(/opacity: 1;[\s\S]*#e3a244/);
  expect(
    rule(crtCss, ".CRTScreen[data-power=off],\n.CRTScreen[data-standby]"),
  ).toContain("filter: none");
  key(document.activeElement!, "Shift");
  expect(screen.dataset.standby).toBeUndefined();
});

test("review fixes: option buttons, Details, Address list, links and fields", () => {
  // Shut Down's option buttons are drawn, 12 px, with a dotted label focus.
  const radio = rule(windowsCss, ".WinShutDown input");
  expect(radio).toMatch(/width: 12px;\s*height: 12px;/);
  expect(radio).toContain("appearance: none");
  expect(radio).toContain("data:image/svg+xml");
  expect(windowsCss).not.toContain("accent-color: #000080");
  expect(rule(windowsCss, ".WinShutDown input:focus + span")).toContain(
    "outline: 1px dotted #000",
  );
  const forced = block(windowsCss, "@media (forced-colors: active)");
  expect(forced).toMatch(
    /\.WinCheck input,\s*\.WinShutDown input \{\s*appearance: auto;/,
  );
  // Details highlights the name only, never the whole row.
  expect(windowsCss).not.toMatch(/tr\[aria-selected=true\] > td/);
  expect(windowsCss).toMatch(
    /\[data-listview\]:focus-within tr\[aria-selected=true\] \.WinDetailsName > span \{\s*color: #fff;\s*background: #000080;/,
  );
  // The Address list is a white combo list in a black frame.
  expect(rule(windowsCss, ".WinAddressMenu")).toMatch(
    /padding: 0;\s*border: 1px solid #000;\s*background: #fff;\s*box-shadow: none;/,
  );
  // Web View links are all blue, buttons included.
  expect(rule(windowsCss, ".Win98 .WinWebLink")).toContain("color: #00f");
  // Text fields show no dotted rectangle.
  for (const field of [".WinRunField input:focus", ".WinCombo input:focus"])
    expect(rule(windowsCss, field)).toContain("outline: none");
  expect(windowsCss).not.toMatch(/\.WinCombo input:focus-visible/);
});

test("review fixes: grips, sunken pages, tool glyphs and dialog layouts", () => {
  // The task band starts with a raised grip, not an etched separator.
  expect(rule(windowsCss, ".WinQuickLaunch::after")).toMatch(
    /width: 3px;[\s\S]*inset 1px 1px #fff,\s*inset -1px -1px #808080;/,
  );
  // Explorer's menu bar is a rebar band with its own grip.
  expect(
    rule(windowsCss, ".WinWindow--explorer .WinMenuBar::before"),
  ).toContain("width: 3px");
  // Help and project pages sit in a sunken client edge and scroll in it.
  expect(rule(windowsCss, ".WinProject")).toMatch(
    /overflow: auto;[\s\S]*box-shadow: var\(--win-sunken\);/,
  );
  // Explorer's glyphs rest in grey where the mouse can hover them.
  expect(
    block(windowsCss, "@media (hover: hover) and (pointer: fine)"),
  ).toContain("filter: grayscale(1)");
  // Dialogs right-align their buttons; a sheet's tab joins its page.
  expect(rule(windowsCss, ".WinMessageBox--dialog .WinMessageBoxButtons")).toBe(
    "\n  justify-content: flex-end;\n",
  );
  expect(rule(windowsCss, ".WinSheetPage")).toContain(
    "box-shadow: var(--win-raised-window)",
  );
});

test("review fixes: short touch screens fold the chrome; Find fits the workspace", () => {
  const short = block(
    windowsCss,
    "@media (pointer: coarse) and (max-height: 500px)",
  );
  expect(rule(short, ".WinWebView")).toContain("display: none");
  expect(rule(short, ".WinRebar")).toContain("flex-direction: row");
  expect(short).toMatch(/\.WinToolLabel,\s*\.WinAddressBand label \{/);
  expect(rule(short, ".WinMenuBarItem")).toContain("min-height: 30px");
  expect(short).toMatch(
    /\.WinStartMenu > \.WinMenuItem,\s*\.WinMenu--push\.WinStartMenu > \.WinMenuItem \{\s*min-height: 32px;/,
  );
  expect(rule(windowsCss, ".WinWindow--find")).toContain("max-height: 100%");
  expect(rule(windowsCss, ".WinFindBody")).toContain("overflow: auto");
  // The Views arrow is a 24 px touch target on every coarse pointer.
  expect(windowsCss).toMatch(
    /@media \(pointer: coarse\) \{[^@]*\.WinToolDrop \{\s*min-width: 24px;\s*width: 24px;/,
  );
});

test("review fixes: the CRT draws 1 px dithers as their average and black as the tube", () => {
  expect(
    rule(windowsCss, "html:not([data-crt=off]) .CRTScreen .Win98"),
  ).toMatch(/--win-dither: #e0e0e0;\s*--win-dither-dark: #404040;/);
  // High contrast and display effects off keep the checkerboards.
  expect(
    block(
      windowsCss,
      "@media (prefers-contrast: more), (forced-colors: active)",
    ),
  ).toMatch(/--win-dither: conic-gradient/);
  expect(windowsCss).toContain("background: var(--win-dither-dark)");
  expect(rule(shutdownCss, ".Experience")).toContain(
    "background: var(--crt-tube, #000)",
  );
});

test("review fixes: the 16 px Find icon has a black handle, not a navy one", () => {
  const icon = markup("find", 16);
  expect(icon).not.toContain("#000080");
  expect(icon).toContain("#000000");
});
