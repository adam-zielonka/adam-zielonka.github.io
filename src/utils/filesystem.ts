import { projects } from "../data/projects.ts";
import { cd } from "./cd.ts";

export type VirtualFile =
  | { path: string; page: "home" | "about" | "contact" }
  | { path: string; page: "project"; projectId: string };

export const directories = [
  "/",
  "~",
  "~/projects",
  ...projects.map(project => `~/projects/${project.id}`),
];

export const files: VirtualFile[] = [
  { path: "~/README.md", page: "home" },
  { path: "~/about.md", page: "about" },
  { path: "~/contact.md", page: "contact" },
  ...projects.map(project => ({
    path: `~/projects/${project.id}/README.md`,
    page: "project" as const,
    projectId: project.id,
  })),
];

export function findFile(path: string) {
  return files.find(file => file.path === path);
}

export function listDirectory(path: string) {
  const prefix = path === "/" ? "/" : `${path}/`;
  const absolute = (value: string) => value.replace(/^~(?=\/|$)/, "/root");
  const base = absolute(prefix);
  return [
    ...directories.map(directory => ({
      path: absolute(directory),
      directory: true,
    })),
    ...files.map(file => ({ path: absolute(file.path), directory: false })),
  ]
    .filter(
      entry =>
        entry.path.startsWith(base) &&
        entry.path !== absolute(path) &&
        !entry.path.slice(base.length).includes("/"),
    )
    .map(entry => ({
      name: entry.path.slice(base.length),
      directory: entry.directory,
    }));
}

export function completeFiles(cwd: string, value: string): string[] {
  const base = value.slice(0, value.lastIndexOf("/") + 1);
  const directory = cd(cwd, base || ".").replace(/^~(?=\/|$)/, "/root");
  if (!directories.includes(cd(cwd, base || "."))) return [];
  const prefix = directory.endsWith("/") ? directory : `${directory}/`;
  return files
    .map(file => file.path.replace(/^~(?=\/|$)/, "/root"))
    .filter(path => path.startsWith(prefix))
    .map(path => base + path.slice(prefix.length))
    .filter(path => path.startsWith(value))
    .sort();
}
