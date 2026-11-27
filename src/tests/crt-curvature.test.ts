import { readFileSync } from "node:fs";
import { compileString } from "sass";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  bendAmplitude,
  filterParams,
  getCrtEffects,
  initCrtCurvature,
  isWebKit,
  scanlines,
  setCrtEffects,
  TWO_SAMPLES,
  videoModeOf,
  visualOffset,
} from "../utils/crt-curvature";

// happy-dom reports AppleWebKit without Chrome/, so the tests choose an engine.
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15";
const WEBKIT_AGENTS = [
  SAFARI,
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1",
  // Chrome, Firefox and Edge on iPhone and iPad run on WebKit.
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/141.0 Mobile/15E148 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/138.3351.83 Mobile/15E148 Safari/605.1.15",
  // WebKitGTK (Epiphany) and WPE.
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
];
const OTHER_AGENTS = [
  CHROME,
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 OPR/121.0.0.0",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.63 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/138.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0",
  "Mozilla/5.0 (Android 15; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0",
];
function setUserAgent(userAgent: string) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    get: () => userAgent,
  });
}

const indexHtml = readFileSync("index.html", "utf8");
// Classic inline scripts that run before the app's module.
const bootstrap = indexHtml.match(
  /<script data-crt-bootstrap>([\s\S]*?)<\/script>/,
)![1];
const headScript = indexHtml.match(
  /<script>([\s\S]*?)<\/script>\s*<\/head>/,
)![1];
// The real filters and case markup, without the app script.
const svgMarkup = indexHtml.match(/<svg width="0"[\s\S]*?<\/svg>/)![0];

let frames: FrameRequestCallback[] = [];
let resolutionListeners: (() => void)[] = [];
let resizeCallbacks: (() => void)[] = [];
let dispose: (() => void) | undefined;

const screen = () => document.querySelector<HTMLElement>(".CRTScreen")!;
const filter = (id = "crt-curvature") => document.getElementById(id)!;
const funcs = (id?: string) =>
  [...filter(id).querySelectorAll("feFuncR, feFuncG")].map(func => [
    func.getAttribute("slope"),
    func.getAttribute("intercept"),
  ]);
const scale = (id?: string) =>
  filter(id).querySelector("feDisplacementMap")!.getAttribute("scale");
function expectFunc(
  [slope, intercept]: (string | null)[],
  expectedSlope: number,
  expectedIntercept: number,
) {
  expect(Number(slope)).toBeCloseTo(expectedSlope, 5);
  expect(Number(intercept)).toBeCloseTo(expectedIntercept, 5);
}

function flushFrames() {
  const pending = frames;
  frames = [];
  for (const callback of pending) callback(performance.now());
}

async function settle() {
  // MutationObserver callbacks run as microtasks before the next frame.
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  flushFrames();
}

function setSize(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, "offsetWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    value: height,
  });
}

function setRect(
  element: Element,
  left: number,
  top: number,
  w: number,
  h: number,
) {
  element.getBoundingClientRect = () =>
    ({
      left,
      top,
      width: w,
      height: h,
      x: left,
      y: top,
      right: left + w,
      bottom: top + h,
    }) as DOMRect;
}

beforeEach(() => {
  frames = [];
  resolutionListeners = [];
  resizeCallbacks = [];
  document.documentElement.removeAttribute("data-crt");
  document.documentElement.removeAttribute("data-crt-curvature");
  setUserAgent(CHROME);
  localStorage.removeItem("portfolio-crt");
  document.body.innerHTML = `${svgMarkup}<div class="CRTGlass"><div class="CRTScreen"><header class="TerminalBar"><button type="button" data-crt-hit>Animations: on</button></header></div></div>`;
  setSize(screen(), 1244, 692);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      media: query,
      matches: true,
      addEventListener: (_type: string, listener: () => void) =>
        resolutionListeners.push(listener),
      removeEventListener: (_type: string, listener: () => void) => {
        resolutionListeners = resolutionListeners.filter(
          item => item !== listener,
        );
      },
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-crt");
  document.documentElement.removeAttribute("data-crt-curvature");
  // Back to happy-dom's own user agent on the prototype.
  Reflect.deleteProperty(navigator, "userAgent");
  localStorage.removeItem("portfolio-crt");
});

