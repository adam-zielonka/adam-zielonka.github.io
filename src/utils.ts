export async function sleep(ms: number): Promise<void> {
	// eslint-disable-next-line no-promise-executor-return
	return new Promise(resolve => setTimeout(resolve, ms));
}

export class CommandLine {
	value = '';
	actions: Array<{
		namespace: string;
		key: string;
		value: string;
	}> = [];
}

export function parseLines(body: string): CommandLine[] {
	const array = body.split('\n').map(m => m.replace(/^ *$/, ''));

	const lines: CommandLine[] = [];
	let line: CommandLine = new CommandLine();

	for (const text of array) {
		const [match, value, namespace, key]
      = (/^\[(.*)]\(([a-z-]*):([a-z\d-]*)\)$/.exec(text)) ?? [];

		if (match) {
			line.actions.push({namespace, key, value});
		} else {
			line.value = text;
			lines.push(line);
			line = new CommandLine();
		}
	}

	lines[lines.length - 1]?.actions.push({namespace: 'ui', key: 'hide', value: ''});

	return lines;
}
