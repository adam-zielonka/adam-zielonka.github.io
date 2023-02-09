import {Commands} from './commands.js';
import {Completion} from './completion.js';
import {History} from './history.js';
import {Output} from './output.js';
import {Path} from './path.js';
import {Style} from './style.js';
import {System} from './system.js';

class Store {
	commands = new Commands();
	completion = new Completion();
	history = new History();
	output = new Output();
	path = new Path();
	style = new Style();
	system = new System();
}

export const store = new Store();
void store.system.start(['whoami', 'description']);

declare global {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface Window {
		store: Store;
	}
}
window.store = store;