test("the bow scales with the screen and is capped per video mode", () => {
  const cases = [
    // [width, height, text {ax, ay}, graphics {ax, ay}]
    [322, 738, [5.904, 2.576], [3.5, 2.576]],
    [1244, 692, [5.536, 8], [3.5, 3.5]],
    [1500, 1232, [8, 8], [3.5, 3.5]],
  ] as const;
  for (const [width, height, text, graphics] of cases) {
    const textBend = bendAmplitude(width, height, "text");
    expect(textBend.ax).toBeCloseTo(text[0], 6);
    expect(textBend.ay).toBeCloseTo(text[1], 6);
    const graphicsBend = bendAmplitude(width, height, "graphics");
    expect(graphicsBend.ax).toBeCloseTo(graphics[0], 6);
    expect(graphicsBend.ay).toBeCloseTo(graphics[1], 6);
  }
  expect(bendAmplitude(100, 100, "text")).toEqual({ ax: 2, ay: 2 });
});

test("filter parameters reproduce the original filter at DPR 1 and halve the offsets at DPR 2", () => {
  const original = filterParams(9, 9, 1);
  expect(original.scale).toBe(18);
  expect(original.slopeR).toBe(1);
  expect(original.slopeG).toBe(1);
  const expected = [
    [-0.020833, -0.006944],
    [-0.006944, 0.020833],
    [0.006944, -0.020833],
    [0.020833, 0.006944],
  ];
  original.intercepts.forEach(({ interceptR, interceptG }, index) => {
    expect(interceptR).toBeCloseTo(expected[index][0], 6);
    expect(interceptG).toBeCloseTo(expected[index][1], 6);
  });

  const dense = filterParams(9, 9, 2);
  dense.intercepts.forEach(({ interceptR, interceptG }, index) => {
    expect(interceptR).toBeCloseTo(expected[index][0] / 2, 6);
    expect(interceptG).toBeCloseTo(expected[index][1] / 2, 6);
  });

  // Per-axis amplitude: the smaller axis gets a lower slope and a centred intercept.
  const phone = filterParams(5.904, 2.576, 1);
  expect(phone.scale).toBeCloseTo(11.808, 6);
  expect(phone.slopeG).toBeCloseTo(2.576 / 5.904, 6);
  expect(phone.intercepts[0].interceptG).toBeCloseTo(
    0.5 * (1 - phone.slopeG) - 0.125 / 11.808,
    6,
  );

  const two = filterParams(9, 9, 2, TWO_SAMPLES);
  expect(two.intercepts).toHaveLength(2);
  expect(two.intercepts[0].interceptR).toBeCloseTo(-0.25 / 36, 6);
});

test("content near the top-left corner is drawn further right and down", () => {
  const rect = { left: 0, top: 0, width: 1000, height: 600 };
  const topLeft = visualOffset(0, 0, rect, 5, 4);
  expect(topLeft.dx).toBeCloseTo(5, 6);
  expect(topLeft.dy).toBeCloseTo(4, 6);
  const bottomRight = visualOffset(1000, 600, rect, 5, 4);
  expect(bottomRight.dx).toBeCloseTo(-5, 6);
  expect(bottomRight.dy).toBeCloseTo(-4, 6);
  const centre = visualOffset(500, 300, rect, 5, 4);
  expect(centre.dx).toBeCloseTo(0, 6);
  expect(centre.dy).toBeCloseTo(0, 6);
  // The middle of the top edge only moves vertically.
  const top = visualOffset(500, 0, rect, 5, 4);
  expect(top.dx).toBeCloseTo(0, 6);
  expect(top.dy).toBeCloseTo(0, 6);
});

test("scanlines snap to whole device pixels", () => {
  expect(scanlines("text", 1)).toEqual({ period: 3, line: 1 });
  expect(scanlines("text", 2)).toEqual({ period: 3, line: 1 });
  expect(scanlines("text", 1.5).period * 1.5).toBe(5);
  expect(scanlines("text", 1.25).period * 1.25).toBe(4);
  expect(scanlines("graphics", 1)).toEqual({ period: 2, line: 1 });
  expect(scanlines("graphics", 3)).toEqual({ period: 2, line: 1 / 3 });
});

