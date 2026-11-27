import { projects } from "../../data/projects";
import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import type { Project } from "../../types/project";
import { aboutPortfolio98, EXPLORER_VIEWS, projectsIn } from "./explorer";
import {
  bindDetailsHeaders,
  detailsMarkup,
  initListView,
  LIST_ITEM,
  listItem,
  listItems,
  nextSort,
  selectItem,
  selectedItem,
  type DetailsColumn,
  type DetailsSort,
  type ListViewMode,
} from "./list-view";
import { menuBar, type MenuEntry } from "./menu";
import { folderOf, projectLocation } from "./properties";
import { folders, type Folder } from "./shared";
import type { DesktopWindow, WindowManager } from "./window-manager";

/** The simulated search takes this long when animations are on. */
export const SEARCH_TIME = 450;
/** Find's size before and after its first search, unless the user sized it. */
const FIND_WIDTH = 500;
const FIND_RESULTS_HEIGHT = 420;

const COLUMNS: DetailsColumn[] = [
  { key: "name", label: "Name", className: "WinColName" },
  { key: "folder", label: "In Folder", className: "WinColFolder" },
  { key: "type", label: "Type", className: "WinColType" },
  { key: "stack", label: "Technologies", className: "WinColStack" },
];

export type FindCriteria = {
  named: string;
  text: string;
  look: Folder;
  subfolders: boolean;
};

/** Lower case with single spaces, so a phrase matches across line breaks. */
const normalize = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLowerCase();

/** A project's searchable text: summary, technologies and description. */
const contents = new WeakMap<Project, string>();
function contentsOf(project: Project) {
  let text = contents.get(project);
  if (text === undefined) {
    // A template parses without loading images or running anything.
    const template = document.createElement("template");
    template.innerHTML = project.html;
    // Separate the text of neighbouring elements, as a browser shows it.
    const walker = document.createTreeWalker(
      template.content,
      NodeFilter.SHOW_TEXT,
    );
    const parts = [project.summary, project.stack.join(" ")];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? "");
    text = normalize(parts.join(" "));
    contents.set(project, text);
  }
  return text;
}

/**
 * Projects matching the criteria. Named matches names and ids; Containing
 * text matches the summary, technologies and description. Projects live in
 * their category folders, so Portfolio (C:) without subfolders has none.
 */
export function findProjects(criteria: FindCriteria): Project[] {
  const named = normalize(criteria.named);
  const text = normalize(criteria.text);
  const scope =
    criteria.look === "projects"
      ? criteria.subfolders
        ? projects
        : []
      : projectsIn(criteria.look);
  return scope.filter(
    project =>
      (!named ||
        project.name.toLowerCase().includes(named) ||
        project.id.toLowerCase().includes(named)) &&
      (!text || contentsOf(project).includes(text)),
  );
}

export const findStatus = (count: number) =>
  count
    ? `${count} project(s) found`
    : "There are no items to show in this view.";

/**
 * Find: Projects, after the Windows 98 Find dialog: a Name & Location group,
 * Find Now / Stop / New Search, and results in a list view that the window
 * grows to show.
 */
