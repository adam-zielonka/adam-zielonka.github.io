import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import { pressPairs } from "./shared";

/**
 * Windows 98 list views: the desktop icons, Explorer's file pane and Find's
 * results. Each list is one Tab stop (a roving tabindex) with a single
 * selection. Classic activation: a mouse click selects, a double-click or
 * Enter opens; a touch or pen tap opens at once, as there is no hover.
 *
 * Behaviour is delegated from the desktop, so lists can be re-rendered
 * freely: a container carries data-listview, its items data-list-item and
 * the data-win-action they open.
 */
export type ListViewMode = "large" | "small" | "list" | "details";

export const LIST_VIEW = "[data-listview]";
export const LIST_ITEM = "[data-list-item]";
/** Fired on a list (bubbling) when its selection changes; detail.item. */
export const LIST_SELECT = "win98-listselect";
/** Typed letters within this many milliseconds extend the search. */
export const TYPE_AHEAD_DELAY = 500;

export type ListSelectEvent = CustomEvent<{ item?: HTMLElement }>;

/**
 * An icon-and-label list item; the list's markup sets the Tab stop. tip is
 * its tooltip (a project's summary); iconSize is 16 in small-icon views.
 */
export function listItem(
  action: string,
  label: string,
  icon: string,
  {
    tip,
    extra = "",
    iconSize = 32,
  }: { tip?: string; extra?: string; iconSize?: 16 | 32 } = {},
) {
  return `<button type="button" class="WinShortcut" role="option" aria-selected="false" tabindex="-1" data-list-item data-win-action="${escape(action)}" data-name="${escape(label)}"${tip ? ` data-tip="${escape(tip)}"` : ""}>${windowsIcon(icon, iconSize)}<span>${escape(label)}</span>${extra}</button>`;
}

/** A Details column; className sizes its <col>. */
export type DetailsColumn = { key: string; label: string; className: string };
/** A Details row: the first cell is the icon and name, then one per column. */
export type DetailsRow = {
  action: string;
  name: string;
  icon: string;
  /** The row's tooltip. */
  tip?: string;
  cells: string[];
};
export type DetailsSort = { key: string; descending: boolean };

/**
 * Details: a grid whose raised column headers sort, one row per item. The
 * header row is one Tab stop: the focused header, or else the first.
 */
