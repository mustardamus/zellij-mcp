# zellij-mcp — Plan

## Next: Compound / High-Level Tools

Build composite tools that chain multiple primitives. Only after primitives are
battle-tested — the focus-based model is inherently stateful and timing-sensitive.

| Tool Name      | Composes                                             | Purpose                                      |
| -------------- | ---------------------------------------------------- | -------------------------------------------- |
| `run_in_tab`   | `go_to_tab` → `write_to_pane` → wait → `read_pane`  | Go to a tab, run a command, return output    |
| `check_server` | `go_to_tab("server")` → `read_pane`                 | Quick check on the dev server status         |
| `run_and_read` | `run_command` (floating) → wait → `read_pane` → `close_pane` | Run a one-off command and return output |

## TODO

- **`dumpPath()` race condition** — Uses `Date.now()` for temp file names. Two concurrent `read_pane` calls in the same millisecond collide. Use `crypto.randomUUID()`.
- **Structured error handling** — Tool callbacks let raw exceptions bubble to the MCP transport. Wrap handlers with `try/catch` and return `isError: true` responses with clean messages.
- **Extract `withTabTarget` helper** — `rename_tab` and `close_tab` duplicate focus-preservation logic inline. Extract a shared helper to reduce divergence risk.
- **Make post-action delay configurable** — The 60ms `POST_ACTION_DELAY_MS` is hardcoded. Add `ZELLIJ_MCP_DELAY_MS` env var for slow environments (e.g. SSH).
- **Pin `@types/bun`** — Currently set to `latest`, which breaks reproducibility. Pin to an exact version.
- **Add `version` to `package.json`** — `index.ts` hardcodes `"1.0.0"` but `package.json` has no version field. Read it from the manifest.
- **Read `BIN_PATH` at call time** — `ZELLIJ_MCP_BIN` is read once at module load. Move to a getter function like `getSession()` for consistency.
- **Fix lint warnings in tests** — 16 `noNonNullAssertion` warnings. Replace `!` with `?.` or extract helpers.
- **Extract shared test utility** — `ToolEntry` interface and `callTool` helper are duplicated across 5 test files. Extract to a shared module.
- **Reduce `_registeredTools` coupling** — Tests access SDK private internals. Investigate using the SDK's public API for tool invocation.
- **npm publish config** — Add `bin`, `files`, and `exports` fields to `package.json` for `npx zellij-mcp` support.
- **Improve download script platform support** — Only handles Linux musl and macOS. Add glibc detection, Windows error message.

## Out of Scope

- **Plugin loading/management** — Complex, niche, CLI actions cover the primary needs.
- **Mode switching** — Dangerous; could lock the user out of their session.
- **Scroll manipulation** — `dump-screen --full` gets the full scrollback already.
- **Pane coordinate manipulation** — Overengineered for AI use.
- **Sync tab** — Broadcasting input to all panes is a footgun.

## Design Principles

- **Session targeting**: All commands use `--session` flag (configurable via `ZELLIJ_MCP_SESSION`).
- **Focus preservation**: Mutating tools (`new_tab`, `rename_tab`, `close_tab`, `new_pane`, `run_command`) preserve user focus by default. `switch_to: true` overrides this.
- **Post-action delay**: 60ms after each action for async Zellij server processing.
- **Explicit descriptions**: Every tool description states what it operates on, focus side effects, post-action state, what NOT to do after, and preconditions.
- **MCP annotations**: `readOnlyHint` on query tools, `idempotentHint` on `go_to_tab`, `destructiveHint` on close tools.
