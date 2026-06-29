import { ParsedLine } from "./parse";

export type CommandAttributes = {
  command: string;
  alias?: string[];
  help?: string;
  lines: ParsedLine[];
};

export type FrontMatter = Omit<CommandAttributes, "lines">;

export type HelpProperties = Required<FrontMatter>;

export type CommandsLines = Record<string, ParsedLine[]>;
