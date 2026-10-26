import type { PluginOption } from "vite";
import {
  renderHome,
  renderProjects,
  renderProject,
  renderAbout,
  renderContact,
} from "../utils/portfolio.ts";
import { projects } from "../data/projects.ts";

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

// Keep useful, linked content available if JavaScript is disabled or cannot load.
export const noScript: PluginOption = {
  name: "portfolio-fallback",
  transformIndexHtml(html) {
    const details = projects
      .map(
        project =>
          `<section id="project/${project.id}">${renderProject(project.id)}</section>`,
      )
      .join("");
    const content = `<div class="FallbackContent"><section id="home">${renderHome()}</section><p class="OutputIntro">The terminal needs JavaScript. You can still browse every project and find contact links below.</p><section id="projects">${renderProjects()}</section><section id="about">${renderAbout()}</section><section id="contact">${renderContact()}</section>${details}</div>`;
    return html.replace("<portfolio-fallback />", staticContent(content));
  },
};
