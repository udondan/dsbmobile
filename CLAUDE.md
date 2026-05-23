# Agent Guidelines for dsbmobile-mcp

## Project Overview

A Model Context Protocol (MCP) server for the DSBmobile school substitution service. Written in TypeScript, runs on Bun, and exposes 4 MCP tools: `get_substitutions`, `get_documents`, `get_news`, `get_timetables`.

## Build / Lint / Test Commands

The primary task runner is `mise`. All tasks can also be run directly with `bun`.

### Common tasks

```sh
# Build (TypeScript compile)
mise run build
bun run build

# Development mode (auto-restart on changes)
mise run dev

# Start server
mise run start

# Lint
mise run lint
bunx eslint src tests

# Lint with auto-fix
mise run lint:fix
bunx eslint src tests --fix

# Open MCP Inspector (interactive tool tester)
mise run inspect
```

### Tests

```sh
# Run all unit tests
mise run test
bun test tests/parser.test.ts tests/tools.test.ts

# Run a single test file
bun test tests/parser.test.ts
bun test tests/tools.test.ts
bun test tests/shim.test.ts

# Run a single test by name pattern
bun test tests/parser.test.ts --test-name-pattern "parses plan date"

# Run integration tests (requires live DSB credentials)
DSB_USERNAME=your_user DSB_PASSWORD=your_pass bun test tests/api.integration.test.ts
DSB_USERNAME=... DSB_PASSWORD=... mise run test:integration
```

Note: `tests/shim.test.ts` is intentionally excluded from `mise run test` and CI — run it manually when needed.

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
- Target: `ES2022`, module system: `Node16`
- Always use explicit types; avoid `any`
- Use `import type { ... }` for type-only imports
- All imports use `.js` extension (even for `.ts` source files) — required by Node16 ESM:
  ```ts
  import { DsbmobileClient } from '../services/dsbmobile.js';
  import type { SubstitutionPlan } from '../types.js';
  ```

### Import order

1. Third-party packages (e.g. `@modelcontextprotocol/sdk`, `axios`, `zod`)
2. Internal imports (relative paths with `.js` extension)
3. `import type` for type-only imports (can be interleaved with the above, grouped by origin)

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
- Token caching with lazy authentication via `ensureAuthenticated()` guard pattern
- Token reused for the lifetime of the server process

### HTML parsing

HTML is parsed with regex + `matchAll` — no DOM parser or third-party HTML library (no cheerio). HTML entities are decoded via the custom `decodeHtmlEntities()` helper.

## Project Structure

```
src/
  index.ts           # Entry point: MCP server setup, env validation
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
tests/
  fixtures/          # HTML fixtures for parser tests
  parser.test.ts     # Unit tests for HTML parser
  tools.test.ts      # Unit tests for all 4 MCP tools
  api.integration.test.ts  # Integration tests (live API)
  shim.test.ts       # Structural tests for bin/dsbmobile-mcp-server.js
bin/
  dsbmobile-mcp-server.js  # Node.js shim that spawns bun
```

## Git Workflow

- Never commit directly to the `main` branch
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.
- Always show `git diff --cached` and confirm the commit message before committing
- Never push without explicit user confirmation
