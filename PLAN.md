# zellij-mcp — Plan

## Next: Compound / High-Level Tools

Build composite tools that chain multiple primitives. Only after primitives are
battle-tested — the focus-based model is inherently stateful and timing-sensitive.

| Tool Name      | Composes                                             | Purpose                                      |
| -------------- | ---------------------------------------------------- | -------------------------------------------- |
| `run_in_tab`   | `go_to_tab` → `write_to_pane` → wait → `read_pane`  | Go to a tab, run a command, return output    |
| `check_server` | `go_to_tab("server")` → `read_pane`                 | Quick check on the dev server status         |
| `run_and_read` | `run_command` (floating) → wait → `read_pane` → `close_pane` | Run a one-off command and return output |

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
