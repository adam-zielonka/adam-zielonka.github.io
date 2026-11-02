import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { projects, findProject } from "../data/projects.ts";
import { parseProjectCatalog } from "../loaders/project-catalog.ts";
import { renderFallback } from "../plugins/no-script.ts";
import {
  renderCat,
  renderHome,
  renderProject,
  renderProjects,
} from "../utils/portfolio.ts";

// Use an independent fixture so editing portfolio copy never requires test changes.
const source = `---
id: "server-status"
name: "Server Status"
category: "Tool"
summary: "Example project."
stack: ["Go", "React", "TypeScript"]
source: "https://github.com/adam-zielonka/server-status"
featured: true
order: 1
---

### The idea

An example description.

### How it works

Built from Markdown.
`;
const fixture = (markdown = source) => ({ "server-status.md": markdown });
const element = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
};

describe("Markdown project migration", () => {
  test("loads the catalog and featured projects from Markdown", () => {
    expect(findProject("missing")).toBeUndefined();
    expect(
      projects.filter(project => project.featured).map(project => project.id),
    ).toEqual(["server-status", "questions", "game-of-life"]);
    expect(element(renderHome()).querySelectorAll(".ProjectRow")).toHaveLength(
      3,
    );
    expect(
      element(renderProjects()).querySelectorAll(".ProjectRow"),
    ).toHaveLength(projects.length);
  });

  test("shares project descriptions, links and ASCII art with cat and the static fallback", () => {
    const staticPage = element(renderFallback("<portfolio-fallback />"));
    expect(staticPage.querySelectorAll(".ProjectDetail")).toHaveLength(
      projects.length,
    );
    expect(
      staticPage.querySelectorAll("button, [data-copy-link]"),
    ).toHaveLength(0);
    for (const project of projects) {
      const interactive = renderProject(project.id);
      expect(renderCat("~", [`projects/${project.id}/README.md`])).toEqual([
        interactive,
      ]);
      const detail = staticPage.querySelector(`[id="project/${project.id}"]`)!;
      expect(detail.querySelector(".ProjectArt pre")?.textContent).toBe(
        project.art.drawing,
      );
      for (const section of element(project.html).children)
        expect(detail.innerHTML, project.id).toContain(section.outerHTML);
      for (const url of [project.source, project.demo, project.releases].filter(
        Boolean,
      ))
        expect(
          detail.querySelector(`a[href="${url}"]`),
          `${project.id}: ${url}`,
        ).not.toBeNull();
    }
  });
});

describe("project Markdown loading", () => {
  test("renders full Markdown blocks, lists, links and emphasis", () => {
    const body =
      "### The idea\n\nA **strong** idea with *emphasis*.\n\n- First item\n- [A link](https://example.com/)\n\n### How it works\n\n1. One\n2. Two\n";
    const markdown = source.slice(0, source.indexOf("### The idea")) + body;
    const catalog = parseProjectCatalog(fixture(markdown));
    expect(catalog[0].body).toBe(body);
    const detail = element(renderProject("server-status", catalog));
    expect(detail.querySelector("strong")?.textContent).toBe("strong");
    expect(detail.querySelector("em")?.textContent).toBe("emphasis");
    expect(detail.querySelectorAll("ul > li")).toHaveLength(2);
    expect(detail.querySelectorAll("ol > li")).toHaveLength(2);
    expect(detail.querySelector("li a")?.getAttribute("href")).toBe(
      "https://example.com/",
    );
  });

  test("sorts by front matter order rather than filename or discovery order", () => {
    const questions = readFileSync(
      resolve("src/projects/questions.md"),
      "utf8",
    );
    expect(
      parseProjectCatalog({ "questions.md": questions, ...fixture() }).map(
        project => project.id,
      ),
    ).toEqual(["server-status", "questions"]);
  });

  test.each([
    [source.replace('id: "server-status"', 'id: "other"'), "id must match"],
    [
      source.replace('category: "Tool"', 'category: "Other"'),
      "unknown category",
    ],
    [
      source.replace("order: 1", "order: 0"),
      "order must be a positive integer",
    ],
    [
      source.replace('name: "Server Status"', "name: 42"),
      "expected a non-empty name",
    ],
    [
      source.replace('stack: ["Go", "React", "TypeScript"]', "stack: []"),
      "stack must contain",
    ],
    [
      source.replace("featured: true", 'featured: "true"'),
      "featured must be a boolean",
    ],
    [
      source.replace(
        'source: "https://github.com/adam-zielonka/server-status"',
        'source: "javascript:alert(1)"',
      ),
      "expected an HTTP(S) URL",
    ],
    [
      source.slice(0, source.indexOf("### The idea")),
      "expected a Markdown description",
    ],
  ])(
    "reports invalid metadata with its source filename (%#)",
    (markdown, message) => {
      expect(() => parseProjectCatalog(fixture(markdown))).toThrow(
        `server-status.md: ${message}`,
      );
    },
  );

  test("rejects ambiguous ordering", () => {
    const questions = readFileSync(
      resolve("src/projects/questions.md"),
      "utf8",
    ).replace("order: 2", "order: 1");
    expect(() =>
      parseProjectCatalog({ ...fixture(), "questions.md": questions }),
    ).toThrow("duplicate project order 1");
  });
});