test("the video mode follows the screen's direct children", () => {
  const element = document.createElement("div");
  expect(videoModeOf(element)).toBe("text");
  const nested = document.createElement("div");
  nested.innerHTML = '<div class="Win98"></div>';
  element.append(nested);
  expect(videoModeOf(element)).toBe("text");
  for (const className of [
    "Win98",
    "Experience Experience--windows-startup",
    "Experience Experience--shutdown-animation",
  ]) {
    const child = document.createElement("div");
    child.className = className;
    element.replaceChildren(child);
    expect(videoModeOf(element)).toBe("graphics");
  }
  const boot = document.createElement("dialog");
  boot.className = "Experience Experience--boot";
  element.replaceChildren(boot);
  expect(videoModeOf(element)).toBe("text");
});

test("both filters inline their displacement map", () => {
  const images = document.querySelectorAll("feImage");
  expect(images).toHaveLength(2);
  for (const image of images)
    expect(image.getAttribute("href")).toMatch(/^data:image\/png;base64,/);
  expect(indexHtml).not.toContain("crt-displacement.png");
});

test("initCrtCurvature sizes the filters for the screen and video mode", async () => {
  dispose = initCrtCurvature();
  expect(screen().dataset.videoMode).toBe("text");
  expect(scale()).toBe("16");
  // ax = 0.008 * 692 = 5.536, ay = 8 (cap), so the scale is 2 * 8.
  expectFunc(funcs()[0], 0.692, 0.5 * (1 - 0.692) - 0.375 / 16);
  expectFunc(funcs()[1], 1, -0.125 / 16);
  expectFunc(funcs()[6], 0.692, 0.5 * (1 - 0.692) + 0.375 / 16);
  expect(screen().style.getPropertyValue("--scan-period")).toBe("3px");
  expect(screen().style.getPropertyValue("--scan-line")).toBe("1px");
  expect(screen().hasAttribute("data-crt-samples")).toBe(false);

  const desktop = document.createElement("div");
  desktop.className = "Win98";
  screen().append(desktop);
  await settle();
  expect(screen().dataset.videoMode).toBe("graphics");
  expect(scale()).toBe("7");
  expectFunc(funcs()[0], 1, -0.375 / 7);
  expect(screen().style.getPropertyValue("--scan-period")).toBe("2px");

  desktop.remove();
  await settle();
  expect(screen().dataset.videoMode).toBe("text");
  expect(scale()).toBe("16");
});

test("initCrtCurvature writes attributes only when a value changes", async () => {
  dispose = initCrtCurvature();
  const setAttribute = vi.spyOn(Element.prototype, "setAttribute");
  const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
  for (const callback of resizeCallbacks) callback();
  flushFrames();
  expect(setAttribute).not.toHaveBeenCalled();
  expect(setProperty).not.toHaveBeenCalled();

  setSize(screen(), 1500, 1232);
  for (const callback of resizeCallbacks) callback();
  for (const callback of resizeCallbacks) callback();
  expect(frames).toHaveLength(1);
  flushFrames();
  expect(scale()).toBe("16");
  expectFunc(funcs()[0], 1, -0.375 / 16);
});

test("a resolution change recomputes the subpixel offsets and listens again", async () => {
  dispose = initCrtCurvature();
  expect(window.matchMedia).toHaveBeenLastCalledWith("(resolution: 1dppx)");
  expect(resolutionListeners).toHaveLength(1);

  vi.stubGlobal("devicePixelRatio", 2);
  resolutionListeners[0]();
  expect(window.matchMedia).toHaveBeenLastCalledWith("(resolution: 2dppx)");
  expect(resolutionListeners).toHaveLength(1);
  flushFrames();
  // At DPR 2 the offsets are halved, and the two-sample filter takes over.
  expectFunc(funcs()[1], 1, -0.125 / 16 / 2);
  expect(screen().dataset.crtSamples).toBe("2");
  expectFunc(funcs("crt-curvature-2")[1], 1, -0.25 / 16 / 2);
  expect(screen().style.getPropertyValue("--scan-period")).toBe("3px");
  expect(screen().style.getPropertyValue("--scan-line")).toBe("1px");

  vi.stubGlobal("devicePixelRatio", 1.5);
  resolutionListeners[0]();
  flushFrames();
  expect(screen().hasAttribute("data-crt-samples")).toBe(false);
  // Two device pixels in a period of five.
  expect(screen().style.getPropertyValue("--scan-line")).toBe("1.3333px");
  expect(screen().style.getPropertyValue("--scan-period")).toBe("3.3333px");
});

