export function parseArgs(value: string): string[] {
  return Array.from(
    value.matchAll(/"([^"]*)"|'([^']*)'|([^\s"']+)/g),
    match => match[1] ?? match[2] ?? match[3],
  );
}
