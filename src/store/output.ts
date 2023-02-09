import {makeAutoObservable} from 'mobx';
import {sleep} from '../utils.js';
import {store} from './store.js';
import {type Style} from './system.js';

type TextLine = {
	value: string;
	style: Style;
};

type CommandLine = {
	value: string;
	blink: boolean;
	path: string;
};

export type OutputLine = TextLine | CommandLine;

export function isCommandLine(line: OutputLine): line is CommandLine {
	return (line as CommandLine).path !== undefined;
}

export class Output {
	lines: OutputLine[] = [];

	constructor() {
		makeAutoObservable(this);
	}

	push(...line: OutputLine[]): number {
		const number = this.lines.push(...line);
		return number;
	}

	clear(): void {
		this.lines.splice(0, this.lines.length);
	}

	updateLast(line: OutputLine): void {
		if (this.lines.length > 0) {
			this.lines[this.lines.length - 1] = line;
		}
	}

	async processLine(line: TextLine, animate = false): Promise<void> {
		await sleep(20);

		const value = line.value.replace(/\[.*]\(const:command\)/, store.history.lastCommand);

		const textLine: TextLine = {
			...line,
			value,
		};

		if (!animate) {
			this.push(textLine);
			return;
		}

		textLine.value = '';
		this.push(textLine);
		for (const letter of value) {
			// eslint-disable-next-line no-await-in-loop
			await sleep(100);
			textLine.value += letter;
			this.updateLast(textLine);
		}
	}

	async processCommandLine(command: string, animate = false): Promise<void> {
		const commandLine: CommandLine = {
			value: command,
			blink: false,
			path: store.path.value,
		};

		if (!animate) {
			this.push(commandLine);
			return;
		}

		commandLine.value = '';
		commandLine.blink = true;
		this.push(commandLine);
		for (const letter of command) {
			// eslint-disable-next-line no-await-in-loop
			await sleep(50);
			commandLine.value += letter;
			this.updateLast(commandLine);
		}

		await sleep(1000);
		commandLine.blink = false;
		this.updateLast(commandLine);
	}
}