test("marked controls get the offset of where they are drawn", async () => {
  setRect(screen(), 0, 0, 1244, 692);
  const button = document.querySelector<HTMLElement>("[data-crt-hit]")!;
  Object.defineProperty(button, "offsetParent", {
    configurable: true,
    value: screen(),
  });
  // Top-right corner: drawn further left and down.
  setRect(button, 1200, 10, 30, 20);
  dispose = initCrtCurvature();
  const expected = visualOffset(
    1215,
    20,
    screen().getBoundingClientRect(),
    5.536,
    8,
  );
  expect(button.style.getPropertyValue("--crt-dx")).toBe(
    `${Math.round(expected.dx * 2) / 2}px`,
  );
  expect(button.style.getPropertyValue("--crt-dy")).toBe(
    `${Math.round(expected.dy * 2) / 2}px`,
  );
  expect(parseFloat(button.style.getPropertyValue("--crt-dx"))).toBeLessThan(0);
  expect(parseFloat(button.style.getPropertyValue("--crt-dy"))).toBeGreaterThan(
    0,
  );

  // Hidden controls are skipped; a control marked later is picked up.
  const hidden = document.createElement("button");
  hidden.dataset.crtHit = "";
  // As for display: none.
  Object.defineProperty(hidden, "offsetParent", {
    configurable: true,
    value: null,
  });
  setRect(hidden, 0, 0, 20, 20);
  screen().append(hidden);
  const late = document.createElement("button");
  screen().append(late);
  Object.defineProperty(late, "offsetParent", {
    configurable: true,
    value: screen(),
  });
  setRect(late, 0, 672, 40, 20);
  await settle();
  expect(hidden.style.getPropertyValue("--crt-dx")).toBe("");
  late.dataset.crtHit = "";
  await settle();
  expect(parseFloat(late.style.getPropertyValue("--crt-dx"))).toBeGreaterThan(
    0,
  );
  expect(parseFloat(late.style.getPropertyValue("--crt-dy"))).toBeLessThan(0);
});

test("scrolling inside the screen moves hit targets without touching the filters", async () => {
  setRect(screen(), 0, 0, 1244, 692);
  const output = document.createElement("div");
  const button = document.createElement("button");
  button.dataset.crtHit = "";
  Object.defineProperty(button, "offsetParent", {
    configurable: true,
    value: screen(),
  });
  output.append(button);
  screen().append(output);
  setRect(button, 600, 300, 40, 20);
  dispose = initCrtCurvature();
  expect(button.style.getPropertyValue("--crt-dx")).toBe("0px");

  // Scrolled into the bottom-left corner.
  setRect(button, 0, 672, 40, 20);
  const setAttribute = vi.spyOn(Element.prototype, "setAttribute");
  // Scroll events do not bubble; the screen catches them on the way down.
  output.dispatchEvent(new Event("scroll"));
  output.dispatchEvent(new Event("scroll"));
  expect(frames).toHaveLength(1);
  flushFrames();
  expect(parseFloat(button.style.getPropertyValue("--crt-dx"))).toBeGreaterThan(
    0,
  );
  expect(parseFloat(button.style.getPropertyValue("--crt-dy"))).toBeLessThan(0);
  // Only the moved control's style is written.
  expect(
    setAttribute.mock.contexts.filter(context => context !== button),
  ).toEqual([]);

  // A scroll does not downgrade a pending full update.
  setSize(screen(), 1500, 1232);
  for (const callback of resizeCallbacks) callback();
  output.dispatchEvent(new Event("scroll"));
  flushFrames();
  expect(scale()).toBe("16");
  expectFunc(funcs()[0], 1, -0.375 / 16);
});

test("the terminal's edge controls opt into hit compensation", () => {
  const page = new DOMParser().parseFromString(indexHtml, "text/html");
  const controls = page.querySelectorAll(
    ".TerminalControls button, .QuickCommands a, .QuickCommands button",
  );
  expect(controls).toHaveLength(8);
  for (const control of controls) {
    expect(control.hasAttribute("data-crt-hit")).toBe(true);
    // The hit area takes ::before, so shortcut brackets sit on the label.
    if (control.closest(".QuickCommands"))
      expect(control.firstElementChild?.tagName).toBe("SPAN");
  }
});

