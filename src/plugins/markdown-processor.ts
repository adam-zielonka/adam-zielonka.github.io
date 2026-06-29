import { PluginOption } from "vite";
import frontMatter from "front-matter";
import { FrontMatter } from "../types/commands";
import { parseLines } from "../utils/parse";

export const markdownProcessor: PluginOption = {
  name: "markdown-processor",
  transform: (markdown, id) => {
    if (!id.endsWith(".md")) return null;

    const { attributes, body } = frontMatter<FrontMatter>(markdown);

    const lines = parseLines(body);

    const code = Object.entries({ ...attributes, lines })
      .map(([key, value]) => {
        return `export const ${key} = ${JSON.stringify(value)};`;
      })
      .join("\n");

    return {
      code,
      map: null,
    };
  },
};
