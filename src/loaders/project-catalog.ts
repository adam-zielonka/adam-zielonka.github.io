import frontMatter from "front-matter";
import { marked } from "marked";
import { projectArt } from "../data/project-art.ts";
import type { Project, ProjectFiles } from "../types/project.ts";

const categories = new Set(["Tool", "App", "Game", "Experiment", "Learning"]);

// Shared by the client catalog and the Node HTML fallback. Project Markdown is
// author-written content, just like the Markdown commands (including HTML).
export function parseProjectCatalog(files: ProjectFiles): Project[] {
  const ids = new Set<string>();
  const orders = new Set<number>();
  return Object.entries(files)
    .map(([filename, markdown]): Project => {
      const fail = (message: string): never => {
        throw new Error(`${filename}: ${message}`);
      };
      const { attributes, body } =
        frontMatter<Record<string, unknown>>(markdown);
      const requiredString = (key: string): string => {
        const value = attributes[key];
        return typeof value === "string" && value.trim()
          ? value
          : fail(`expected a non-empty ${key}`);
      };
      const url = (key: string): string => {
        const value = requiredString(key);
        try {
          if (["https:", "http:"].includes(new URL(value).protocol))
            return value;
        } catch {
          // Report the field and source file below.
        }
        return fail(`expected an HTTP(S) URL for ${key}`);
      };
      const id = requiredString("id");
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || filename !== `${id}.md`)
        fail("id must match the Markdown filename and use a URL-safe slug");
      if (ids.has(id)) fail(`duplicate project id ${id}`);
      ids.add(id);
      const order = attributes.order;
      if (typeof order !== "number" || !Number.isInteger(order) || order < 1)
        return fail("order must be a positive integer");
      if (orders.has(order)) fail(`duplicate project order ${order}`);
      orders.add(order);
      const category = requiredString("category");
      if (!categories.has(category)) fail(`unknown category ${category}`);
      const stack = attributes.stack;
      if (
        !Array.isArray(stack) ||
        !stack.length ||
        stack.some(item => typeof item !== "string" || !item.trim())
      )
        return fail("stack must contain non-empty strings");
      if (
        attributes.featured !== undefined &&
        typeof attributes.featured !== "boolean"
      )
        fail("featured must be a boolean");
      if (!Object.hasOwn(projectArt, id)) fail(`missing ASCII art for ${id}`);
      if (!body.trim()) fail("expected a Markdown description");
      return {
        id,
        name: requiredString("name"),
        category: category as Project["category"],
        summary: requiredString("summary"),
        art: projectArt[id as keyof typeof projectArt],
        stack,
        source: url("source"),
        ...(attributes.demo === undefined ? {} : { demo: url("demo") }),
        ...(attributes.releases === undefined
          ? {}
          : { releases: url("releases") }),
        ...(attributes.featured === undefined
          ? {}
          : { featured: attributes.featured as boolean }),
        order,
        body,
        html: marked.parse(body, { async: false }),
      };
    })
    .sort((a, b) => a.order - b.order);
}
