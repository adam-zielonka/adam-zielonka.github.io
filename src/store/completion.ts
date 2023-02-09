import {makeAutoObservable} from 'mobx';
import {store} from './store.js';

export class Completion {
	index = -1;

	constructor() {
		makeAutoObservable(this);
	}

	get list(): string[] {
		return store.commands.getCompletions(store.history.value);
	}

	get isVisible(): boolean {
		return this.index >= 0;
	}

	get selected(): string | undefined {
		return this.list[this.index];
	}

	get theOne(): string | undefined {
		if (this.list.length !== 1) {
			return undefined;
		}

		return this.list[0];
	}

	reset(): void {
		this.index = -1;
	}

	next(): void {
		if (this.list.length === 0) {
			this.reset();
			return;
		}

		this.index = (this.index + 1) % this.list.length;
	}
}
