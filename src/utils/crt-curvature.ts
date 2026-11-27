// Drives the SVG curvature filters in index.html for the current screen size,
// video mode and device pixel ratio, and keeps small edge controls clickable
// where they are drawn. Pure helpers are exported for tests.

export type VideoMode = "text" | "graphics";

export interface Amplitude {
  /** Horizontal bow at the corners, in CSS px. */
  ax: number;
  /** Vertical bow at the corners, in CSS px. */
  ay: number;
}

export interface SampleOffset {
  /** Offset in device px. */
  ox: number;
  oy: number;
}

export interface FilterParams {
  scale: number;
  slopeR: number;
  slopeG: number;
  intercepts: { interceptR: number; interceptG: number }[];
}

/**
 * Four subpixel phases averaged by #crt-curvature. At DPR 1 they reproduce the
 * original static intercepts (±0.375 and ±0.125 px).
 */
export const FOUR_SAMPLES: readonly SampleOffset[] = [
  { ox: -0.375, oy: -0.125 },
  { ox: -0.125, oy: 0.375 },
  { ox: 0.125, oy: -0.375 },
  { ox: 0.375, oy: 0.125 },
];
/** Two diagonal phases averaged by #crt-curvature-2 on dense displays. */
export const TWO_SAMPLES: readonly SampleOffset[] = [
  { ox: -0.25, oy: -0.25 },
  { ox: 0.25, oy: 0.25 },
];

const GRAPHICS_SELECTOR =
  ".Win98, .Experience--windows-startup, .Experience--shutdown-animation";
const STORAGE_KEY = "portfolio-crt";

/** Like a real monitor, the geometry is stored per video mode. */
export function videoModeOf(screen: Element): VideoMode {
  for (const child of screen.children)
    if (child.matches(GRAPHICS_SELECTOR)) return "graphics";
  return "text";
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * The bow scales with the picture. Horizontal displacement follows the height
 * and vertical displacement follows the width, so both edges bow by the same
 * share of their length, as a tube's sagitta does. Graphics modes keep a
 * smaller cap, so controls in the corners, such as a maximized window's
 * Close button, are drawn within about 3 px of where they are clicked.
 */
export function bendAmplitude(
  width: number,
  height: number,
  mode: VideoMode,
): Amplitude {
  const cap = mode === "graphics" ? 3.5 : 8;
  return {
    ax: clamp(0.008 * height, 2, cap),
    ay: clamp(0.008 * width, 2, cap),
  };
}

/**
 * feDisplacementMap uses one scale for both channels, so the per-axis bow is
 * set with the feFunc slopes. Each sample offset is given in device px; the
 * browser multiplies the scale by the device pixel ratio, so the offset is
 * divided by it to keep the undistorted centre sharp.
 */
export function filterParams(
  ax: number,
  ay: number,
  dpr: number,
  samples: readonly SampleOffset[] = FOUR_SAMPLES,
): FilterParams {
  const max = Math.max(ax, ay);
  const scale = 2 * max;
  const slopeR = ax / max;
  const slopeG = ay / max;
  return {
    scale,
    slopeR,
    slopeG,
    intercepts: samples.map(({ ox, oy }) => ({
      interceptR: 0.5 * (1 - slopeR) + ox / (scale * dpr),
      interceptG: 0.5 * (1 - slopeG) + oy / (scale * dpr),
    })),
  };
}

/**
 * Where the filter draws content: content at layout point (x, y) appears at
 * about (x, y) + visualOffset. Corners move toward the centre.
 */
export function visualOffset(
  x: number,
  y: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  ax: number,
  ay: number,
): { dx: number; dy: number } {
  const nx = ((x - rect.left) / rect.width) * 2 - 1;
  const ny = ((y - rect.top) / rect.height) * 2 - 1;
  return { dx: -ax * nx * ny * ny, dy: -ay * ny * nx * nx };
}

/** Scanlines snapped to whole device pixels, so fractional ratios do not beat. */
export function scanlines(
  mode: VideoMode,
  dpr: number,
): { period: number; line: number } {
  if (mode === "graphics")
    return { period: Math.max(1, Math.round(2 * dpr)) / dpr, line: 1 / dpr };
  return {
    period: Math.max(1, Math.round(3 * dpr)) / dpr,
    line: Math.max(1, Math.round(dpr)) / dpr,
  };
}

/**
 * WebKit safe mode: whether this engine is WebKit, which never gets the
 * curvature filter.
 *
 * WebKit renders a CSS reference filter such as url(#crt-curvature) in software,
 * into the filtered element's own layer. It leaves out every descendant that it
 * composites on a separate layer. These include each scrolling box, which
 * scrolls asynchronously on its own layer, and anything stacked over such a box.
 * Composited WebKitGTK draws that content flat, at its layout position, over a
 * bent frame. A report from Safari on macOS also showed the scrolled content of
 * Portfolio 98 Help and a narrow Explorer window spilling out of the window
 * with no scrollbars; that case could not be run locally, but it involves the
 * same filter over composited scrollers. Chromium and Firefox filter the
 * whole subtree.
 *
 * On WebKit the picture therefore stays flat. The scanlines, edge falloff and
 * glass remain, and Display effects turns only those on and off.
 *
 * WebKit engines include Safari on macOS, iPadOS and iOS. They include every
 * other browser on iPhone and iPad too: CriOS, FxiOS and EdgiOS run on WebKit.
 * They also include WebKitGTK and WPE browsers. Chromium-based browsers,
 * including Android WebViews, put Chrome/ or Chromium/ in their user agent.
 * Gecko browsers do not report AppleWebKit. index.html repeats this check so
 * that it applies from the first paint.
 */
export function isWebKit(userAgent: string): boolean {
  return /AppleWebKit\//.test(userAgent) && !/Chrom(e|ium)\//.test(userAgent);
}

/** More contrast or forced colours switch the effects off (crt.scss). */
export const CRT_HIGH_CONTRAST =
  "(prefers-contrast: more), (forced-colors: active)";

/**
 * Whether high contrast has switched the effects off, whatever the visitor
 * chose: settings then show them off and unavailable.
 */
export function crtEffectsForcedOff(): boolean {
  return !!window.matchMedia?.(CRT_HIGH_CONTRAST).matches;
}

/** Whether the visitor keeps the curvature, scanlines and edge falloff. */
export function getCrtEffects(): boolean {
  return document.documentElement.dataset.crt !== "off";
}

export function setCrtEffects(on: boolean) {
  document.documentElement.dataset.crt = on ? "on" : "off";
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage can be unavailable; the choice then lasts for this page.
  }
}

