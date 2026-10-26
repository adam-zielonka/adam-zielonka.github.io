import type { ParsedLine } from "../types/parse";
import { parseInline } from "marked";

export function parseLines(body: string): ParsedLine[] {
  const array = body
    .trim()
    .split("\n")
    .map(m => m.replace(/^ *$/, ""));

  const lines: ParsedLine[] = [];
  let line: ParsedLine = { value: "", actions: [] };

  for (const text of array) {
    const [match, value, namespace, key] =
      text.match(/^\[(.*)\]\((sleep|system|ui|css):([a-z0-9-]*)\)$/) ?? [];

    if (match) {
      line.actions.push({ namespace, key, value });
    } else {
      line.value = parseInline(text || "&nbsp;", { async: false });
      lines.push(line);
      line = { value: "", actions: [] };
    }
  }

  if (line.actions.length) lines.push({ ...line, value: "" });

  return lines;
}
