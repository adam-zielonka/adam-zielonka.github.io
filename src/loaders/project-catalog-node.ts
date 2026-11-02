// Node entry point. The projectContent Vite plugin supplies these same sources
// as a browser module; node:fs never enters the client bundle.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseProjectCatalog } from "./project-catalog.ts";

export const projectsDirectory = fileURLToPath(
  new URL("../projects/", import.meta.url),
);

export function loadProjectCatalog(directory = projectsDirectory) {
  return parseProjectCatalog(
    Object.fromEntries(
      readdirSync(directory)
        .filter(name => name.endsWith(".md"))
        .sort()
        .map(name => [name, readFileSync(join(directory, name), "utf8")]),
    ),
  );
}
