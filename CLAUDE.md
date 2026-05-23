# Agent Guidelines for @udondan/dsbmobile

## Project Overview

A three-interface package for the DSBmobile school substitution service. Written in TypeScript, compiled to `dist/` with `tsc`, and runs on Node.js ≥ 22.

- **SDK** — importable library: `import { DsbmobileClient } from '@udondan/dsbmobile'`
- **CLI** — `dsbmobile` command with subcommands: `mcp`, `substitutions`, `timetables`, `news`, `documents`
- **MCP server** — `dsbmobile mcp` exposes 4 tools: `get_substitutions`, `get_documents`, `get_news`, `get_timetables`

## Build / Lint / Test Commands

The primary task runner is `mise`. All tasks can also be run directly.

### Common tasks

```sh
# Build (TypeScript compile to dist/)
mise run build
bun run build

# Development mode (recompile on changes)
mise run dev

# Start MCP server
mise run start
node dist/cli.js mcp

# Lint
mise run lint
bunx eslint src/ tests/

# Lint with auto-fix
mise run lint:fix
bunx eslint --fix src/ tests/

# Open MCP Inspector (interactive tool tester)
mise run inspect
```

### Tests

```sh
# Run all unit tests (compiles first via pretest)
mise run test
bun run test

# Run a single test file
npx vitest run tests/parser.test.ts
npx vitest run tests/tools.test.ts

# Run a single test by name pattern
npx vitest run tests/parser.test.ts -t "parses plan date"

# Run integration tests (requires live DSB credentials)
DSB_USERNAME=your_user DSB_PASSWORD=your_pass npx vitest run tests/api.integration.test.ts
DSB_USERNAME=... DSB_PASSWORD=... mise run test:integration
```

Note: `tests/shim.test.ts` verifies `dist/` output structure — it requires a prior `tsc` build, which `"pretest": "tsc"` handles automatically.

## Code Style

### Formatting (`.prettierrc.json`)

- **Semicolons**: required
- **Quotes**: single quotes
- **Trailing commas**: always (including function parameters)
- **Print width**: 100 characters
- **Indent**: 2 spaces

Run `mise run lint:fix` to auto-format.

### TypeScript

- **Strict mode** is enabled (`"strict": true` in `tsconfig.json`)
- Target: `ES2022`, module system: `NodeNext`
- Runtime: Node.js ≥ 22 — compiled output in `dist/`
- Always use explicit types; avoid `any`
- Use `import type { ... }` for type-only imports
- All imports use `.js` extension (even for `.ts` source files) — required by NodeNext ESM:
  ```ts
  import { DsbmobileClient } from '../services/dsbmobile.js';
  import type { SubstitutionPlan } from '../types.js';
  ```

### Import order

1. Node built-ins (`node:module`, `node:fs`, etc.)
2. Third-party packages (e.g. `@modelcontextprotocol/sdk`, `axios`, `commander`, `zod`)
3. Internal imports (relative paths with `.js` extension)
4. `import type` for type-only imports (can be interleaved with the above, grouped by origin)

### Naming conventions

| Construct               | Convention             | Example                               |
| ----------------------- | ---------------------- | ------------------------------------- |
| Files                   | `camelCase.ts`         | `dsbmobile.ts`, `errors.ts`           |
| Classes                 | `PascalCase`           | `DsbmobileClient`                     |
| Interfaces / Types      | `PascalCase`           | `SubstitutionPlan`, `DsbItem`         |
| Functions               | `camelCase`            | `registerSubstitutionsTool`           |
| Constants               | `SCREAMING_SNAKE_CASE` | `DSB_API_BASE_URL`, `CHARACTER_LIMIT` |
| Variables               | `camelCase`            | `planDate`, `htmlContent`             |
| Reserved-word conflicts | unicorn suffix         | `arguments_`, `function_`             |

Do not use `#` private fields — use TypeScript `private` keyword instead.

### ESLint rules

The config (`eslint.config.js`) enables:

