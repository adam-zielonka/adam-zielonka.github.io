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
