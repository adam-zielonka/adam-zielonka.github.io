import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite";
import {
  loadProjectCatalog,
  projectsDirectory,
} from "../loaders/project-catalog-node.ts";

const loaderPath = fileURLToPath(
  new URL("../loaders/project-catalog-node.ts", import.meta.url),
);

// Keep the Node/config entry point usable without Vite while exposing exactly
// the same Markdown catalog to the browser. No generated files are committed.
export function projectContent(): Plugin {
  return {
    name: "project-content",
    enforce: "pre",
    load(id) {
      if (id !== loaderPath) return;
      const projects = loadProjectCatalog();
      for (const project of projects)
        this.addWatchFile(resolve(projectsDirectory, `${project.id}.md`));
      return `export function loadProjectCatalog() { return ${JSON.stringify(projects)}; }`;
    },
    configureServer(server) {
      server.watcher.add(projectsDirectory);
      const reload = (file: string) => {
        if (
          dirname(file) !== projectsDirectory.replace(/\/$/, "") ||
          !file.endsWith(".md")
        )
          return;
        const module = server.moduleGraph.getModuleById(loaderPath);
        if (module) server.moduleGraph.invalidateModule(module);
        // The filesystem and completion catalogs are initialized together with
        // the project data, so reload all consumers, including added/deleted files.
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", reload);
      server.watcher.on("change", reload);
      server.watcher.on("unlink", reload);
      server.httpServer?.once("close", () => {
        server.watcher.off("add", reload);
        server.watcher.off("change", reload);
        server.watcher.off("unlink", reload);
      });
    },
  };
}