test("display effects can be switched off and the choice is remembered", () => {
  expect(getCrtEffects()).toBe(true);
  setCrtEffects(false);
  expect(getCrtEffects()).toBe(false);
  expect(document.documentElement.dataset.crt).toBe("off");
  expect(localStorage.getItem("portfolio-crt")).toBe("off");

  document.documentElement.removeAttribute("data-crt");
  dispose = initCrtCurvature();
  expect(getCrtEffects()).toBe(false);

  setCrtEffects(true);
  expect(getCrtEffects()).toBe(true);
  expect(localStorage.getItem("portfolio-crt")).toBe("on");
});

test("display effects still switch when storage is unavailable", () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  // Some privacy modes throw as soon as storage is touched.
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  try {
    setCrtEffects(false);
    expect(getCrtEffects()).toBe(false);
    document.documentElement.removeAttribute("data-crt");
    dispose = initCrtCurvature();
    expect(getCrtEffects()).toBe(true);
  } finally {
    Object.defineProperty(window, "localStorage", descriptor);
  }
});

test("the disposer stops observing", async () => {
  dispose = initCrtCurvature();
  dispose();
  dispose = undefined;
  const desktop = document.createElement("div");
  desktop.className = "Win98";
  screen().append(desktop);
  await settle();
  expect(screen().dataset.videoMode).toBe("text");
  expect(resolutionListeners).toHaveLength(0);
  desktop.dispatchEvent(new Event("scroll"));
  screen().dispatchEvent(new Event("pointerup"));
  expect(frames).toHaveLength(0);
});

test("the first paint bends the picture exactly as the controller will", () => {
  for (const [width, height, dpr] of [
    [1244, 692, 1],
    [390, 730, 2],
    [1440, 760, 1.5],
  ]) {
    document.body.innerHTML = `${svgMarkup}<div class="CRTGlass"><div class="CRTScreen"></div></div>`;
    setSize(screen(), width, height);
    vi.stubGlobal("devicePixelRatio", dpr);
    new Function(bootstrap)();
    expect(scale()).not.toBe("18");
    expect(screen().dataset.videoMode).toBe("text");
    // The controller then has nothing to change: no jump at start-up.
    const setAttribute = vi.spyOn(Element.prototype, "setAttribute");
    const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    dispose = initCrtCurvature();
    expect(setAttribute).not.toHaveBeenCalled();
    expect(setProperty).not.toHaveBeenCalled();
    dispose();
    dispose = undefined;
    vi.restoreAllMocks();
  }
});

test("display effects switched off stay off from the first paint", () => {
  new Function(headScript)();
  expect(document.documentElement.dataset.crt).toBeUndefined();
  localStorage.setItem("portfolio-crt", "off");
  new Function(headScript)();
  expect(document.documentElement.dataset.crt).toBe("off");
  // Blocked storage is not an error.
  document.documentElement.removeAttribute("data-crt");
  const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  try {
    expect(() => new Function(headScript)()).not.toThrow();
  } finally {
    Object.defineProperty(window, "localStorage", descriptor);
  }
});

test("high contrast reports the effects as forced off", async () => {
  const { crtEffectsForcedOff, CRT_HIGH_CONTRAST } =
    await import("../utils/crt-curvature");
  expect(crtEffectsForcedOff()).toBe(true);
  expect(window.matchMedia).toHaveBeenLastCalledWith(CRT_HIGH_CONTRAST);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  expect(crtEffectsForcedOff()).toBe(false);
  // The same query that switches the filter off in crt.scss.
  expect(readFileSync("src/styles/crt.scss", "utf8")).toContain(
    `@media ${CRT_HIGH_CONTRAST} {`,
  );
});

test("WebKit engines are told apart by their user agent, from the first paint", () => {
  for (const [agents, webkit] of [
    [WEBKIT_AGENTS, true],
    [OTHER_AGENTS, false],
  ] as const) {
    for (const userAgent of agents) {
      expect(isWebKit(userAgent), userAgent).toBe(webkit);
      // index.html's head script makes the same call before the first paint.
      document.documentElement.removeAttribute("data-crt-curvature");
      setUserAgent(userAgent);
      new Function(headScript)();
      expect(document.documentElement.dataset.crtCurvature, userAgent).toBe(
        webkit ? "off" : undefined,
      );
    }
  }
});

