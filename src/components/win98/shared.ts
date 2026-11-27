import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import type { Project } from "../../types/project";

export type Folder = "projects" | "games" | "apps" | "tools" | "lab";

export const folders: {
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
    icon: "experiments",
    categories: ["Experiment", "Learning"],
  },
];

/**
 * Caption-button glyphs: original 1-bit pixel art placed on the 16 x 14
 * button, drawn in the button's text colour (grey and embossed when
 * disabled). Larger touch buttons centre the same 16 x 14 box.
 */
const CAPTION_GLYPHS = {
  // A 6 x 2 bar near the bottom.
  minimize: "M4 9h6v2H4z",
  // A 9 x 9 box with a 2 px top edge.
  maximize: "M3 2h9v9H3zM4 4v6h7V4z",
  // Two overlapping boxes with 2 px top edges, the front one lower left.
  restore:
    "M5 2h6v2H5zM5 4h1v1H5zM10 4h1v4h-1zM9 7h1v1H9zM3 5h6v6H3zM4 7v3h4V7z",
  // An 8 x 7 cross of 2 px diagonals.
  close:
    "M4 3h2v1H4zM10 3h2v1h-2zM5 4h2v1H5zM9 4h2v1H9zM6 5h4v1H6zM7 6h2v1H7zM6 7h4v1H6zM5 8h2v1H5zM9 8h2v1H9zM4 9h2v1H4zM10 9h2v1h-2z",
} as const;
export type CaptionGlyph = keyof typeof CAPTION_GLYPHS;

export const captionGlyph = (glyph: CaptionGlyph) =>
  `<svg class="WinCaptionGlyph" width="16" height="14" viewBox="0 0 16 14" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${CAPTION_GLYPHS[glyph]}"/></svg>`;

/** A delegated desktop command button; the click handler reads data-win-action. */
export const button = (
  action: string,
  label: string,
  icon?: string,
  className = "",
) =>
  `<button type="button" class="${className}" data-win-action="${escape(action)}">${icon ? windowsIcon(icon) : ""}<span>${escape(label)}</span></button>`;

export const link = (url: string, label: string) =>
  `<a class="WinButton" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;

/** Requests one callback per animation frame, keeping only the latest work. */
export function frameScheduler() {
  let frame: number | undefined;
  let work: (() => void) | undefined;
  return {
    schedule(next: () => void) {
      work = next;
      frame ??= requestAnimationFrame(() => {
        frame = undefined;
        const run = work;
        work = undefined;
        run?.();
      });
    },
    /** Runs pending work now, e.g. on pointer release. */
    flush() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      const run = work;
      work = undefined;
      run?.();
    },
    cancel() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      work = undefined;
    },
  };
}

/**
 * Remembers what the last two primary-button presses inside root hit, so a
 * dblclick handler can check that both clicks of the pair pressed the same
 * thing. Browsers pair clicks by place and time only: the first click may
 * have hit a control that is gone by the second (a menu item, a Close
 * button), and the double-click must not act on what lay beneath it.
 */
export function pressPairs(root: HTMLElement, signal: AbortSignal) {
  let previous: Element | undefined;
  let latest: Element | undefined;
  root.addEventListener(
    "pointerdown",
    event => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      previous = latest;
      latest = event.target;
    },
    { capture: true, signal },
  );
  return {
    /**
     * Both presses of the double-click that just ended resolve to the same
     * element (for example their list item or title bar).
     */
    same(resolve: (target: Element) => Element | null | undefined) {
      if (!previous || !latest) return false;
      const first = resolve(previous);
      return !!first && first === resolve(latest);
    },
  };
}

/**
 * Arrow keys, Home and End move between a toolbar's visible buttons; Tab
 * enters and leaves the toolbar at one stop, which follows the keyboard.
 */
export function rovingToolbar(toolbar: HTMLElement, signal: AbortSignal) {
  toolbar.addEventListener(
    "keydown",
    event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const buttons = [
        ...toolbar.querySelectorAll<HTMLButtonElement>(":scope > button"),
      ].filter(button => getComputedStyle(button).display !== "none");
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      const last = buttons.length - 1;
      const next =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? index === last
            ? 0
            : index + 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? index === 0
              ? last
              : index - 1
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? last
                : -1;
      if (next < 0) return;
      event.preventDefault();
      buttons[next].focus();
    },
    { signal },
  );
  // The Tab stop moves with the keyboard, so Tab and Shift+Tab leave the
  // toolbar from wherever the arrows went.
  toolbar.addEventListener(
    "focusin",
    event => {
      const target = event.target;
      if (
        !(target instanceof HTMLButtonElement) ||
        target.parentElement !== toolbar
      )
        return;
      for (const button of toolbar.querySelectorAll<HTMLButtonElement>(
        ":scope > button",
      ))
        button.tabIndex = button === target ? 0 : -1;
    },
    { signal },
  );
}
