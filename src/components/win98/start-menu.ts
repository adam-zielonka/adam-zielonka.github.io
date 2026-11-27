import { projects } from "../../data/projects";
import { openMenu, type MenuEntry, type MenuHandle } from "./menu";
import { folders, type Folder } from "./shared";
import { PHONE_WIDTH } from "./window-manager";

/** A boolean preference shown as a check item in Start ▸ Settings. */
export type ToggleSetting = {
  get(): boolean;
  set(on: boolean): void;
  /**
   * The platform keeps it off (high contrast): shown off and unavailable,
   * while the stored choice stays as it was.
   */
  forcedOff?(): boolean;
};

/**
 * What the Start menu can do. The desktop supplies these; Start only knows
 * its structure and wording.
 */
export type StartCommands = {
  openFolder(id: Folder): void;
  openProject(id: string): void;
  openAbout(): void;
  openContact(): void;
  openFind(): void;
  openHelp(): void;
  run(): void;
  shutDown(): void;
  /** MS-DOS Prompt: leaves for the terminal, and `exit` comes straight back. */
  msDosPrompt(): void;
  /** Project ids opened this session, most recent first. */
  recentProjects(): readonly string[];
  animations: ToggleSetting;
  /**
   * Settings ▸ Display effects (the CRT picture). The terminal passes
   * getCrtEffects()/setCrtEffects() from src/utils/crt-curvature.ts through
   * WindowsDesktop's displayEffects option; without it the item is omitted.
   */
  displayEffects?: ToggleSetting;
};

/** Menu labels use '&' for mnemonics; names keep their literal ampersands. */
const literal = (text: string) => text.replaceAll("&", "&&");

/** Start's items, top to bottom, as in Windows 98 with original wording. */
export function startMenuItems(commands: StartCommands): MenuEntry[] {
  const programs = (): MenuEntry[] => [
    ...folders.slice(1).map((folder): MenuEntry => ({
      label: `&${literal(folder.name)}`,
      icon: folder.icon,
      submenu: () => [
        {
          label: "&Open folder",
          default: true,
          icon: "folder",
          action: () => commands.openFolder(folder.id),
        },
        ...projects
          .filter(project => folder.categories.includes(project.category))
          .map((project): MenuEntry => ({
            label: literal(project.name),
            icon: project.id,
            action: () => commands.openProject(project.id),
          })),
      ],
    })),
    "-",
    {
      label: "&My Projects",
      icon: "folder",
      action: () => commands.openFolder("projects"),
    },
    { label: "MS-DOS &Prompt", icon: "terminal", action: commands.msDosPrompt },
  ];
  const documents = (): MenuEntry[] => {
    const recent = commands
      .recentProjects()
      .map(id => projects.find(project => project.id === id))
      .filter(project => project !== undefined)
      .slice(0, 10)
      .map((project): MenuEntry => ({
        label: literal(project.name),
        icon: project.id,
        action: () => commands.openProject(project.id),
      }));
    return [
      {
        label: "&About Adam.txt",
        icon: "notepad",
        action: commands.openAbout,
      },
      "-",
      ...(recent.length ? recent : [{ label: "(Empty)", disabled: true }]),
    ];
  };
  const toggle = (label: string, setting: ToggleSetting): MenuEntry => {
    const forced = !!setting.forcedOff?.();
    return {
      label,
      check: "check",
      checked: !forced && setting.get(),
      disabled: forced,
      action: () => setting.set(!setting.get()),
    };
  };
  const settings = (): MenuEntry[] => [
    toggle("&Animations", commands.animations),
    ...(commands.displayEffects
      ? [toggle("&Display effects", commands.displayEffects)]
      : []),
  ];
  return [
    { label: "&Programs", icon: "programs", submenu: programs },
    { label: "&Documents", icon: "documents", submenu: documents },
    { label: "&Settings", icon: "settings", submenu: settings },
    {
      label: "&Find",
      icon: "find",
      submenu: [
        {
          label: "&Projects…",
          icon: "find",
          shortcut: "F3",
          action: commands.openFind,
        },
        { label: "P&eople…", icon: "mail", action: commands.openContact },
      ],
    },
    { label: "&Help", icon: "help", action: commands.openHelp },
    { label: "&Run…", icon: "run", action: commands.run },
    "-",
    { label: "Sh&ut Down…", icon: "shutdown", action: commands.shutDown },
  ];
}

/** Phones and touch screens get push-in panels instead of flyouts. */
export function prefersPushIn(workspace: HTMLElement) {
  const width = workspace.clientWidth;
  return (
    !!window.matchMedia?.("(pointer: coarse)").matches ||
    (width > 0 && width <= PHONE_WIDTH)
  );
}

export type StartMenu = ReturnType<typeof createStartMenu>;

/**
 * The Start menu, a WinMenu opened above the Start button and placed right
 * after it in the DOM. Opening it hands the foreground to the taskbar
 * (onOpen); a press outside, without a choice, lets the desktop reactivate
 * the previous window (onCancel).
 */
export function createStartMenu({
  root,
  start,
  items,
  onOpen,
  onCancel,
}: {
  root: HTMLElement;
  start: HTMLButtonElement;
  items: () => MenuEntry[];
  onOpen: () => void;
  onCancel: () => void;
}) {
  const workspace = root.querySelector<HTMLElement>(".WinWorkspace")!;
  let menu: MenuHandle | undefined;
  const pushIn = () => prefersPushIn(workspace);

  function toggle(open: boolean, focus = false) {
    if (open && !menu) {
      onOpen();
      const before = document.activeElement;
      const handle: MenuHandle = openMenu({
        items,
        anchor: start,
        placement: "above",
        host: root,
        bounds: root,
        after: start,
        ignore: start,
        returnFocus: start,
        // Opened with the mouse, the keyboard waits on the panel.
        focus: focus ? "first" : "menu",
        label: "Start menu",
        className: "WinStartMenu",
        submenuClassName: "WinStartSubmenu",
        iconSize: 32,
        banner: "<span><b>Portfolio</b> 98</span>",
        pushIn: pushIn(),
        onClose: reason => {
          if (menu === handle) menu = undefined;
          if (reason !== "outside") return;
          // A press elsewhere cancels Start. If the panel had the keyboard,
          // give it back; the press may still focus what it lands on.
          const focused = document.activeElement;
          if (
            (!focused || focused === document.body) &&
            before instanceof HTMLElement &&
            before.isConnected &&
            !before.closest("[inert]")
          )
            before.focus({ preventScroll: true });
          onCancel();
        },
      });
      menu = handle;
      return;
    }
    if (open && focus) menu?.focusItem("first");
    if (!open && menu) {
      menu.close("programmatic");
      if (focus) start.focus({ preventScroll: true });
    }
  }

  return {
    get element() {
      return menu?.element;
    },
    get open() {
      return !!menu;
    },
    toggle,
    /** Closes without a choice; the previous window becomes active again. */
    cancel() {
      menu?.close("outside");
    },
    /** Start, its menu or one of its cascades. */
    contains(node: Node) {
      const element = node instanceof Element ? node : node.parentElement;
      return (
        start.contains(node) ||
        !!element?.closest(".WinStartMenu, .WinStartSubmenu")
      );
    },
    /** Arrow keys on the Start button reach an open menu's ends. */
    keydown(event: KeyboardEvent) {
      if (!menu || event.target !== start) return false;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return false;
      event.preventDefault();
      menu.focusItem(event.key === "ArrowDown" ? "first" : "last");
      return true;
    },
  };
}
