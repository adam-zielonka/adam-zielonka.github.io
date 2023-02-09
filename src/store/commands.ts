import {makeAutoObservable} from 'mobx';
import {type CommandLine, parseLines} from '../utils.js';

export type CommandAttributes = {
	body: string;
	command: string;
	alias?: string[];
	help?: string;
};
type Files = Record<string, {default: CommandAttributes}>;
type HelpProperties = Required<Omit<CommandAttributes, 'body'>>;
export type CommandsLines = Record<string, CommandLine[]>;

function loadCommands(): CommandAttributes[] {
	const files = import.meta.glob('../commands/*.md', {eager: true}) as Files;
	return Object.keys(files).map(file => files[file].default);
}

function installCommands(files: CommandAttributes[]): {
	commands: CommandsLines;
	help: HelpProperties[];
} {
	const help: HelpProperties[] = [];
	const commands: CommandsLines = {};

	for (const attributes of files) {
		const lines = parseLines(attributes.body);
		commands[attributes.command] = lines;
		for (const alias of attributes.alias ?? []) {
			commands[alias] = lines;
		}

		if (attributes.help) {
			help.push({
				command: attributes.command,
				alias: attributes.alias ?? [],
				help: attributes.help,
			});
		}
	}

	return {commands, help};
}

export class Commands {
	private readonly commands: CommandsLines = {};
	private readonly help: HelpProperties[] = [];

	constructor() {
		makeAutoObservable(this);
		const {commands, help} = installCommands(loadCommands());
		this.commands = commands;
		this.help = help;
	}

	get helpLines(): string[] {
		return this.help.map(
			({command, alias, help}) => `**${[command, ...alias].join(' | ')}** - ${help}`,
		);
	}

	getLines(command: string): CommandLine[] {
		return this.commands[this.commands[command] ? command : 'notFound'];
	}

	getCompletions(command: string): string[] {
		return Object.keys(this.commands).filter(c => c.startsWith(command) && c !== command);
	}
}