test("WebKit keeps a flat picture with its scanlines", async () => {
  setUserAgent(SAFARI);
  vi.stubGlobal("devicePixelRatio", 2);
  // index.html's static filter values stay untouched.
  const staticScale = scale();
  const staticFuncs = funcs();
  screen().setAttribute("data-crt-samples", "2");
  setRect(screen(), 0, 0, 1244, 692);
  const button = document.querySelector<HTMLElement>("[data-crt-hit]")!;
  Object.defineProperty(button, "offsetParent", {
    configurable: true,
    value: screen(),
  });
  setRect(button, 1200, 10, 30, 20);
  dispose = initCrtCurvature();

  expect(document.documentElement.dataset.crtCurvature).toBe("off");
  expect(scale()).toBe(staticScale);
  expect(funcs()).toEqual(staticFuncs);
  expect(screen().hasAttribute("data-crt-samples")).toBe(false);
  // Hits stay on the flat layout.
  expect(button.style.getPropertyValue("--crt-dx")).toBe("");
  expect(button.style.getPropertyValue("--crt-dy")).toBe("");
  // Scanlines and the video mode still follow the screen.
  expect(screen().dataset.videoMode).toBe("text");
  expect(screen().style.getPropertyValue("--scan-period")).toBe("3px");
  expect(screen().style.getPropertyValue("--scan-line")).toBe("1px");
  const desktop = document.createElement("div");
  desktop.className = "Win98";
  screen().append(desktop);
  await settle();
  expect(screen().dataset.videoMode).toBe("graphics");
  expect(screen().style.getPropertyValue("--scan-period")).toBe("2px");
  expect(scale()).toBe(staticScale);
  // Display effects still switch the scanlines and the edge falloff.
  expect(getCrtEffects()).toBe(true);
  setCrtEffects(false);
  expect(document.documentElement.dataset.crt).toBe("off");
  expect(document.documentElement.dataset.crtCurvature).toBe("off");
});

test("the first paint in WebKit leaves the filters alone", () => {
  setUserAgent(SAFARI);
  vi.stubGlobal("devicePixelRatio", 2);
  const staticScale = scale();
  new Function(headScript)();
  new Function(bootstrap)();
  expect(scale()).toBe(staticScale);
  expect(screen().hasAttribute("data-crt-samples")).toBe(false);
  expect(screen().dataset.videoMode).toBe("text");
  expect(screen().style.getPropertyValue("--scan-period")).toBe("3px");
  // The controller then has nothing to change: no jump at start-up.
  const setAttribute = vi.spyOn(Element.prototype, "setAttribute");
  const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
  dispose = initCrtCurvature();
  expect(setAttribute).not.toHaveBeenCalled();
  expect(setProperty).not.toHaveBeenCalled();
});

test("WebKit's flat picture drops the filter and the hit offsets, and keeps the checkerboards", () => {
  const compile = (file: string) =>
    compileString(readFileSync(`src/styles/${file}`, "utf8")).css;
  const body = (css: string, selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return { start, text: css.slice(start, css.indexOf("}", start)) };
  };
  const crt = compile("crt.scss");
  // More specific than .CRTScreen[data-crt-samples="2"], so it always wins.
  expect(body(crt, "html[data-crt-curvature=off] .CRTScreen").text).toContain(
    "filter: none",
  );
  expect(
    body(crt, "html[data-crt-curvature=off] .CRTScreen [data-crt-hit]::before")
      .text,
  ).toContain("translate: none");
  // The scanlines and the edge falloff are not part of it.
  expect(crt).not.toMatch(/data-crt-curvature=off\][^{]*::after/);

  // Without the filter nothing resamples the 1 px dithers. The checkerboards
  // come after the even-average rules they replace.
  for (const [file, selector, property] of [
    ["windows.scss", ".WinDither", "background: var(--dither)"],
    ["windows.scss", ".Win98", "--win-dither: conic-gradient"],
    ["shutdown.scss", ".ShutdownDesktop", "background: var(--dither)"],
  ]) {
    const css = compile(file);
    const flat = body(
      css,
      `html[data-crt-curvature=off] .CRTScreen ${selector}`,
    );
    expect(flat.text).toContain(property);
    expect(flat.start).toBeGreaterThan(
      css.lastIndexOf(`html:not([data-crt=off]) .CRTScreen ${selector} {`),
    );
  }
});
