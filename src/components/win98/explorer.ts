import { projects } from "../../data/projects";
import { windowsIcon, windowsToolIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import type { Project } from "../../types/project";
import {
  bindDetailsHeaders,
  detailsMarkup,
  focusList,
  initListView,
  LIST_ITEM,
  LIST_SELECT,
  listItem,
  listItems,
  nextSort,
  selectItem,
  selectedItem,
  tabStop,
  type DetailsColumn,
  type ListViewMode,
} from "./list-view";
import {
  menuBar,
  openMenu,
  type MenuBarMenu,
  type MenuEntry,
  type MenuHandle,
} from "./menu";
import { messageBox } from "./message-box";
import { propertySheet } from "./properties";
import { folders, rovingToolbar, type Folder } from "./shared";
import type { DesktopWindow, WindowManager } from "./window-manager";

/** Where the Explorer window can be: My Computer, Recycle Bin or a folder. */
export type ExplorerLocation = "computer" | "recycle" | `folder:${Folder}`;

export const EXPLORER_VIEWS: { id: ListViewMode; label: string }[] = [
  { id: "large", label: "Lar&ge Icons" },
  { id: "small", label: "S&mall Icons" },
  { id: "list", label: "&List" },
  { id: "details", label: "&Details" },
];

type SortKey = "name" | "type" | "stack" | "demo";
const COLUMNS: (DetailsColumn & { key: SortKey })[] = [
  { key: "name", label: "Name", className: "WinColName" },
  { key: "type", label: "Type", className: "WinColType" },
  { key: "stack", label: "Technologies", className: "WinColStack" },
  { key: "demo", label: "Demo", className: "WinColDemo" },
];

/** One item of a location: a drive, a folder or a project. */
type Entry = {
  action: string;
  name: string;
  icon: string;
  type: string;
  stack: string;
  demo: string;
  kind: "drive" | "folder" | "project";
  project?: Project;
  /** Projects inside a drive or folder. */
  count?: number;
};

type ExplorerState = {
  win: DesktopWindow;
  location: ExplorerLocation;
  back: ExplorerLocation[];
  forward: ExplorerLocation[];
  sort?: { key: SortKey; descending: boolean };
  toolbars: boolean;
  statusBar: boolean;
  webView: boolean;
  /** The selected item's action, kept across view changes. */
  selected?: string;
  entries: Map<string, Entry>;
  rebar: HTMLElement;
  toolButtons: Record<"back" | "forward" | "up", HTMLButtonElement>;
  address: HTMLInputElement;
  addressIcon: HTMLElement;
  panel: HTMLElement;
  pane: HTMLElement;
  count: HTMLElement;
  summary: HTMLElement;
  kind: HTMLElement;
  zone: HTMLElement;
  popup?: MenuHandle;
};

/** Menu labels use '&' for mnemonics; names keep their literal ampersands. */
const literal = (text: string) => text.replaceAll("&", "&&");

const objects = (count: number) => `${count} object(s)`;

export function projectsIn(id: Folder) {
  const folder = folders.find(item => item.id === id)!;
  return projects.filter(
    project =>
      !folder.categories.length || folder.categories.includes(project.category),
  );
}

/** Caption, icon, address and parent of a location. */
export function locationInfo(location: ExplorerLocation): {
  name: string;
  icon: string;
  address: string;
  zone: string;
  zoneIcon: string;
  parent?: ExplorerLocation;
} {
  if (location === "computer")
    return {
      name: "My Computer",
      icon: "computer",
      address: "My Computer",
      zone: "My Computer",
      zoneIcon: "computer",
    };
  if (location === "recycle")
    return {
      name: "Recycle Bin",
      icon: "recycle",
      address: "Recycle Bin",
      zone: "My Computer",
      zoneIcon: "computer",
    };
  const id = location.slice(7) as Folder;
  const folder = folders.find(item => item.id === id)!;
  return {
    name: folder.name,
    icon: folder.icon,
    address:
      id === "projects" ? "C:\\Portfolio" : `C:\\Portfolio\\${folder.name}`,
    zone: "Portfolio (C:)",
    zoneIcon: "drive",
    parent: id === "projects" ? "computer" : "folder:projects",
  };
}

/** A location's items in catalog order: folders first, then projects. */
function entries(location: ExplorerLocation): Entry[] {
  if (location === "recycle") return [];
  if (location === "computer")
    return [
      {
        action: "folder:projects",
        name: "Portfolio (C:)",
        icon: "drive",
        type: "Local Disk",
        stack: "",
        demo: "",
        kind: "drive",
        count: projects.length,
      },
    ];
  const id = location.slice(7) as Folder;
  const subfolders = id === "projects" ? folders.slice(1) : [];
  return [
    ...subfolders.map((folder): Entry => ({
      action: `folder:${folder.id}`,
      name: folder.name,
      icon: "folder",
      type: "File Folder",
      stack: "",
      demo: "",
      kind: "folder",
      count: projectsIn(folder.id).length,
    })),
    ...projectsIn(id).map((project): Entry => ({
      action: `project:${project.id}`,
      name: project.name,
      icon: project.id,
      type: project.category,
      stack: project.stack.join(", "),
      demo: project.demo ? "Yes" : "No",
      kind: "project",
      project,
    })),
  ];
}

/** Folders always come first; within each group the chosen column decides. */
function sorted(list: Entry[], sort: ExplorerState["sort"]) {
  if (!sort) return list;
  const value = (entry: Entry) =>
    sort.key === "name"
      ? entry.name
      : sort.key === "type"
        ? entry.type
        : sort.key === "stack"
          ? entry.stack
          : entry.demo;
  const group = (entry: Entry) => (entry.kind === "project" ? 1 : 0);
  return [...list].sort(
    (a, b) =>
      group(a) - group(b) ||
      value(a).localeCompare(value(b), undefined, { sensitivity: "base" }) *
        (sort.descending ? -1 : 1) ||
      a.name.localeCompare(b.name),
  );
}

const toolButton = (command: string, label: string, icon = command) =>
  `<button type="button" class="WinToolButton" data-explorer="${command}" tabindex="-1">${windowsToolIcon(icon)}<span class="WinToolLabel">${label}</span></button>`;

const webLink = (action: string, label: string) =>
  `<button type="button" class="WinWebLink" data-win-action="${escape(action)}">${escape(label)}</button>`;

/** Bar colours for the projects-per-folder chart in My Computer. */
const DISK_COLORS = ["#000080", "#008080", "#808000", "#800080"];

/** The Web View's description of the selected item. */
function describe(location: ExplorerLocation, entry?: Entry) {
  if (location === "recycle")
    return `<p>No projects have been deleted.</p><p>No projects were harmed in the making of this portfolio.</p><p><button type="button" class="WinButton" disabled>Empty Recycle Bin</button></p>`;
  if (!entry) return `<p>Select an item to view its description.</p>`;
  const title = `<p><b>${escape(entry.name)}</b><br>${escape(entry.type)}</p>`;
  const open = `<p class="WinWebViewActions">${webLink(entry.action, "Open")}</p>`;
  if (entry.kind === "drive") {
    const parts = folders.slice(1).map((folder, index) => ({
      name: folder.name,
      count: projectsIn(folder.id).length,
      color: DISK_COLORS[index % DISK_COLORS.length],
    }));
    return `${title}<p>${entry.count} projects in ${parts.length} folders</p><div class="WinDiskBar" aria-hidden="true">${parts.map(part => `<span style="flex-grow: ${part.count}; background: ${part.color}"></span>`).join("")}</div><ul class="WinDiskLegend">${parts.map(part => `<li><span style="background: ${part.color}"></span>${escape(part.name)}: ${part.count}</li>`).join("")}</ul>${open}`;
  }
  if (entry.kind === "folder")
    return `${title}<p>${entry.count} project(s)</p>${open}`;
  const project = entry.project!;
  return `<p><b>${escape(project.name)}</b><br>Type: ${escape(project.category)}</p><p>${escape(project.summary)}</p><div class="WinTags">${project.stack.map(item => `<span>${escape(item)}</span>`).join("")}</div><p>Browser demo: ${project.demo ? "Yes" : "No"}</p><p class="WinWebViewActions">${webLink(entry.action, "Open")} <a class="WinWebLink" href="${escape(project.source)}" target="_blank" rel="noopener noreferrer">Source code<span aria-hidden="true"> ↗</span><span class="VisuallyHidden"> (opens in a new tab)</span></a></p>`;
}

/** Help ▸ About Portfolio 98, shared by Explorer and Find. */
export function aboutPortfolio98() {
  void messageBox({
    title: "About Portfolio 98",
    icon: "computer",
    body: `Portfolio 98\nA desktop of personal projects by Adam Zielonka.\n${projects.length} projects in ${folders.length - 1} folders.`,
  });
}

/** Properties of the place Explorer shows (its pane's shortcut menu). */
function locationProperties(location: ExplorerLocation) {
  const info = locationInfo(location);
  const items = entries(location);
  const folderCount = items.filter(entry => entry.kind !== "project").length;
  const projectCount = items.filter(entry => entry.kind === "project").length;
  void propertySheet({
    name: info.name,
    icon: info.icon,
    rows: [
      [
        "Type:",
        location === "computer" || location === "recycle"
          ? "System Folder"
          : "File Folder",
      ],
      [
        "Location:",
        location === "folder:projects"
          ? "Portfolio (C:)"
          : info.parent
            ? locationInfo(info.parent).address
            : "Desktop",
      ],
      [
        "Contains:",
        location === "computer"
          ? "1 drive"
          : `${projectCount} project(s), ${folderCount} folder(s)`,
      ],
    ],
  });
}

/** Plain hyperlinks to nearby places, as Web View panels had. */
function seeAlso(location: ExplorerLocation) {
  const places: [string, string][] =
    location === "computer"
      ? [
          ["folder:projects", "My Projects"],
          ["recycle", "Recycle Bin"],
        ]
      : location === "recycle"
        ? [
            ["computer", "My Computer"],
            ["folder:projects", "My Projects"],
          ]
        : folders
            .filter(folder => `folder:${folder.id}` !== location)
            .map(folder => [`folder:${folder.id}`, folder.name]);
  return `<nav class="WinSeeAlso" aria-label="See also"><p>See also:</p><ul>${places.map(([action, label]) => `<li>${webLink(action, label)}</li>`).join("")}</ul></nav>`;
}

/**
 * The Explorer window: one reused window with a menu bar, Standard Buttons,
 * an Address band, a Web View panel, a file pane in four views, a status bar
 * with panes, and per-window Back/Forward history.
 */
export function createExplorer({
  wm,
  signal,
  open: openItem,
}: {
  wm: WindowManager;
  signal: AbortSignal;
  /** Runs a list item's action (its data-win-action). */
  open: (item: HTMLElement) => void;
}) {
  const states = new WeakMap<DesktopWindow, ExplorerState>();
  let explorerCount = 0;

  const listOf = (state: ExplorerState) =>
    state.pane.querySelector<HTMLElement>("[data-listview]")!;

  function setDisabled(button: HTMLElement, disabled: boolean) {
    if (disabled) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
  }

  /** Updates the Web View description and the status panes. */
  function updateSelection(state: ExplorerState) {
    const item = selectedItem(listOf(state));
    const entry = item ? state.entries.get(item.dataset.winAction!) : undefined;
    state.selected = entry?.action;
    const info = state.panel.querySelector<HTMLElement>(".WinWebViewInfo");
    const markup = describe(state.location, entry);
    if (info && info.innerHTML !== markup) info.innerHTML = markup;
    state.count.textContent = entry
      ? "1 object(s) selected"
      : objects(state.entries.size);
    state.summary.textContent = entry?.project?.summary ?? entry?.type ?? "";
    state.kind.textContent = entry
      ? entry.project?.demo
        ? `${entry.type} · Browser demo`
        : entry.type
      : "";
  }

  /**
   * Renders the file pane in the current view and sort. The selection
   * survives, and so does keyboard focus: on a column header, or on the
   * pane's item when focus was in the pane (or focus: true asks for it).
   */
  function renderPane(state: ExplorerState, focus = false) {
    const { win } = state;
    const info = locationInfo(state.location);
    const list = sorted(entries(state.location), state.sort);
    state.entries = new Map(list.map(entry => [entry.action, entry]));
    const active = document.activeElement;
    const hadFocus = active instanceof Node && state.pane.contains(active);
    const header =
      hadFocus && active instanceof HTMLElement ? active.dataset.sort : "";
    const view = win.view ?? "large";
    state.pane.innerHTML =
      view === "details"
        ? detailsMarkup({
            label: info.name,
            columns: COLUMNS,
            rows: list.map(entry => ({
              action: entry.action,
              name: entry.name,
              icon: entry.icon,
              tip: entry.project?.summary,
              cells: [entry.type, entry.stack, entry.demo],
            })),
            sort: state.sort,
            focused: header,
          })
        : `<div class="WinFileList WinFileList--${view}" role="listbox" aria-label="${escape(info.name)}" data-listview${view === "list" ? ' data-flow="column"' : ""}>${list
            .map(entry =>
              listItem(entry.action, entry.name, entry.icon, {
                tip: entry.project?.summary,
                iconSize: view === "large" ? 32 : 16,
              }),
            )
            .join("")}</div>`;
    state.pane.dataset.view = view;
    const container = listOf(state);
    initListView(container);
    const selected = listItems(container).find(
      item => item.dataset.winAction === state.selected,
    );
    if (selected) selectItem(container, selected, { notify: false });
    updateSelection(state);
    if (header)
      state.pane
        .querySelector<HTMLElement>(`[data-sort="${header}"]`)
        ?.focus({ preventScroll: true });
    else if (focus || hadFocus) focusList(container);
  }

  /**
   * Shows a location. history "push" records the way back (a new place);
   * Back and Forward move along the stacks themselves.
   */
  function navigate(
    state: ExplorerState,
    location: ExplorerLocation,
    history: "push" | "none" = "push",
  ) {
    if (history === "push" && location !== state.location) {
      state.back.push(state.location);
      state.forward.length = 0;
    }
    state.popup?.close("programmatic");
    state.location = location;
    state.selected = undefined;
    const info = locationInfo(location);
    wm.retitle(state.win, info.name);
    // An open plain folder shows the open-folder icon in its caption and task.
    wm.setIcon(state.win, info.icon === "folder" ? "folder-open" : info.icon);
    state.address.value = info.address;
    state.addressIcon.innerHTML = windowsIcon(info.icon, 16);
    state.zone.innerHTML = `${windowsIcon(info.zoneIcon, 16)}<span>${escape(info.zone)}</span>`;
    setDisabled(state.toolButtons.back, !state.back.length);
    setDisabled(state.toolButtons.forward, !state.forward.length);
    setDisabled(state.toolButtons.up, !info.parent);
    state.panel.innerHTML = `${windowsIcon(info.icon)}<h2>${escape(info.name)}</h2><hr><div class="WinWebViewInfo"></div>${seeAlso(location)}`;
    renderPane(state, true);
  }
  function goBack(state: ExplorerState) {
    const to = state.back.pop();
    if (!to) return;
    state.forward.push(state.location);
    navigate(state, to, "none");
  }
  function goForward(state: ExplorerState) {
    const to = state.forward.pop();
    if (!to) return;
    state.back.push(state.location);
    navigate(state, to, "none");
  }
  function goUp(state: ExplorerState) {
    const parent = locationInfo(state.location).parent;
    if (parent) navigate(state, parent);
  }

  function setView(state: ExplorerState, view: ListViewMode) {
    state.win.view = view;
    renderPane(state);
  }
  function cycleView(state: ExplorerState) {
    const index = EXPLORER_VIEWS.findIndex(
      view => view.id === (state.win.view ?? "large"),
    );
    setView(state, EXPLORER_VIEWS[(index + 1) % EXPLORER_VIEWS.length].id);
  }
  function arrange(state: ExplorerState, key: SortKey) {
    state.sort = { key, descending: false };
    renderPane(state);
  }

  const viewItems = (state: ExplorerState): MenuEntry[] =>
    EXPLORER_VIEWS.map(view => ({
      label: view.label,
      check: "radio",
      checked: (state.win.view ?? "large") === view.id,
      action: () => setView(state, view.id),
    }));

  function setPart(
    state: ExplorerState,
    part: "toolbars" | "statusBar" | "webView",
    on: boolean,
  ) {
    state[part] = on;
    state.rebar.hidden = !state.toolbars;
    state.win.status.hidden = !state.statusBar;
    state.panel.hidden = !state.webView;
  }

  /** The pane background's shortcut menu, as a folder's in Windows 98. */
  function backgroundItems(state: ExplorerState): MenuEntry[] {
    return [
      { label: "&View", submenu: () => viewItems(state) },
      "-",
      {
        label: "Arrange &Icons",
        submenu: [
          { label: "by &Name", action: () => arrange(state, "name") },
          { label: "by &Type", action: () => arrange(state, "type") },
        ],
      },
      { label: "R&efresh", action: () => renderPane(state) },
      "-",
      {
        label: "P&roperties",
        action: () => locationProperties(state.location),
      },
    ];
  }

  function menus(state: ExplorerState): MenuBarMenu[] {
    const selected = () => selectedItem(listOf(state));
    return [
      {
        label: "&File",
        items: () => [
          {
            label: "&Open",
            default: true,
            disabled: !selected(),
            action: () => {
              const item = selected();
              if (item) openItem(item);
            },
          },
          "-",
          { label: "&Close", action: () => wm.closeWindow(state.win) },
        ],
      },
      {
        label: "&View",
        items: () => [
          {
            label: "&Toolbars",
            check: "check",
            checked: state.toolbars,
            action: () => setPart(state, "toolbars", !state.toolbars),
          },
          {
            label: "Status &Bar",
            check: "check",
            checked: state.statusBar,
            action: () => setPart(state, "statusBar", !state.statusBar),
          },
          {
            label: "as &Web Page",
            check: "check",
            checked: state.webView,
            action: () => setPart(state, "webView", !state.webView),
          },
          "-",
          ...viewItems(state),
          "-",
          {
            label: "Arrange &Icons",
            submenu: [
              { label: "by &Name", action: () => arrange(state, "name") },
              { label: "by &Type", action: () => arrange(state, "type") },
            ],
          },
          { label: "&Refresh", action: () => renderPane(state) },
        ],
      },
      {
        label: "&Go",
        items: () => [
          {
            label: "&Back",
            shortcut: "Alt+←",
            keyshortcuts: "Alt+ArrowLeft",
            disabled: !state.back.length,
            action: () => goBack(state),
          },
          {
            label: "&Forward",
            shortcut: "Alt+→",
            keyshortcuts: "Alt+ArrowRight",
            disabled: !state.forward.length,
            action: () => goForward(state),
          },
          {
            label: "&Up One Level",
            shortcut: "Backspace",
            disabled: !locationInfo(state.location).parent,
            action: () => goUp(state),
          },
          "-",
          { label: "&My Computer", action: () => navigate(state, "computer") },
          {
            label: "My &Projects",
            action: () => navigate(state, "folder:projects"),
          },
        ],
      },
      {
        label: "&Help",
        items: [{ label: "&About Portfolio 98", action: aboutPortfolio98 }],
      },
    ];
  }

  /** The Address list: the desktop's hierarchy, with the current place checked. */
  function addressItems(state: ExplorerState): MenuEntry[] {
    const place = (
      label: string,
      icon: string,
      indent: number,
      location?: ExplorerLocation,
      current = false,
    ): MenuEntry => ({
      label: literal(label),
      icon,
      indent,
      check: "radio",
      checked: current,
      disabled: !location,
      action: location ? () => navigate(state, location) : undefined,
    });
    const here = state.location;
    return [
      place("Desktop", "desktop", 0),
      place("My Computer", "computer", 1, "computer", here === "computer"),
      place("Portfolio (C:)", "drive", 2, "folder:projects"),
      place(
        "My Projects",
        "folder",
        3,
        "folder:projects",
        here === "folder:projects",
      ),
      ...folders
        .slice(1)
        .map(folder =>
          place(
            folder.name,
            folder.icon,
            4,
            `folder:${folder.id}`,
            here === `folder:${folder.id}`,
          ),
        ),
      place("Recycle Bin", "recycle", 1, "recycle", here === "recycle"),
    ];
  }

  /** Opens (or closes) one of the window's popups: the Address list or Views. */
  function togglePopup(
    state: ExplorerState,
    kind: "address" | "views",
    keyboard: boolean,
  ) {
    const previous = state.popup;
    state.popup = undefined;
    if (previous && !previous.closed) {
      // A second press on the same button closes its list, and the
      // keyboard returns to the list's control (the Address field or the
      // Views button) instead of falling to the page.
      const same = previous.element.dataset.popup === kind;
      previous.close(same ? "escape" : "programmatic");
      if (same) return;
    }
    const combo = state.address.parentElement!;
    const button = state.rebar.querySelector<HTMLElement>(
      kind === "address" ? ".WinComboButton" : ".WinToolDrop",
    )!;
    // Both lists open below their whole control: the Address field, or the
    // Views split button (from its left edge, not the arrow's).
    const below = (
      kind === "address"
        ? combo
        : state.rebar.querySelector<HTMLElement>('[data-explorer="views"]')!
    ).getBoundingClientRect();
    // A mouse-opened Views list hands the keyboard back to where it was in
    // the window (the file pane); the keyboard returns to the button.
    const focused = document.activeElement;
    const content =
      !keyboard &&
      focused instanceof HTMLElement &&
      state.win.element.contains(focused)
        ? focused
        : button;
    const menu = openMenu({
      items: kind === "address" ? addressItems(state) : viewItems(state),
      point: { x: below.left, y: below.bottom },
      returnFocus: kind === "address" ? state.address : content,
      focus: kind === "address" ? "none" : keyboard ? "first" : "menu",
      label: kind === "address" ? "Address" : "Views",
      className: kind === "address" ? "WinAddressMenu" : undefined,
      ignore: button,
      onClose: () => {
        button.setAttribute("aria-expanded", "false");
        button.removeAttribute("aria-controls");
      },
    });
    menu.element.dataset.popup = kind;
    state.popup = menu;
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", menu.element.id);
    if (kind === "address") {
      menu.element.style.minWidth = `${combo.offsetWidth}px`;
      // The list opens on the current place, as a combo box's does.
      menu.element
        .querySelector<HTMLElement>('[aria-checked="true"]')
        ?.focus({ preventScroll: true });
    }
  }

  function build(win: DesktopWindow, location: ExplorerLocation) {
    const abort = new AbortController();
    signal.addEventListener("abort", () => abort.abort(), {
      signal: abort.signal,
    });
    win.dispose = () => abort.abort();
    // Without a remembered control, the keyboard returns to the file pane.
    win.defaultFocus = () => {
      const list = state.pane.querySelector<HTMLElement>("[data-listview]");
      return list ? tabStop(list) : undefined;
    };
    win.view ??= "large";
    win.element.classList.add("WinWindow--explorer");
    const id = `win-explorer-${++explorerCount}`;
    const bar = document.createElement("div");
    const rebar = document.createElement("div");
    rebar.className = "WinRebar";
    rebar.innerHTML = `<div class="WinRebarBand WinToolBand" role="toolbar" aria-label="Standard Buttons">${toolButton("back", "Back")}${toolButton("forward", "Forward")}${toolButton("up", "Up", "folder-up")}<span class="WinToolSeparator"></span>${toolButton("views", "Views")}<button type="button" class="WinToolButton WinToolDrop" data-explorer="views-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Choose a view" tabindex="-1"></button></div><div class="WinRebarBand WinAddressBand"><label for="${id}-address">Address</label><div class="WinCombo"><span class="WinComboIcon"></span><input id="${id}-address" type="text" readonly spellcheck="false" autocomplete="off" aria-keyshortcuts="Alt+ArrowDown"><button type="button" class="WinComboButton" data-explorer="address" aria-haspopup="menu" aria-expanded="false" aria-label="Address list"></button></div></div>`;
    win.body.before(bar, rebar);
    win.body.classList.add("WinExplorerBody");
    win.body.innerHTML = `<div class="WinExplorer"><aside class="WinWebView" aria-label="Web View"></aside><div class="WinFiles" data-list-scroll></div></div>`;
    win.status.classList.add("WinStatus--panes");
    win.status.innerHTML = `<span class="WinStatusField" role="status"><span class="WinStatusSummary"></span><span class="WinStatusCount"></span></span><span class="WinStatusField WinStatusKind"></span><span class="WinStatusField WinStatusZone"></span>`;
    const toolbar = rebar.querySelector<HTMLElement>(".WinToolBand")!;
    const tool = (command: string) =>
      toolbar.querySelector<HTMLButtonElement>(`[data-explorer="${command}"]`)!;
    const state: ExplorerState = {
      win,
      location,
      back: [],
      forward: [],
      toolbars: true,
      statusBar: true,
      webView: true,
      entries: new Map(),
      rebar,
      toolButtons: {
        back: tool("back"),
        forward: tool("forward"),
        up: tool("up"),
      },
      address: rebar.querySelector("input")!,
      addressIcon: rebar.querySelector(".WinComboIcon")!,
      panel: win.body.querySelector(".WinWebView")!,
      pane: win.body.querySelector(".WinFiles")!,
      count: win.status.querySelector(".WinStatusCount")!,
      summary: win.status.querySelector(".WinStatusSummary")!,
      kind: win.status.querySelector(".WinStatusKind")!,
      zone: win.status.querySelector(".WinStatusZone")!,
    };
    const options = { signal: abort.signal };
    abort.signal.addEventListener("abort", () => state.popup?.close(), {
      once: true,
    });
    menuBar(bar, menus(state), options);
    // Standard Buttons: one Tab stop that follows the arrow keys.
    tool("back").tabIndex = 0;
    rovingToolbar(toolbar, abort.signal);
    rebar.addEventListener(
      "click",
      event => {
        const button = (event.target as Element).closest<HTMLElement>(
          "[data-explorer]",
        );
        if (!button || button.getAttribute("aria-disabled") === "true") return;
        const keyboard = event.detail === 0;
        switch (button.dataset.explorer) {
          case "back":
            return goBack(state);
          case "forward":
            return goForward(state);
          case "up":
            return goUp(state);
          case "views":
            return cycleView(state);
          case "views-menu":
            return togglePopup(state, "views", keyboard);
          case "address":
            return togglePopup(state, "address", keyboard);
        }
      },
      options,
    );
    // Pressing a list button keeps focus where it is (in an open list), so
    // the press can close what it opened.
    for (const button of rebar.querySelectorAll<HTMLElement>(
      ".WinToolDrop, .WinComboButton",
    ))
      button.addEventListener(
        "pointerdown",
        event => event.preventDefault(),
        options,
      );
    tool("views-menu").addEventListener(
      "keydown",
      event => {
        if (event.key !== "ArrowDown" || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        togglePopup(state, "views", true);
      },
      options,
    );
    // The read-only Address field shows focus as its selected text, as
    // Windows 98 does (no caret, no dotted rectangle): focus selects it,
    // including the click that focuses it.
    let focusingPress = false;
    state.address.addEventListener(
      "pointerdown",
      () => (focusingPress = document.activeElement !== state.address),
      options,
    );
    state.address.addEventListener(
      "focus",
      () => state.address.select(),
      options,
    );
    state.address.addEventListener(
      "mouseup",
      event => {
        if (!focusingPress) return;
        focusingPress = false;
        event.preventDefault();
        state.address.select();
      },
      options,
    );
    // Combo boxes open their list with Alt+Down or F4.
    state.address.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "F4" ||
          (event.altKey &&
            (event.key === "ArrowDown" || event.key === "ArrowUp"))
        ) {
          event.preventDefault();
          event.stopPropagation();
          togglePopup(state, "address", true);
        }
      },
      options,
    );
    // Column headers sort; a second click reverses.
    bindDetailsHeaders(state.pane, {
      signal: abort.signal,
      onSort: key => {
        state.sort = nextSort(state.sort, key) as ExplorerState["sort"];
        renderPane(state);
      },
    });
    // A right-click on the pane's empty space: the folder's own menu.
    win.backgroundMenu = target =>
      state.pane.contains(target) && !target.closest(`${LIST_ITEM}, thead`)
        ? backgroundItems(state)
        : undefined;
    win.body.addEventListener(
      LIST_SELECT,
      () => updateSelection(state),
      options,
    );
    // Explorer's keys: Backspace goes up, Alt+Left and Alt+Right move in history.
    win.element.addEventListener(
      "keydown",
      event => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
        const target = event.target as Element;
        if (
          event.altKey &&
          !event.shiftKey &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          event.preventDefault();
          if (event.key === "ArrowLeft") goBack(state);
          else goForward(state);
        } else if (
          event.key === "Backspace" &&
          !event.altKey &&
          !target.closest("input, textarea, [contenteditable]")
        ) {
          event.preventDefault();
          goUp(state);
        }
      },
      options,
    );
    return state;
  }

  return {
    /**
     * Shows a location in the Explorer window, creating it if needed. A new
     * place joins the window's Back history.
     */
    open(location: ExplorerLocation) {
      const info = locationInfo(location);
      const win = wm.createWindow("explorer", info.name, info.icon, {
        minWidth: 320,
        minHeight: 200,
      });
      const state = states.get(win);
      if (state) navigate(state, location);
      else {
        const created = build(win, location);
        states.set(win, created);
        navigate(created, location, "none");
      }
      return win;
    },
  };
}
