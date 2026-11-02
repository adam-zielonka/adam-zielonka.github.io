import type { ProjectArt } from "../data/project-art.ts";

export type Project = {
  id: string;
  name: string;
  category: "Tool" | "App" | "Game" | "Experiment" | "Learning";
  summary: string;
  art: ProjectArt;
  stack: string[];
  source: string;
  demo?: string;
  releases?: string;
  featured?: boolean;
  order: number;
  body: string;
  html: string;
};

export type ProjectFiles = Record<string, string>;