- **ESLint recommended**
- **TypeScript ESLint** `recommendedTypeChecked` + `stylisticTypeChecked` (type-aware rules)
- **eslint-plugin-unicorn** `flat/recommended` — enforces modern JS idioms:
  - Use `replaceAll` instead of `replace` with regex
  - Use `Array.from` instead of spread on iterables
  - Prefer `for...of` over indexed loops
  - Avoid abbreviations (prefer `arguments_` over `args`)
- **Prettier** enforced as an ESLint error

Fix linting issues before committing. Prettier violations are errors, not warnings.

## Patterns and Architecture

### SDK (`src/index.ts`)

Barrel export — `DsbmobileClient`, `DsbmobileConfig`, `parseSubstitutionHtml`, and all public types. The class takes explicit credentials via constructor:

```ts
const client = new DsbmobileClient({ username: 'user', password: 'pass' });
```

### CLI (`src/cli.ts`)

Entry point with `#!/usr/bin/env node` shebang. Uses `commander` for argument parsing. Reads credentials from env vars (`DSB_USERNAME`, `DSB_PASSWORD`) via `loadClient()` and calls the appropriate SDK method or `startMcpServer()`.

### MCP server (`src/mcp.ts`)

Exports `startMcpServer(client: DsbmobileClient): Promise<void>`. Creates a `McpServer`, registers all 4 tools, connects a `StdioServerTransport`. Called by the CLI `mcp` subcommand.

### Async / await

Use `async/await` exclusively. Never use `.then()/.catch()` chains.

### Error handling

**In service methods** (`src/services/`): catch, check, and re-throw. Already-formatted errors are passed through; raw errors are wrapped:

```ts
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Error:')) {
    throw error;
  }
  throw new Error(handleApiError(error), { cause: error });
}
```

**In MCP tool handlers** (`src/tools/`): catch and return an MCP error response instead of throwing:

```ts
} catch (error) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  return { content: [{ type: 'text', text: message }], isError: true };
}
```

**Silent partial failure**: when fetching multiple pages, individual failures are silently skipped with empty `catch {}` to avoid aborting the whole request.

### MCP tool response format

All tools return both human-readable text and structured JSON:

```ts
return {
  content: [{ type: 'text', text: finalText }],
  structuredContent: output,
};
```

Responses are truncated at `CHARACTER_LIMIT` (25,000 chars) with an explanatory note appended.

### Zod schemas

Tool input validation uses Zod:

- No-argument tools: `z.object({}).strict()`
- Optional string fields: `z.string().optional().describe('...')`

### Class design

- Single class `DsbmobileClient` with `private readonly` fields
- Constructor takes `DsbmobileConfig { username, password }` — no env var reading
- Token caching with lazy authentication via `ensureAuthenticated()` guard pattern
- Token reused for the lifetime of the client instance

### HTML parsing

HTML is parsed with regex + `matchAll` — no DOM parser or third-party HTML library (no cheerio). HTML entities are decoded via the custom `decodeHtmlEntities()` helper.

## Project Structure

```
src/
  index.ts           # SDK entry point: exports DsbmobileClient + types
  cli.ts             # CLI entry point with shebang (commander)
  mcp.ts             # MCP server function: startMcpServer()
  constants.ts       # API URLs, env var names, limits
  types.ts           # All TypeScript interfaces
  services/
    dsbmobile.ts     # DsbmobileClient + parseSubstitutionHtml()
  tools/
    documents.ts     # get_documents tool
    news.ts          # get_news tool
    substitutions.ts # get_substitutions tool
    timetables.ts    # get_timetables tool
  utils/
    errors.ts        # Error message helpers
dist/                # Compiled output (generated by tsc)
tests/
  fixtures/          # HTML fixtures for parser tests
  parser.test.ts     # Unit tests for HTML parser
  tools.test.ts      # Unit tests for all 4 MCP tools
  api.integration.test.ts  # Integration tests (live API)
  shim.test.ts       # Structural tests for dist/ output
```

## Git Workflow

- Never commit directly to the `main` branch
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.
- Always show `git diff --cached` and confirm the commit message before committing
- Never push without explicit user confirmation
