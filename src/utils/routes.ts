import { parseArgs } from "./args";

export function commandFromHash(hash: string): string | undefined {
  const pages: Record<string, string> = {
    "#home": "whoami",
    "#projects": "projects",
    "#about": "about",
    "#contact": "contact",
  };
  if (Object.hasOwn(pages, hash)) return pages[hash];
  const project = hash.match(/^#project\/([a-z0-9-]+)$/);
  return project ? `project ${project[1]}` : undefined;
}

export function hashFromCommand(command: string): string | undefined {
  const [name, ...args] = parseArgs(command);
  if (name === "project" && args.length === 1 && /^[a-z0-9-]+$/.test(args[0]))
    return `#project/${args[0]}`;
  if (args.length) return undefined;
  if (name === "whoami" || name === "home") return "#home";
  if (["projects", "about", "contact"].includes(name)) return `#${name}`;
  return undefined;
}