function storedCrtEffects(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
};

// Every attribute write re-runs the filter, so only changed values are written.
function setAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function setProperty(element: HTMLElement, name: string, value: string) {
  if (element.style.getPropertyValue(name) !== value)
    element.style.setProperty(name, value);
}

function applyFilter(
  filter: Element,
  params: FilterParams,
  samples: number,
): void {
  for (const map of filter.querySelectorAll("feDisplacementMap"))
    setAttribute(map, "scale", round(params.scale, 3));
  const transfers = filter.querySelectorAll("feComponentTransfer");
  params.intercepts.slice(0, samples).forEach((intercept, index) => {
    const transfer = transfers[index];
    if (!transfer) return;
    const channels = [
      ["feFuncR", params.slopeR, intercept.interceptR],
      ["feFuncG", params.slopeG, intercept.interceptG],
    ] as const;
    for (const [selector, slope, value] of channels) {
      const func = transfer.querySelector(selector);
      if (!func) continue;
      setAttribute(func, "type", "linear");
      setAttribute(func, "slope", round(slope, 6));
      setAttribute(func, "intercept", round(value, 6));
    }
  });
}

/**
 * Starts the controller and returns a disposer. Without it, the static values
 * in index.html remain a working default.
 */
export function initCrtCurvature(root: Document = document): () => void {
  if (!storedCrtEffects()) root.documentElement.dataset.crt = "off";
  const view = root.defaultView ?? window;
  // WebKit keeps a flat picture (see isWebKit): no filter and no hit offsets.
  const curvature = !isWebKit(view.navigator?.userAgent ?? "");
  if (!curvature)
    setAttribute(root.documentElement, "data-crt-curvature", "off");
  const screen = root.querySelector<HTMLElement>(".CRTScreen");
  if (!screen) return () => undefined;
  const fourSample = root.getElementById("crt-curvature");
  const twoSample = root.getElementById("crt-curvature-2");

  let frame = 0;
  let disposed = false;
  let amplitude: Amplitude | undefined;

  const updateHitTargets = () => {
    const targets = screen.querySelectorAll<HTMLElement>("[data-crt-hit]");
    if (!targets.length || !amplitude) return;
    const rect = screen.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    for (const target of targets) {
      if (target.offsetParent === null) continue;
      const box = target.getBoundingClientRect();
      const { dx, dy } = visualOffset(
        box.left + box.width / 2,
        box.top + box.height / 2,
        rect,
        amplitude.ax,
        amplitude.ay,
      );
      // Half-pixel steps avoid rewriting styles for tiny layout changes.
      setProperty(target, "--crt-dx", `${Math.round(dx * 2) / 2 || 0}px`);
      setProperty(target, "--crt-dy", `${Math.round(dy * 2) / 2 || 0}px`);
    }
  };

  const update = () => {
    const mode = videoModeOf(screen);
    const dpr = view.devicePixelRatio || 1;
    setAttribute(screen, "data-video-mode", mode);
    const scan = scanlines(mode, dpr);
    setProperty(screen, "--scan-period", `${round(scan.period, 4)}px`);
    setProperty(screen, "--scan-line", `${round(scan.line, 4)}px`);
    const twoSamples = curvature && dpr >= 2 && twoSample !== null;
    if (twoSamples) setAttribute(screen, "data-crt-samples", "2");
    else if (screen.hasAttribute("data-crt-samples"))
      screen.removeAttribute("data-crt-samples");

    const width = screen.offsetWidth;
    const height = screen.offsetHeight;
    if (curvature && width && height) {
      amplitude = bendAmplitude(width, height, mode);
      if (fourSample)
        applyFilter(
          fourSample,
          filterParams(amplitude.ax, amplitude.ay, dpr, FOUR_SAMPLES),
          FOUR_SAMPLES.length,
        );
      if (twoSample)
        applyFilter(
          twoSample,
          filterParams(amplitude.ax, amplitude.ay, dpr, TWO_SAMPLES),
          TWO_SAMPLES.length,
        );
    }
    updateHitTargets();
  };

  // Scrolling inside the screen only moves hit targets; everything else
  // re-runs the whole update.
  let onlyHitTargets = true;
  const run = () => {
    frame = 0;
    if (onlyHitTargets) updateHitTargets();
    else update();
    onlyHitTargets = true;
  };
  const request = () => {
    if (!frame && !disposed) frame = view.requestAnimationFrame(run);
  };
  const schedule = () => {
    onlyHitTargets = false;
    request();
  };

  const resizeObserver =
    typeof view.ResizeObserver === "function"
      ? new view.ResizeObserver(schedule)
      : undefined;
  resizeObserver?.observe(screen);

  // Video-mode changes come from direct children; hit targets also move when
  // windows are dragged, maximized, shown or hidden anywhere in the screen.
  const mutationObserver = new view.MutationObserver(schedule);
  mutationObserver.observe(screen, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "data-crt-hit"],
  });
  screen.addEventListener("pointerup", schedule);
  screen.addEventListener("transitionend", schedule);
  // Scroll events do not bubble, so they are caught on the way down.
  const scrollOptions = { capture: true, passive: true };
  screen.addEventListener("scroll", request, scrollOptions);

  // Fires when the window moves to another display and on browser zoom.
  let resolution: MediaQueryList | undefined;
  const watchResolution = () => {
    resolution?.removeEventListener("change", onResolutionChange);
    resolution = view.matchMedia?.(
      `(resolution: ${view.devicePixelRatio || 1}dppx)`,
    );
    resolution?.addEventListener("change", onResolutionChange);
  };
  function onResolutionChange() {
    watchResolution();
    schedule();
  }
  watchResolution();

  update();

  return () => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    resizeObserver?.disconnect();
    mutationObserver.disconnect();
    screen.removeEventListener("pointerup", schedule);
    screen.removeEventListener("transitionend", schedule);
    screen.removeEventListener("scroll", request, scrollOptions);
    resolution?.removeEventListener("change", onResolutionChange);
  };
}