export function detailsMarkup({
  label,
  className = "",
  columns,
  rows,
  sort,
  focused,
}: {
  label: string;
  className?: string;
  columns: DetailsColumn[];
  rows: DetailsRow[];
  sort?: DetailsSort;
  /** The header that keeps the keyboard across a re-render. */
  focused?: string;
}) {
  const headers = columns
    .map((column, index) => {
      const sorted =
        sort?.key === column.key
          ? ` aria-sort="${sort.descending ? "descending" : "ascending"}"`
          : "";
      const stop = focused ? focused === column.key : !index;
      return `<th scope="col"${sorted}><button type="button" class="WinColumnHeader" data-sort="${escape(column.key)}" tabindex="${stop ? 0 : -1}">${escape(column.label)}</button></th>`;
    })
    .join("");
  const body = rows
    .map(
      row =>
        `<tr data-list-item data-win-action="${escape(row.action)}" data-name="${escape(row.name)}" aria-selected="false" tabindex="-1"${row.tip ? ` data-tip="${escape(row.tip)}"` : ""}><td><span class="WinDetailsName">${windowsIcon(row.icon, 16)}<span>${escape(row.name)}</span></span></td>${row.cells.map(cell => `<td>${escape(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table class="${["WinDetails", className].filter(Boolean).join(" ")}" role="grid" aria-label="${escape(label)}" aria-readonly="true" data-listview><colgroup>${columns.map(column => `<col class="${column.className}">`).join("")}</colgroup><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
}

/** The next sort after a click on a column: a second click reverses. */
export const nextSort = (
  sort: DetailsSort | undefined,
  key: string,
): DetailsSort =>
  sort?.key === key
    ? { key, descending: !sort.descending }
    : { key, descending: false };

/**
 * Column headers inside scope: a click sorts (onSort), and the header row
 * is one Tab stop where Left/Right/Home/End move and Down enters the rows.
 */
export function bindDetailsHeaders(
  scope: HTMLElement,
  { signal, onSort }: { signal: AbortSignal; onSort: (key: string) => void },
) {
  scope.addEventListener(
    "click",
    event => {
      const header = (event.target as Element).closest<HTMLElement>(
        "[data-sort]",
      );
      if (header) onSort(header.dataset.sort!);
    },
    { signal },
  );
  scope.addEventListener(
    "keydown",
    event => {
      const header = (event.target as Element).closest<HTMLElement>(
        "[data-sort]",
      );
      if (!header || event.altKey || event.ctrlKey || event.metaKey) return;
      const headers = [...scope.querySelectorAll<HTMLElement>("[data-sort]")];
      const index = headers.indexOf(header);
      const next =
        event.key === "ArrowRight"
          ? headers[Math.min(index + 1, headers.length - 1)]
          : event.key === "ArrowLeft"
            ? headers[Math.max(index - 1, 0)]
            : event.key === "Home"
              ? headers[0]
              : event.key === "End"
                ? headers.at(-1)
                : undefined;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const list = header.closest<HTMLElement>(LIST_VIEW);
        if (list) focusList(list);
      } else if (next) {
        event.preventDefault();
        for (const each of headers) each.tabIndex = each === next ? 0 : -1;
        next.focus({ preventScroll: true });
      }
    },
    { signal },
  );
}

export const listItems = (list: Element) => [
  ...list.querySelectorAll<HTMLElement>(LIST_ITEM),
];

export const selectedItem = (list: Element) =>
  list.querySelector<HTMLElement>(`${LIST_ITEM}[aria-selected="true"]`) ??
  undefined;

const itemName = (item: HTMLElement) =>
  (item.dataset.name ?? item.textContent ?? "").trim().toLowerCase();

/** Makes item (or the selection, or else the first item) the Tab stop. */
function setTabStop(list: HTMLElement, item?: HTMLElement) {
  const items = listItems(list);
  const stop =
    (item && items.includes(item) ? item : undefined) ??
    selectedItem(list) ??
    items[0];
  for (const each of items) each.tabIndex = each === stop ? 0 : -1;
  // An empty list is a Tab stop itself, so the pane can still take focus.
  if (items.length) list.removeAttribute("tabindex");
  else list.tabIndex = 0;
}

/** Call after rendering a list: every item gets aria-selected and the Tab stop is set. */
export function initListView(list: HTMLElement) {
  for (const item of listItems(list))
    if (!item.hasAttribute("aria-selected"))
      item.setAttribute("aria-selected", "false");
  setTabStop(list);
}

/** The element Tab reaches in a list: its roving item, or the empty list. */
export const tabStop = (list: HTMLElement) =>
  list.querySelector<HTMLElement>(`${LIST_ITEM}[tabindex="0"]`) ?? list;

/** Gives the list the keyboard at its Tab stop, scrolled into view. */
export function focusList(list: HTMLElement) {
  const stop = tabStop(list);
  stop.focus({ preventScroll: true });
  if (stop !== list) reveal(list, stop);
}

/** Keeps item visible inside the list's scroller without moving the desktop. */
function reveal(list: HTMLElement, item: HTMLElement) {
  const scroller = list.closest<HTMLElement>("[data-list-scroll]") ?? list;
  const box = scroller.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  if (!box.height || !scroller.offsetHeight) return;
  // The CRT may scale the desktop; scroll offsets are in unscaled pixels.
  const scale = box.height / scroller.offsetHeight || 1;
  const header = list.querySelector("thead")?.getBoundingClientRect().height;
  const top = box.top + (header ?? 0);
  // An item taller than the view (a short screen) shows its top.
  if (rect.top < top || rect.height > box.bottom - top)
    scroller.scrollTop -= (top - rect.top) / scale;
  else if (rect.bottom > box.bottom)
    scroller.scrollTop += (rect.bottom - box.bottom) / scale;
  if (rect.left < box.left)
    scroller.scrollLeft -= (box.left - rect.left) / scale;
  else if (rect.right > box.right)
    scroller.scrollLeft += (rect.right - box.right) / scale;
}

/**
 * Selects one item (or none) in a list and notifies listeners when the
 * selection changes. focus also moves the keyboard to the item.
 */
export function selectItem(
  list: HTMLElement,
  item: HTMLElement | undefined,
  { focus = false, notify = true }: { focus?: boolean; notify?: boolean } = {},
) {
  const previous = selectedItem(list);
  for (const each of listItems(list))
    each.setAttribute("aria-selected", String(each === item));
  const focused =
    document.activeElement instanceof HTMLElement &&
    document.activeElement.matches(LIST_ITEM) &&
    list.contains(document.activeElement)
      ? document.activeElement
      : undefined;
  setTabStop(list, item ?? focused);
  if (item && focus) {
    item.focus({ preventScroll: true });
    reveal(list, item);
  }
  if (notify && previous !== item)
    list.dispatchEvent(
      new CustomEvent(LIST_SELECT, { bubbles: true, detail: { item } }),
    );
}

type Box = { item: HTMLElement; x: number; y: number; w: number; h: number };
const measure = (item: HTMLElement): Box => ({
  item,
  x: item.offsetLeft,
  y: item.offsetTop,
  w: item.offsetWidth,
  h: item.offsetHeight,
});

/**
 * The item an arrow key reaches, following the visual grid. Along the
 * list's flow (down a column, or across a row) the ends continue with the
 * next or previous item; across it they stop. Without layout (no sizes),
 * the list is one sequence.
 */
function neighbour(
  list: HTMLElement,
  items: HTMLElement[],
  current: HTMLElement,
  key: string,
) {
  const index = items.indexOf(current);
  const boxes = items.map(measure);
  const me = boxes[index];
  const forward = key === "ArrowDown" || key === "ArrowRight";
  const sequence = () =>
    items[Math.max(0, Math.min(items.length - 1, index + (forward ? 1 : -1)))];
  if (boxes.every(box => box.x === me.x && box.y === me.y)) return sequence();
  const vertical = key === "ArrowDown" || key === "ArrowUp";
  const sameColumn = (box: Box) =>
    Math.abs(box.x - me.x) < Math.max(1, me.w / 2);
  const sameRow = (box: Box) => Math.abs(box.y - me.y) < Math.max(1, me.h / 2);
  const candidates = boxes.filter(box =>
    vertical
      ? sameColumn(box) && (forward ? box.y > me.y + 1 : box.y < me.y - 1)
      : sameRow(box) && (forward ? box.x > me.x + 1 : box.x < me.x - 1),
  );
  const distance = (box: Box) =>
    vertical ? Math.abs(box.y - me.y) : Math.abs(box.x - me.x);
  const nearest = candidates.sort((a, b) => distance(a) - distance(b))[0];
  if (nearest) return nearest.item;
  const columnFlow = list.dataset.flow === "column";
  return vertical === columnFlow ? sequence() : current;
}

/** PageUp/PageDown: about one screen up or down the current column. */
function pageTarget(
  list: HTMLElement,
  items: HTMLElement[],
  current: HTMLElement,
  down: boolean,
) {
  const me = measure(current);
  const column = items
    .map(measure)
    .filter(box => Math.abs(box.x - me.x) < Math.max(1, me.w / 2))
    .sort((a, b) => a.y - b.y);
  if (column.length <= 1)
    return down ? (items.at(-1) ?? current) : (items[0] ?? current);
  const scroller = list.closest<HTMLElement>("[data-list-scroll]") ?? list;
  const page = Math.max(me.h, scroller.clientHeight - me.h);
  const limit = down ? me.y + page : me.y - page;
  const reachable = column.filter(box =>
    down ? box.y > me.y && box.y <= limit : box.y < me.y && box.y >= limit,
  );
  const target = down ? reachable.at(-1) : reachable[0];
  return (target ?? (down ? column.at(-1) : column[0]))!.item;
}

/**
 * Wires every list view inside root. onOpen runs an item's action: after a
 * double-click, Enter, a tap, or a click without a pointer (assistive
 * technology, or element.click()).
 */
export function createListViews({
  root,
  signal,
  onOpen,
}: {
  root: HTMLElement;
  signal: AbortSignal;
  onOpen: (item: HTMLElement) => void;
}) {
  /** The last press on an item, to tell mouse clicks from taps. */
  let press: { item: HTMLElement; type: string } | undefined;
  const typed = new WeakMap<HTMLElement, { text: string; time: number }>();
  const listOf = (node: EventTarget | null) =>
    node instanceof Element
      ? (node.closest<HTMLElement>(LIST_VIEW) ?? undefined)
      : undefined;
  const itemOf = (node: EventTarget | null) =>
    node instanceof Element
      ? (node.closest<HTMLElement>(LIST_ITEM) ?? undefined)
      : undefined;
  // What opens takes the keyboard (a window, or Explorer's new pane).
  function open(list: HTMLElement, item: HTMLElement) {
    selectItem(list, item);
    onOpen(item);
  }

  root.addEventListener(
    "pointerdown",
    event => {
      const list = listOf(event.target);
      const item = itemOf(event.target);
      press = item && list ? { item, type: event.pointerType } : undefined;
      if (!list || (event.target as Element).closest("thead")) return;
      // Clicking empty space clears the selection.
      if (!item) selectItem(list, undefined);
      // The mouse selects on press, like Windows (right presses too, so a
      // context menu acts on the item). Touch selects on its tap, so a
      // scroll that starts on an item changes nothing.
      else if (
        event.pointerType === "mouse" &&
        (event.button === 0 || event.button === 2)
      )
        selectItem(list, item);
    },
    { signal },
  );
  // The desktop's command handler leaves list items to this one.
  root.addEventListener(
    "click",
    event => {
      const item = itemOf(event.target);
      const list = item && listOf(item);
      if (!item || !list) return;
      event.preventDefault();
      // The second click of a double-click is the dblclick's business, and
      // must never open what a navigation just put under the pointer.
      if (event.detail > 1) return;
      // detail 0: a click without a pointer (assistive technology, or
      // element.click()) activates, like Enter.
      const type =
        event.detail === 0
          ? ""
          : press?.item === item
            ? press.type
            : event instanceof PointerEvent
              ? event.pointerType
              : "";
      if (type === "mouse") selectItem(list, item, { focus: true });
      else open(list, item);
    },
    { capture: true, signal },
  );
  const pairs = pressPairs(root, signal);
  root.addEventListener(
    "dblclick",
    event => {
      const item = itemOf(event.target);
      const list = item && listOf(item);
      // Taps have opened already; a double-tap must not open twice.
      if (!item || !list || press?.item !== item || press.type !== "mouse")
        return;
      // Both clicks must press this item: the first may have hit a menu
      // item or a button that has gone, uncovering this one.
      if (!pairs.same(itemOf)) return;
      if (item.getAttribute("aria-selected") === "true") open(list, item);
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    event => {
      const item = itemOf(event.target);
      const list = item && listOf(item);
      if (item && list) setTabStop(list, item);
    },
    { signal },
  );
  root.addEventListener(
    "keydown",
    event => {
      const list = listOf(event.target);
      if (!list || event.defaultPrevented) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      const current = target.matches(LIST_ITEM) ? target : undefined;
      if (!current && target !== list) return;
      const items = listItems(list);
      if (!items.length) return;
      let next: HTMLElement | undefined;
      const now = Date.now();
      const state = typed.get(list);
      const search =
        state && now - state.time < TYPE_AHEAD_DELAY ? state.text : "";
      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp":
        case "ArrowLeft":
        case "ArrowRight":
          next = current
            ? neighbour(list, items, current, event.key)
            : items[0];
          break;
        case "Home":
          next = items[0];
          break;
        case "End":
          next = items.at(-1);
          break;
        case "PageDown":
        case "PageUp":
          next = current
            ? pageTarget(list, items, current, event.key === "PageDown")
            : items[0];
          break;
        case "Enter":
          if (!current) return;
          event.preventDefault();
          open(list, current);
          return;
        default: {
          // Space extends a search in progress; otherwise it selects.
          if (event.key === " " && !search) {
            if (!current) return;
            event.preventDefault();
            selectItem(list, current);
            return;
          }
          if (event.key.length !== 1) return;
          const text = search + event.key.toLowerCase();
          typed.set(list, { text, time: now });
          // Repeating one letter cycles through the names it starts.
          const cycling = [...text].every(char => char === text[0]);
          const prefix = cycling ? text[0] : text;
          const start = current ? items.indexOf(current) : -1;
          const skip = text.length === 1 || cycling ? 1 : 0;
          for (let offset = 0; offset < items.length; offset++) {
            const item =
              items[(start + skip + offset + items.length) % items.length];
            if (itemName(item).startsWith(prefix)) {
              next = item;
              break;
            }
          }
          event.preventDefault();
          if (!next) return;
        }
      }
      if (!next) return;
      event.preventDefault();
      selectItem(list, next, { focus: true });
    },
    { signal },
  );
  // A button would click on Space's release; Space only selects here.
  root.addEventListener(
    "keyup",
    event => {
      if (event.key === " " && itemOf(event.target) && listOf(event.target))
        event.preventDefault();
    },
    { signal },
  );
}
