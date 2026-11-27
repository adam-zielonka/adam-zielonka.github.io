import { projects } from "../../data/projects";
import { messageBox } from "./message-box";
import { folders, type Folder } from "./shared";

export type RunTarget =
  | { kind: "project"; id: string }
  | { kind: "folder"; id: Folder }
  | {
      kind:
        | "about"
        | "computer"
        | "contact"
        | "find"
        | "help"
        | "prompt"
        | "recycle";
    };

const programs: Record<string, RunTarget> = {
  notepad: { kind: "about" },
  "about adam.txt": { kind: "about" },
  "about adam": { kind: "about" },
  explorer: { kind: "folder", id: "projects" },
  find: { kind: "find" },
  command: { kind: "prompt" },
  dos: { kind: "prompt" },
  "ms-dos prompt": { kind: "prompt" },
  "my computer": { kind: "computer" },
  "c:": { kind: "computer" },
  "recycle bin": { kind: "recycle" },
  contact: { kind: "contact" },
  "address book": { kind: "contact" },
  help: { kind: "help" },
};

/**
 * What Start ▸ Run… opens for a typed name: a program, a folder (by name or
 * C:\Portfolio path) or a project (by id or name). Case and a trailing
 * .exe or .com do not matter.
 */
export function resolveRunTarget(text: string): RunTarget | undefined {
  const name = text
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim()
    .toLowerCase()
    .replace(/\\+$/, "");
  if (!name) return undefined;
  const program = name.replace(/\.(exe|com)$/, "");
  if (Object.hasOwn(programs, program)) return programs[program];
  const path = /^c:\\portfolio(?:\\(.+))?$/.exec(name);
  const folderName = path ? (path[1] ?? "my projects") : name;
  const folder = folders.find(
    item => item.id === folderName || item.name.toLowerCase() === folderName,
  );
  if (folder) return { kind: "folder", id: folder.id };
  if (path) return undefined;
  const project = projects.find(
    item => item.id === name || item.name.toLowerCase() === name,
  );
  return project ? { kind: "project", id: project.id } : undefined;
}

/** Windows shows the last command again; so does this page. */
let lastEntry = "";
let runCount = 0;

/**
 * Start ▸ Run…: resolves the entry with resolveRunTarget and hands it to
 * open, or explains that nothing matched. Browse… opens My Projects.
 */
export async function runDialog({
  root,
  start,
  signal,
  open,
}: {
  root: HTMLElement;
  start: HTMLButtonElement;
  signal: AbortSignal;
  open: (target: RunTarget) => void;
}) {
  const id = `win-run-${++runCount}`;
  const body = document.createElement("div");
  body.className = "WinRun";
  body.innerHTML = `<p id="${id}-prompt">Type the name of a project, folder or file, and Portfolio 98 will open it for you.</p><div class="WinRunField"><label for="${id}">Open:</label><input id="${id}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"></div>`;
  const input = body.querySelector("input")!;
  input.value = lastEntry;
  let target: RunTarget | undefined;
  const pending = messageBox({
    title: "Run",
    icon: "terminal",
    body,
    role: "dialog",
    layout: "dialog",
    host: root,
    returnFocus: start,
    initialFocus: input,
    buttons: [
      { id: "ok", label: "OK", default: true },
      { id: "cancel", label: "Cancel", cancel: true },
      { id: "browse", label: "Browse…" },
    ],
    onButton: button => {
      if (button !== "ok") return;
      const entry = input.value.trim();
      if (!entry) return false;
      target = resolveRunTarget(entry);
      if (target) {
        lastEntry = entry;
        return;
      }
      void messageBox({
        title: entry,
        icon: "error",
        body: `Cannot find '${entry}'. Make sure you typed the name correctly, and then try again.`,
        host: root,
        returnFocus: input,
      }).then(() => input.select());
      return false;
    },
    signal,
  });
  body
    .closest(".WinMessageBox")
    ?.setAttribute("aria-describedby", `${id}-prompt`);
  // The last entry is selected, so typing replaces it.
  input.select();
  const result = await pending;
  if (signal.aborted) return;
  if (result === "browse") open({ kind: "folder", id: "projects" });
  else if (result === "ok" && target) open(target);
}
