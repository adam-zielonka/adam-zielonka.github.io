// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, test } from "vitest";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const sassRequire = createRequire(require.resolve("sass"));
const watcherRequire = createRequire(sassRequire.resolve("@parcel/watcher"));
const tinyglobbyRequire = createRequire(viteRequire.resolve("tinyglobby"));
const fdirRequire = createRequire(tinyglobbyRequire.resolve("fdir"));
const matcherPaths = [
  viteRequire,
  vitestRequire,
  watcherRequire,
  tinyglobbyRequire,
  fdirRequire,
].map(load => load.resolve("picomatch"));

test("all build and test consumers resolve the same patched picomatch", () => {
  expect(new Set(matcherPaths).size).toBe(1);
});

test("hostile single-branch repeated globs finish within an isolated deadline", () => {
  // A separate process ensures a regression cannot hang Vitest or the build.
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const p = require(process.argv[1]);
    const patterns = ['+(*)a', '+(*a)', '*(a*)b', '+(a*b)c', '+(a*b*c)d'];
    const input = 'a'.repeat(10000) + '!';
    for (const options of [{}, {capture: true}, {fastpaths: false}, {windows: true}, {bash: true}]) {
      for (const pattern of patterns) {
        if (p.makeRe(pattern, options).test(input)) throw Error('Unexpected match: ' + pattern);
      }
    }
    console.log('completed');
  `,
      matcherPaths[0],
    ],
    { timeout: 3000, encoding: "utf8" },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("completed");
}, 10000);

test.each<[string, string[], string[]]>([
  ["+(*)c", ["abc", "c"], ["ab!"]],
  ["+(*a)", ["a", "aba", "aaa"], ["b", "aaa!"]],
  ["+(a*)", ["a", "aba"], ["b"]],
  ["+(a*b)", ["ab", "abab", "acbab"], ["a", "aba"]],
  ["+(a*b*c)", ["abc", "abcabc", "axbyc"], ["ab", "abc!"]],
  ["*(a*b)c", ["c", "abc", "ababc"], ["abb"]],
  ["x+(*a)y", ["xay", "xabaay"], ["xby"]],
  ["+(\\*a)", ["*a", "*a*a"], ["a", "aba"]],
  ["+(foo|bar)", ["foobar", "foofoo"], ["foo!"]],
  [
    "src/**/*.{ts,scss}",
    ["src/main.ts", "src/styles/windows.scss"],
    ["src/main.js"],
  ],
  ["../commands/*.md", ["../commands/windows.md"], ["../commands/windows.ts"]],
])("preserves matching for %s", (pattern, yes, no) => {
  const matcher = viteRequire("picomatch") as {
    isMatch(input: string, pattern: string): boolean;
  };
  for (const input of yes) expect(matcher.isMatch(input, pattern)).toBe(true);
  for (const input of no) expect(matcher.isMatch(input, pattern)).toBe(false);
});
