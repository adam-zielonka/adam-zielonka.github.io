import { loadProjectCatalog } from "../loaders/project-catalog-node.ts";
export type { Project } from "../types/project.ts";

export const projects = loadProjectCatalog();

export const findProject = (id: string) =>
  projects.find(project => project.id === id);
