import {makeAutoObservable} from 'mobx';

function cd(dir: string, newDir: string): string {
	switch (newDir) {
		case '~': {
			return '~';
		}

		case '.': {
			return dir;
		}

		case '': {
			return dir;
		}

		case '..': {
			return dir.split('/').slice(0, -1).join('/') || '/';
		}

		default: {
			return (newDir.startsWith('/') ? newDir : `${dir}/${newDir}`)
				.replace(/\/\//, '/')
				.replace(/.\/$/, '')
				.replace(/^\/root/, '~');
		}
	}
}

export class Path {
	value = '~';

	constructor() {
		makeAutoObservable(this);
	}

	get pwd(): string {
		return this.value.replace(/^~/, '/root');
	}

	cd(newDir: string): void {
		this.value = cd(this.value, newDir);
	}
}
