import { findProject, projects } from "../../data/projects";
import { windowsIcon } from "../../data/windows-icons";
import { escape } from "../../utils/escape";
import type { Project } from "../../types/project";
import { messageBox } from "./message-box";
import { folders } from "./shared";

/** One row of a property sheet: a label such as "Type:" and its value. */
export type PropertyRow = [label: string, value: string];

/**
 * A property sheet's General page: the item's icon and name above a list of
 * properties, in a modal box with OK.
 */
export function propertySheet({
  name,
  icon,
  rows,
}: {
  name: string;
  icon: string;
  rows: PropertyRow[];
}) {
  const body = document.createElement("div");
  body.className = "WinProperties";
  body.innerHTML = `<div class="WinPropertiesName">${windowsIcon(icon)}<span>${escape(name)}</span></div><dl>${rows
    .map(
      ([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`,
    )
    .join("")}</dl>`;
  return messageBox({
    title: `${name} Properties`,
    body,
    role: "dialog",
    layout: { sheet: "General" },
    buttons: [{ id: "ok", label: "OK", default: true, cancel: true }],
  });
}

/** The category folder a project lives in. */
export const folderOf = (project: Project) =>
  folders.find(folder => folder.categories.includes(project.category))!;

/** A project's place on Portfolio (C:). */
export const projectLocation = (project: Project) =>
  `C:\\Portfolio\\${folderOf(project).name}`;

/** What an icon is: its name, picture, type and properties. */
export type ItemInfo = {
  name: string;
  icon: string;
  type: string;
  rows: PropertyRow[];
};

/**
 * Describes a list item by its action (data-win-action). The drive in My
 * Computer shares its action with My Projects, so its name tells it apart.
 */
export function itemInfo(action: string, name?: string): ItemInfo | undefined {
  if (action.startsWith("project:")) {
    const project = findProject(action.slice(8));
    if (!project) return undefined;
    return {
      name: project.name,
      icon: project.id,
      type: project.category,
      rows: [
        ["Type:", project.category],
        ["Location:", projectLocation(project)],
        ["Technologies:", project.stack.join(", ")],
        ["Demo:", project.demo ? "Yes, runs in a window" : "No"],
        ["Description:", project.summary],
      ],
    };
  }
  if (action === "folder:projects" && name === "Portfolio (C:)")
    return {
      name,
      icon: "drive",
      type: "Local Disk",
      rows: [
        ["Type:", "Local Disk"],
        [
          "Contains:",
          `${projects.length} projects in ${folders.length - 1} folders`,
        ],
      ],
    };
  if (action.startsWith("folder:")) {
    const folder = folders.find(item => `folder:${item.id}` === action);
    if (!folder) return undefined;
    const count = projects.filter(
      project =>
        !folder.categories.length ||
        folder.categories.includes(project.category),
    ).length;
    return {
      name: folder.name,
      icon: folder.icon,
      type: "File Folder",
      rows: [
        ["Type:", "File Folder"],
        [
          "Location:",
          folder.id === "projects" ? "Portfolio (C:)" : "C:\\Portfolio",
        ],
        [
          "Contains:",
          folder.id === "projects"
            ? `${count} project(s), ${folders.length - 1} folder(s)`
            : `${count} project(s)`,
        ],
      ],
    };
  }
  const system: Record<string, ItemInfo> = {
    computer: {
      name: "My Computer",
      icon: "computer",
      type: "System Folder",
      rows: [
        ["Type:", "System Folder"],
        ["Location:", "Desktop"],
        ["Contains:", "1 drive: Portfolio (C:)"],
      ],
    },
    recycle: {
      name: "Recycle Bin",
      icon: "recycle",
      type: "System Folder",
      rows: [
        ["Type:", "System Folder"],
        ["Location:", "Desktop"],
        ["Contains:", "0 object(s)"],
      ],
    },
    about: {
      name: "About Adam.txt",
      icon: "notepad",
      type: "Text Document",
      rows: [
        ["Type:", "Text Document"],
        ["Location:", "C:\\Portfolio"],
        ["Opens with:", "Notepad"],
      ],
    },
    contact: {
      name: "Contact",
      icon: "mail",
      type: "Address Book",
      rows: [
        ["Type:", "Address Book"],
        ["Location:", "Desktop"],
        ["Contains:", "1 contact"],
      ],
    },
    exit: {
      name: "MS-DOS Prompt",
      icon: "terminal",
      type: "MS-DOS Program",
      rows: [
        ["Type:", "MS-DOS Program"],
        ["Location:", "Desktop"],
        [
          "Description:",
          "Opens the terminal. Type EXIT there to return to Portfolio 98.",
        ],
      ],
    },
  };
  return Object.hasOwn(system, action) ? system[action] : undefined;
}

/** Opens the property sheet of a list item. */
export function itemProperties(action: string, name?: string) {
  const info = itemInfo(action, name);
  if (info) void propertySheet(info);
}
