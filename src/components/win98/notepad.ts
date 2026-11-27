import { menuBar } from "./menu";
import { messageBox } from "./message-box";
import type { DesktopWindow, WindowManager } from "./window-manager";

/** About Adam.txt: plain text, as Notepad shows it. */
export const ABOUT_TEXT = [
  "HELLO, WORLD.",
  "",
  "I'M ADAM ZIELONKA.",
  "",
  "I build apps, tools and experiments.",
  "This is my little corner of the internet.",
  "",
  "From Pascal games to modern web applications, these projects are a record of learning by making things.",
  "",
  "-".repeat(32),
  "",
  "Welcome to Portfolio 98.",
  "",
  "Explore the folders, open a project and try a demo or read the code.",
  "",
  "Double-click (or tap) an icon to open it; a single click selects it.",
  "Drag a title bar to move a window, and drag its border to resize it.",
  "Use the taskbar to switch between windows.",
  "",
  "Back to the terminal?",
  "Start ▸ Shut Down… ▸ Restart in MS-DOS mode returns to the terminal,",
  "and so does MS-DOS Prompt. Type EXIT there to come back.",
  "",
].join("\n");

/**
 * Notepad with About Adam.txt: a read-only plain-text edit control with
 * File, Edit, Search and Help menus, and no status bar.
 */
export function createNotepad({
  wm,
  signal,
}: {
  wm: WindowManager;
  signal: AbortSignal;
}) {
  const editors = new WeakMap<DesktopWindow, HTMLTextAreaElement>();
  /** The last Find what: entry, for Find Next (F3). */
  let lastSearch = "";

  /** Selects the next match after the caret; says so when there is none. */
  function findNext(win: DesktopWindow) {
    const text = editors.get(win);
    if (!text || !lastSearch) return;
    const at = text.value
      .toLowerCase()
      .indexOf(lastSearch.toLowerCase(), text.selectionEnd);
    text.focus({ preventScroll: true });
    if (at < 0) {
      void messageBox({
        title: "Notepad",
        icon: "info",
        body: `Cannot find "${lastSearch}"`,
        returnFocus: text,
      });
      return;
    }
    text.setSelectionRange(at, at + lastSearch.length);
  }

  async function find(win: DesktopWindow) {
    const text = editors.get(win);
    if (!text) return;
    const body = document.createElement("label");
    body.className = "WinRunField";
    body.innerHTML = `<span>Find what:</span><input class="WinField" type="text" autocomplete="off" spellcheck="false">`;
    const input = body.querySelector("input")!;
    input.value = lastSearch;
    const answer = messageBox({
      title: "Find",
      body,
      role: "dialog",
      buttons: [
        { id: "next", label: "Find Next", default: true },
        { id: "cancel", label: "Cancel", cancel: true },
      ],
      initialFocus: input,
      returnFocus: text,
      onButton: id => id !== "next" || !!input.value,
      signal,
    });
    input.select();
    if ((await answer) !== "next") return;
    lastSearch = input.value;
    findNext(win);
  }

  function build(win: DesktopWindow) {
    const abort = new AbortController();
    signal.addEventListener("abort", () => abort.abort(), {
      signal: abort.signal,
    });
    win.dispose = () => abort.abort();
    const bar = document.createElement("div");
    win.body.before(bar);
    win.body.classList.add("WinNotepadBody");
    win.status.hidden = true;
    const text = document.createElement("textarea");
    text.className = "WinNotepadText";
    text.readOnly = true;
    win.defaultFocus = () => text;
    text.spellcheck = false;
    text.setAttribute("wrap", "soft");
    text.setAttribute("aria-label", "About Adam.txt");
    // The default value, so the text is also the element's content.
    text.textContent = ABOUT_TEXT;
    win.body.append(text);
    editors.set(win, text);

    const selection = () =>
      text.value.slice(text.selectionStart, text.selectionEnd);
    function copy() {
      const value = selection();
      if (!value) return;
      void navigator.clipboard?.writeText(value).catch(() => undefined);
    }
    menuBar(
      bar,
      [
        {
          label: "&File",
          items: [{ label: "&Close", action: () => wm.closeWindow(win) }],
        },
        {
          label: "&Edit",
          items: () => [
            {
              label: "&Copy",
              shortcut: "Ctrl+C",
              disabled: !selection(),
              action: copy,
            },
            {
              label: "Select &All",
              action: () => {
                text.focus({ preventScroll: true });
                text.select();
              },
            },
            "-",
            {
              label: "&Word Wrap",
              check: "check",
              checked: text.getAttribute("wrap") !== "off",
              action: () =>
                text.setAttribute(
                  "wrap",
                  text.getAttribute("wrap") === "off" ? "soft" : "off",
                ),
            },
          ],
        },
        {
          label: "&Search",
          items: () => [
            { label: "&Find…", action: () => void find(win) },
            {
              label: "Find &Next",
              shortcut: "F3",
              disabled: !lastSearch,
              action: () => findNext(win),
            },
          ],
        },
        {
          label: "&Help",
          items: [
            {
              label: "&About Notepad",
              action: () =>
                void messageBox({
                  title: "About Notepad",
                  icon: "notepad",
                  body: "Portfolio 98 Notepad",
                }),
            },
          ],
        },
      ],
      { signal: abort.signal },
    );
    return text;
  }

  return {
    /** Opens About Adam.txt with the keyboard at the top of the text. */
    open() {
      const win = wm.createWindow(
        "about",
        "About Adam.txt - Notepad",
        "notepad",
      );
      let text = editors.get(win);
      if (!text) {
        text = build(win);
        text.setSelectionRange(0, 0);
      }
      text.focus({ preventScroll: true });
      return win;
    },
    /** F3 inside Notepad: Find Next, or Find… before the first search. */
    findNext(win: DesktopWindow) {
      if (lastSearch) findNext(win);
      else void find(win);
    },
  };
}
