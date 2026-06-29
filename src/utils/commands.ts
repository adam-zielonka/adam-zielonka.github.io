import {
  CommandAttributes,
  CommandsLines,
  HelpProperties,
} from "../types/commands";

export function importCommands() {
  return installCommands(loadCommandsFiles());
}

function loadCommandsFiles(): CommandAttributes[] {
  const files = import.meta.glob<CommandAttributes>("../commands/*.md", {
    eager: true,
  });
  return Object.values(files);
}

function installCommands(files: CommandAttributes[]): {
  commands: CommandsLines;
  help: HelpProperties[];
} {
  const help: HelpProperties[] = [];
  const commands: CommandsLines = {};

  for (const attributes of files) {
    commands[attributes.command] = attributes.lines;
    for (const alias of attributes.alias ?? []) {
      commands[alias] = attributes.lines;
    }
    if (attributes.help) {
      help.push({
        command: attributes.command,
        alias: attributes.alias ?? [],
        help: attributes.help,
      });
    }
  }

  return { commands, help };
}
