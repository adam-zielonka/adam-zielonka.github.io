import {makeAutoObservable} from 'mobx';

export class History {
	private readonly history: string[] = [];
	private position = 0;
	private temporaryValue = '';

	constructor() {
		makeAutoObservable(this);
	}

	get value(): string {
		return this.history[this.position] || this.temporaryValue;
	}

	get lastCommand(): string {
		return this.history[this.history.length - 1] || '';
	}

	set(value: string): void {
		this.position = this.history.length;
		this.temporaryValue = value;
	}

	add(): void {
		if (this.value && this.value !== this.history[this.history.length - 1]) {
			this.history.push(this.value);
		}

		this.set('');
	}

	up(): void {
		if (this.position - 1 >= 0) {
			--this.position;
		}
	}

	down(): void {
		if (this.position + 1 <= this.history.length) {
			++this.position;
		}
	}
}