export function createFind({
  wm,
  signal,
  openHelp,
}: {
  wm: WindowManager;
  signal: AbortSignal;
  openHelp: () => void;
}) {
  let findCount = 0;

  function build(win: DesktopWindow) {
    const abort = new AbortController();
    signal.addEventListener("abort", () => abort.abort(), {
      signal: abort.signal,
    });
    win.view = "details";
    const id = `win-find-${++findCount}`;
    const bar = document.createElement("div");
    win.body.before(bar);
    win.body.classList.add("WinFindBody");
    win.body.innerHTML = `<form class="WinFind" novalidate><fieldset class="WinGroup"><legend>Name &amp; Location</legend><div class="WinFindFields"><label for="${id}-named">Named:</label><input class="WinField" id="${id}-named" name="named" type="text" autocomplete="off" spellcheck="false"><label for="${id}-text">Containing text:</label><input class="WinField" id="${id}-text" name="text" type="text" autocomplete="off" spellcheck="false"><label for="${id}-look">Look in:</label><span class="WinSelect"><select class="WinField" id="${id}-look" name="look">${folders
      .map(
        folder =>
          `<option value="${folder.id}">${escape(folder.id === "projects" ? "Portfolio (C:)" : folder.name)}</option>`,
      )
      .join(
        "",
      )}</select></span><label class="WinCheck"><input type="checkbox" name="subfolders" checked><span>Include subfolders</span></label></div></fieldset><div class="WinFindButtons"><button type="submit" class="WinButton WinButton--default" data-find="now">Find Now</button><button type="button" class="WinButton" data-find="stop" disabled>Stop</button><button type="button" class="WinButton" data-find="new">New Search</button><span class="WinFindGlass" aria-hidden="true">${windowsIcon("find")}</span></div></form><div class="WinFindResults" data-list-scroll hidden></div>`;
    const form = win.body.querySelector("form")!;
    const input = (name: string) =>
      form.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    const named = input("named");
    win.defaultFocus = () => named;
    const text = input("text");
    const subfolders = input("subfolders");
    const look = form.querySelector("select")!;
    const findNow = form.querySelector<HTMLButtonElement>('[data-find="now"]')!;
    const stop = form.querySelector<HTMLButtonElement>('[data-find="stop"]')!;
    const results = win.body.querySelector<HTMLElement>(".WinFindResults")!;
    win.status.setAttribute("role", "status");
    win.status.textContent = "";
    let found: Project[] = [];
    let sort: DetailsSort | undefined;
    let searching:
      | { scope: Project[]; started: number; timer: number }
      | undefined;
    abort.signal.addEventListener("abort", () =>
      window.clearTimeout(searching?.timer),
    );

    const listOf = () => results.querySelector<HTMLElement>("[data-listview]")!;
    function sorted(list: Project[]) {
      if (!sort) return list;
      const { key, descending } = sort;
      const value = (project: Project) =>
        key === "folder"
          ? projectLocation(project)
          : key === "type"
            ? project.category
            : key === "stack"
              ? project.stack.join(", ")
              : project.name;
      return [...list].sort(
        (a, b) =>
          value(a).localeCompare(value(b), undefined, {
            sensitivity: "base",
          }) * (descending ? -1 : 1) || a.name.localeCompare(b.name),
      );
    }

    /** Renders the results in the current view, keeping the selection and focus. */
    function renderResults(header?: string) {
      const previous = results.querySelector<HTMLElement>("[data-listview]");
      const selected = previous && selectedItem(previous)?.dataset.winAction;
      const hadFocus =
        !header &&
        !!previous &&
        previous.contains(document.activeElement) &&
        !document.activeElement?.closest("thead");
      const view: ListViewMode = win.view ?? "details";
      const list = sorted(found);
      results.innerHTML =
        view === "details"
          ? detailsMarkup({
              label: "Search results",
              className: "WinDetails--find",
              columns: COLUMNS,
              rows: list.map(project => ({
                action: `project:${project.id}`,
                name: project.name,
                icon: project.id,
                tip: project.summary,
                cells: [
                  projectLocation(project),
                  project.category,
                  project.stack.join(", "),
                ],
              })),
              sort,
              focused: header,
            })
          : `<div class="WinFileList WinFileList--${view}" role="listbox" aria-label="Search results" data-listview${view === "list" ? ' data-flow="column"' : ""}>${list
              .map(project =>
                listItem(`project:${project.id}`, project.name, project.id, {
                  tip: `${project.summary} (${folderOf(project).name})`,
                  iconSize: view === "large" ? 32 : 16,
                }),
              )
              .join("")}</div>`;
      results.dataset.view = view;
      const container = listOf();
      initListView(container);
      const again = listItems(container).find(
        item => item.dataset.winAction === selected,
      );
      if (again) selectItem(container, again, { notify: false });
      if (header)
        results
          .querySelector<HTMLElement>(`[data-sort="${header}"]`)
          ?.focus({ preventScroll: true });
      else if (hadFocus)
        (selectedItem(container) ?? listItems(container)[0] ?? container).focus(
          { preventScroll: true },
        );
    }

    function criteria(): FindCriteria {
      return {
        named: named.value,
        text: text.value,
        look: look.value as Folder,
        subfolders: subfolders.checked,
      };
    }

    function showResults(list: Project[], query: FindCriteria) {
      found = list;
      const firstResults = results.hidden;
      results.hidden = false;
      renderResults();
      win.status.textContent = findStatus(list.length);
      const name = query.named.trim();
      wm.retitle(win, name ? `Find: Projects named ${name}` : "Find: Projects");
      // The window grows to show the results, unless the user sized it.
      if (firstResults && !win.resized && win.h === undefined)
        wm.setBounds(win, { x: win.x, y: win.y, h: FIND_RESULTS_HEIGHT });
      // On a short screen the form scrolls: bring the results into view.
      const body = win.body;
      if (body.scrollHeight > body.clientHeight) {
        const box = body.getBoundingClientRect();
        const scale = box.height / body.offsetHeight || 1;
        body.scrollTop +=
          (results.getBoundingClientRect().top - box.top) / scale;
      }
    }

    function finishSearch(stopped = false) {
      const run = searching;
      if (!run) return;
      searching = undefined;
      window.clearTimeout(run.timer);
      delete form.dataset.searching;
      findNow.disabled = false;
      // Stop and Find Now trade places; the keyboard stays on the form.
      if (document.activeElement === stop)
        findNow.focus({ preventScroll: true });
      stop.disabled = true;
      const query = criteria();
      let scope = run.scope;
      if (stopped) {
        // Stop keeps what the search found so far.
        const share = (performance.now() - run.started) / SEARCH_TIME;
        scope = scope.slice(0, Math.floor(scope.length * Math.min(1, share)));
      }
      showResults(
        findProjects(query).filter(project => scope.includes(project)),
        query,
      );
    }

    function startSearch() {
      if (searching) finishSearch(true);
      const query = criteria();
      // Without animations the search is instant.
      // The setting itself: a skipped startup screen or a return from the
      // MS-DOS Prompt does not turn the desktop's own animations off.
      if (!window.store?.system.animations) {
        showResults(findProjects(query), query);
        return;
      }
      searching = {
        scope: projects,
        started: performance.now(),
        timer: window.setTimeout(() => finishSearch(), SEARCH_TIME),
      };
      form.dataset.searching = "";
      stop.disabled = false;
      win.status.textContent = "Searching…";
      // Find Now is disabled while searching; Stop takes the keyboard.
      if (document.activeElement === findNow)
        stop.focus({ preventScroll: true });
      findNow.disabled = true;
    }

    function newSearch() {
      if (searching) finishSearch(true);
      form.reset();
      found = [];
      sort = undefined;
      renderResults();
      win.status.textContent = "";
      wm.retitle(win, "Find: Projects");
      named.focus({ preventScroll: true });
    }

    function setView(view: ListViewMode) {
      win.view = view;
      renderResults();
    }

    form.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        startSearch();
      },
      { signal: abort.signal },
    );
    // Enter anywhere in the dialog chooses the default button, Find Now.
    form.addEventListener(
      "keydown",
      event => {
        if (event.key !== "Enter" || event.defaultPrevented) return;
        if ((event.target as Element).closest("button")) return;
        event.preventDefault();
        if (!findNow.disabled) startSearch();
      },
      { signal: abort.signal },
    );
    form.addEventListener(
      "click",
      event => {
        const button = (event.target as Element).closest<HTMLElement>(
          "[data-find]",
        );
        if (button?.dataset.find === "stop") finishSearch(true);
        else if (button?.dataset.find === "new") newSearch();
      },
      { signal: abort.signal },
    );
    bindDetailsHeaders(results, {
      signal: abort.signal,
      onSort: key => {
        sort = nextSort(sort, key);
        renderResults(key);
      },
    });
    const viewItems = (): MenuEntry[] =>
      EXPLORER_VIEWS.map(view => ({
        label: view.label,
        check: "radio",
        checked: (win.view ?? "details") === view.id,
        action: () => setView(view.id),
      }));
    win.backgroundMenu = target =>
      results.contains(target) && !target.closest(`${LIST_ITEM}, thead`)
        ? [{ label: "&View", submenu: viewItems }]
        : undefined;
    menuBar(
      bar,
      [
        {
          label: "&File",
          items: [
            { label: "&New Search", action: newSearch },
            "-",
            { label: "&Close", action: () => wm.closeWindow(win) },
          ],
        },
        { label: "&View", items: viewItems },
        {
          label: "&Help",
          items: [
            { label: "Help &Topics", action: openHelp },
            "-",
            { label: "&About Portfolio 98", action: aboutPortfolio98 },
          ],
        },
      ],
      { signal: abort.signal },
    );
    renderResults();
    win.dispose = () => abort.abort();
    return named;
  }

  const named = new WeakMap<DesktopWindow, HTMLInputElement>();
  return {
    /** Opens Find (or brings it back) with the keyboard in Named. */
    open() {
      const win = wm.createWindow("find", "Find: Projects", "find", {
        w: FIND_WIDTH,
        className: "WinWindow--find",
      });
      if (!named.has(win)) {
        named.set(win, build(win));
        // Clamp again with the built form's height (short screens).
        wm.placeWindow(win);
      }
      named.get(win)!.focus();
      return win;
    },
  };
}
