import { escape } from "./escape";

export function resolveConstants(
  html: string,
  values: { command: string; args: string[]; pwd: string },
): string {
  return html.replace(
    /<a href="const:(command|args|pwd)">([\s\S]*?)<\/a>/g,
    (_match, key: "command" | "args" | "pwd", fallback: string) => {
      const value = key === "args" ? values.args.join(" ") : values[key];
      return value ? escape(value) : fallback;
    },
  );
}
