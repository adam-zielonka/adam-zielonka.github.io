/* eslint-disable no-await-in-loop */
import {makeAutoObservable} from 'mobx';
import {sleep} from '../utils.js';
import {store} from './store.js';

function system(sysCommand: string, args: string[]): string[] {
	switch (sysCommand) {
		case 'clear': {
			store.output.clear();
			return [];
		}

		case 'shutdown': {
			store.system.setShutdown();
			return [];
		}

		case 'freeze': {
			store.system.setFreeze();
			return [];
		}

		case 'echo': {
			return [args.join(' ')];
		}

		case 'font': {
			return store.style.set(args.join(' '));
		}

		case 'cd': {
			store.path.cd(args.join(' '));
			return [];
		}

		case 'pwd': {
			return [store.path.pwd];
		}

		case 'help': {
			return store.commands.helpLines;
		}

		default: {
			return [];
		}
	}
}

function parseArgs(commandArgs: string): string[] {
	return [...commandArgs.matchAll(/["']([^"']*)["']| ?([^"' ]+) ?/g)]
		.map(m => m[1] || m[2])
		.filter(Boolean);
}

export class Style {
	color = '';
	fontWeight = '';
	fontSize = '';
}

async function process(commandArgs: string): Promise<void> {
	const [command, ...args] = parseArgs(commandArgs);
	if (!command) {
		return;
	}

	const style: Style = new Style();

	for (const line of store.commands.getLines(command)) {
		let animate = false;
		let hide = false;

		for (const action of line.actions) {
			switch (action.namespace) {
				case 'sleep': {
					await sleep(Number(action.key));
					continue;
				}

				case 'system': {
					for (const systemLine of system(action.key, args)) {
						await store.output.processLine({value: systemLine, style});
					}

					continue;
				}

				case 'ui': {
					switch (action.key) {
						case 'color': {
							style.color = action.value;
							continue;
						}

						case 'font-weight': {
							style.fontWeight = action.value;
							continue;
						}

						case 'font-size': {
							style.fontSize = action.value;
							continue;
						}

						case 'animate': {
							animate = true;
							continue;
						}

						case 'hide': {
							hide = true;
							continue;
						}

						default:
					}

					continue;
				}

				default:
			}
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		!hide && (await store.output.processLine({value: line.value, style}, animate));
	}
}

export class System {
	private state: 'processing' | 'shutdown' | 'freeze' | '' = '';

	constructor() {
		makeAutoObservable(this);
	}

	get shutdown(): boolean {
		return this.state === 'shutdown';
	}

	get isInputAllowed(): boolean {
		return !['freeze', 'processing'].includes(this.state);
	}

	startProcessing(): void {
		this.state = 'processing';
	}

	stopProcessing(): void {
		if (this.state === 'processing') {
			this.state = '';
		}
	}

	setShutdown(): void {
		this.state = 'shutdown';
	}

	setFreeze(): void {
		this.state = 'freeze';
	}

	async addCommand(command: string): Promise<void> {
		store.system.startProcessing();
		await store.output.processCommandLine(command);
		await process(command);
		store.system.stopProcessing();
	}

	async start(startCommands: string[]): Promise<void> {
		store.system.startProcessing();
		for (const command of startCommands) {
			store.history.set(command);
			store.history.add();
			await store.output.processCommandLine(command, true);
			await process(command);
		}

		store.system.stopProcessing();
	}
}
