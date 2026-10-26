import { CommandsLines, HelpProperties } from "../types/commands";
import { ParsedLine } from "../types/parse";
import { importCommands } from "../utils/commands";
import { commandLink } from "../utils/portfolio";
import { escape } from "../utils/escape";
import { projects } from "../data/projects";
import { completeFiles } from "../utils/filesystem";

export class Commands {
  private commands: CommandsLines;
  private help: HelpProperties[];

  constructor() {
    const installed = importCommands();
    this.commands = installed.commands;
    this.help = installed.help;
  }

  get helpLines(): string[] {
    return [
      '<p class="OutputIntro">Choose a command or type one below. Tab completes a name; Shift+Tab moves out of the input.</p>',
      `<div class="HelpList">${this.help.map(({ command, alias, help }) => `<div>${commandLink(command, command)}<span>${escape(help)}${alias.length ? ` <small>(${alias.map(escape).join(", ")})</small>` : ""}</span></div>`).join("")}</div>`,
      '<p class="OutputNote">↑ ↓ history · Ctrl+C interrupt · Escape dismiss suggestions. Also try: <code>ls</code>, <code>cat about.md</code> or <code>cd projects</code>.</p>',
    ];
  }

  getLines(command: string): ParsedLine[] {
    return this.commands[
      Object.hasOwn(this.commands, command) ? command : "not-found"
    ];
  }

  getCompletions(value: string, cwd = "~"): string[] {
    const cat = value.match(/^(cat\s+(?:\S+\s+)*)(\S*)$/);
    if (cat)
      return completeFiles(cwd, cat[2])
        .map(path => cat[1] + path)
        .filter(command => command !== value);
    if (value.startsWith("project "))
      return projects
        .map(project => `project ${project.id}`)
        .filter(command => command.startsWith(value) && command !== value);
    return Object.keys(this.commands)
      .filter(
        command =>
          !["not-found", "panic"].includes(command) &&
          command.startsWith(value) &&
          command !== value,
      )
      .sort();
  }
}
