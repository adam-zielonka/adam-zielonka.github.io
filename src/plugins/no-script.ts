import type { PluginOption } from "vite";
import {
  renderHome,
  renderProjects,
  renderProject,
  renderAbout,
  renderContact,
} from "../utils/portfolio.ts";
import { loadProjectCatalog } from "../loaders/project-catalog-node.ts";

function staticContent(html: string): string {
  return html
    .replace(
      /<button[^>]*data-command="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g,
      (_match, command: string, label: string) => {
        const route = command.startsWith("project ")
          ? `project/${command.slice(8)}`
          : command;
        return ["projects", "about", "contact"].includes(route) ||
          route.startsWith("project/")
          ? `<a class="CommandLink" href="#${route}">${label}</a>`
          : "";
      },
    )
    .replace(/<a[^>]*data-copy-link[^>]*>[\s\S]*?<\/a>/g, "");
}

export function renderFallback(html: string): string {
  const projects = loadProjectCatalog();
  const details = projects
    .map(
      project =>
        `<section id="project/${project.id}">${renderProject(project.id, projects)}</section>`,
    )
    .join("");
  const home = renderHome(
    projects.filter(project => project.featured),
    {
      randomize: false,
    },
  );
  const content = `<div class="FallbackContent"><section id="home">${home}</section><p class="OutputIntro">The terminal needs JavaScript. You can still browse every project and find contact links below.</p><section id="projects">${renderProjects(projects)}</section><section id="about">${renderAbout()}</section><section id="contact">${renderContact()}</section>${details}</div>`;
  return html.replace("<portfolio-fallback />", staticContent(content));
}

// Keep useful, linked content available if JavaScript is disabled or cannot load.
export const noScript: PluginOption = {
  name: "portfolio-fallback",
  transformIndexHtml: renderFallback,
};
