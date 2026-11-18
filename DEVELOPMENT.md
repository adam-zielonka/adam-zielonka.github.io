# Development

Use Node.js 24.22+ (24–26) and pnpm 12. The repository pins the verified package manager and runtime.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm audit --audit-level=high
pnpm test
pnpm lint
pnpm fmt:check
```

Pull requests run validation without deploying. Pages deployment is restricted to
the default branch. Dependabot checks compatible updates weekly; major updates
are reviewed separately.

The regression suite covers Markdown actions, quoted arguments, escaped output,
project routes, directory navigation, native keyboard behavior, command history
and interruption/skipping of animations. Use `pnpm build` for the production site, then inspect it with `pnpm preview`.

Project content lives in `src/data/projects.ts`; the same data generates the
static HTML fallback at build time. Fonts are included in `public/fonts` and
require no external runtime requests.

## Temporary picomatch patch

`pnpm-workspace.yaml` applies `patches/picomatch@4.0.7.patch` to every
transitive copy used by Vite, Vitest, tinyglobby/fdir and Sass's watcher.
The patch adapts the parser change proposed in upstream
[PR #254](https://github.com/micromatch/picomatch/pull/254), reviewed at
`c63a5bf4e61dbdb81bc41e97dc2616c30acce337`, with a stricter eligibility guard
added after local review. It removes the outer unbounded repetition around
a plain, path-separator-free single wildcard branch instead of producing
nested quantifiers. This mitigates the reported plain single-branch cases in
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
It is a local mitigation, not an official upstream security release.

`src/tests/picomatch.test.ts` checks consumer resolution, normal matching and
hostile inputs in a separate process with a deadline. Before patching, the
cases `+(*)a`, `+(*a)` and `*(a*)b` each exceeded 1.5 seconds with only 41 input
characters. The regression checks use 10,001 characters. Captured subgroup
values can change when repeated groups are flattened; application build
patterns do not rely on those captures. Explicitly setting
`maxExtglobRecursion: false` still disables this protection, as upstream
allows; do not use that option for untrusted patterns. This is not a claim
that every possible regular expression or glob is safe.

Branches containing slashes, backslashes, line terminators, character classes
or nested groups, and patterns with `regex: true`, keep upstream matching
behavior. Those forms are outside this mitigation. The tests include three
review counterexamples with bracketed/quoted path separators and a regex
quantifier, plus Bash-mode cases with all four JavaScript line terminators;
all must retain their original positive matches.

Scope: this patches the installed `picomatch` package. `oxfmt@0.75.0` also
contains a bundled copy of the analyzer inside its Prettier implementation;
that embedded code is not replaced by a `picomatch` dependency patch. Its
reachability from formatter inputs has not been established here.

GitHub withdrew GHSA-fc5q-39xc-vjpf on 2026-11-18. The npm registry still
returns the withdrawn record. The Pages workflow filters that ID from the
full dependency audit and runs a separate, unfiltered production audit.
Remove the filter once the npm advisory endpoint stops returning the record.
The local patch remains installed to prevent the covered slow matches.
