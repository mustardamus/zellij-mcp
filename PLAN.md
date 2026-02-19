# zellij-mcp — Implementation Plan

## Key Insight

The MCP server runs as a **child process** of opencode (spawned via stdio). It does
**not** run inside a Zellij pane with `ZELLIJ_SESSION_NAME` set. Every `zellij action`
call must explicitly target the session with `--session zellij-mcp`.

The Zellij CLI also has a critical limitation: **most actions operate on the _focused_
pane/tab**, not on a specific pane by ID. This means tab/pane targeting requires a
focus-then-act pattern, or using `write-chars`/`dump-screen` on the focused pane after
navigating to it.

## File Structure

```
zellij-mcp/
├── index.ts                  # Entry point: create server, register all tools, connect transport
├── lib/
│   ├── zellij.ts             # Low-level Zellij CLI wrapper (exec helper, session targeting)
│   ├── tools/
│   │   ├── session.ts        # Session-level tools (list sessions, query tabs, dump layout)
│   │   ├── tabs.ts           # Tab management tools (go-to, create, rename, close)
│   │   ├── panes.ts          # Pane management tools (new, close, focus, rename, resize)
│   │   ├── terminal.ts       # Terminal I/O tools (write-chars, dump-screen, run command)
│   │   └── editor.ts         # Editor integration tools (edit file, edit scrollback)
│   └── types.ts              # Shared Zod schemas and TypeScript types
```

## Layer 3: Compound / High-Level Tools

Once the primitives above exist, build composite tools that chain multiple actions.
These are where the real value lives:

| Tool Name      | Composes                                             | Purpose                                      |
| -------------- | ---------------------------------------------------- | -------------------------------------------- |
| `run_in_tab`   | `go_to_tab` → `write_to_pane` → wait → `read_pane`  | Go to a tab, run a command, return output    |
| `check_server` | `go_to_tab("server")` → `read_pane`                 | Quick check on the dev server status         |
| `run_and_read` | `run_command` (floating) → wait → `read_pane` → `close_pane` | Run a one-off command and return output |

Start with just the primitives. Add compound tools only after testing, because the
focus-based model is inherently stateful and timing-sensitive. Compound tools will need
careful sequencing and probably `sleep` delays between actions.

## Implementation Order

7. **Compound tools** — Only after primitives are battle-tested.

## Critical Design Decisions

### 1. Session targeting

Hardcode `--session zellij-mcp` (matching the `dev:zellij` script's `-s zellij-mcp`).
Or make it configurable via an env var `ZELLIJ_MCP_SESSION`.

### 2. Focus management is destructive

`write-chars` and `dump-screen` act on the _focused_ pane. If the AI navigates to the
server tab to read output, the user's view changes too. Two strategies:

- **Accept it**: The AI shares the session, focus changes are visible. Simple and honest.
- **Floating pane pattern**: Use `zellij run --floating --close-on-exit -- <cmd>` for
  one-off commands. This avoids disturbing the user's focused tab.

Recommendation: **accept it for reads** (go to tab, dump, come back) and **use floating
panes for writes** (run commands in floating panes that auto-close).

### 3. `dump-screen` needs a temp file

It writes to disk, then you read it. Use `/tmp/zellij-mcp-dump-<timestamp>.txt` and
clean up after.

### 4. `write-chars` is raw keystroke injection

It literally types characters into whatever pane is focused. To run a command, you'd
write `"ls -la\n"` (with the newline). This is powerful but dangerous — always validate
that you're on the right tab/pane first.

### 5. Tool registration pattern

Each file in `lib/tools/` exports a function that takes the `McpServer` instance and
registers its tools:

```ts
// lib/tools/session.ts
export function registerSessionTools(server: McpServer, zellij: ZellijRunner) {
  server.registerTool("zellij_query_tabs", { ... }, async () => { ... });
  // ...
}
```

Then `index.ts` imports and calls each registration function. Clean separation.

### 6. Tool naming convention

Prefix all tools with `zellij_` so the AI agent can clearly distinguish them from other
MCP tools. Use snake_case to match MCP conventions.

### 7. Focus-preserving alternatives for mutating tools

Many Zellij actions implicitly change focus as a side effect (e.g., `new-tab` switches to
the new tab, `close-tab` moves focus to an adjacent tab). The current tools expose this
behavior directly, but the user often does **not** want the focus to move. For example:

- **Rename a tab**: The user wants to rename a background tab without leaving their
  current tab. Today `rename_tab` operates on the focused tab, so the agent must
  `go_to_tab` → `rename_tab` → `go_to_tab` back. This is racy and disrupts the user's
  view.
- **Create a tab**: The user wants to create a tab in the background without switching to
  it. Today `new_tab` always switches focus.
- **Close a tab**: The user wants to close a background tab without their view jumping.

**Principle: Focus should only change when the user explicitly asks to switch tabs.**
Mutating actions like create, rename, and close should preserve the user's current focus
by default.

**Implementation approach:** For each tool that has an implicit focus side effect, provide
a focus-preserving variant that:

1. Saves the current tab (via `query-tab-names` + `dump-layout` to find the focused tab)
2. Performs the action
3. Restores focus to the original tab

Alternatively, where Zellij CLI supports it, use flags or command combinations that avoid
the focus change entirely. For instance, `rename_tab` could accept a tab name parameter
and internally do the focus-switch-and-restore, so the agent (and user) never sees it.

**Affected tools and proposed behavior:**

| Tool | Current behavior | Desired default behavior |
|------|-----------------|------------------------|
| `new_tab` | Creates tab and switches to it | Create tab in background; only switch if explicitly requested |
| `rename_tab` | Renames the focused tab | Accept a target tab name; rename it without changing focus |
| `close_tab` | Closes the focused tab, focus moves to adjacent | Accept a target tab name; close it without changing focus |
| `go_to_tab` | Switches focus (this IS the explicit switch) | No change — this is the intentional focus-change tool |

This is a significant rework of the tab tools and should be tackled after the current
primitives are stable. The focus-save/restore pattern will rely on the 60ms post-action
delay between sequential commands to avoid race conditions.

## Finding: Tool Descriptions Must Be Explicit About Side Effects

After testing the implemented session and tab tools, a key finding emerged: **the AI
agent only knows what the tool descriptions tell it**. Any implicit Zellij behavior that
is not spelled out in the description will lead to incorrect tool usage — redundant
calls, race conditions, or actions on the wrong tab.

### The Problem

When asked to "create a new tab named shell and switch to it", the AI agent called
`new_tab` followed by `go_to_tab` — not knowing that `new-tab` already switches focus.
The redundant `go_to_tab` raced with the focus switch from `new-tab`, because the Zellij
CLI exiting only means it delivered the message; the server processes it asynchronously.

This was fixed by:
1. Making `new_tab`'s description explicit: "Automatically switches focus to the new tab
   — there is no need to call go_to_tab afterward."
2. Adding a 100ms post-action delay in `zellijActionOrThrow` to give the server time to
   process before the next command is sent.

### Rules for All Tool Descriptions Going Forward

Every tool description must explicitly state:

1. **What it operates on** — "the currently focused tab", "the session", etc. The agent
   must never have to guess the target.
2. **Focus side effects** — If the action changes which tab/pane is focused, say so. If
   focus does NOT change, that's worth stating too.
3. **Post-action state** — What state is the session in after the action? Which tab/pane
   is focused? What was created/destroyed?
4. **What the agent should NOT do** — If a follow-up action is unnecessary (like calling
   `go_to_tab` after `new_tab`), say "there is no need to call X afterward."
5. **Ordering requirements** — If the tool requires a precondition (e.g., `rename_tab`
   requires the target tab to be focused first), the description must say so.

### Missing MCP Annotations

The MCP spec supports `readOnlyHint`, `idempotentHint`, and `openWorldHint` annotations.
Currently only `close_tab` has `destructiveHint: true`. The read-only session tools
should declare `readOnlyHint: true`, and `go_to_tab` should declare
`idempotentHint: true` (calling it twice with the same name has no additional effect).

## What NOT to Build (Initially)

- **Plugin loading/management** (`zellij plugin`, `zellij pipe`) — Complex, niche, CLI
  actions cover the primary needs.
- **Mode switching** (`switch-mode`) — Dangerous; could lock the user out of their session.
- **Scroll manipulation** (`scroll-up`, `page-scroll-down`, etc.) — `dump-screen --full`
  gets the full scrollback already.
- **Pane coordinate manipulation** (`change-floating-pane-coordinates`) — Overengineered
  for AI use.
- **Sync tab** (`toggle-active-sync-tab`) — Broadcasting input to all panes is a footgun.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   index.ts                          │
│  Creates McpServer, registers all tool groups,      │
│  connects StdioServerTransport                      │
└──────────┬──────────────────────────────────────────┘
           │ imports & calls registerXTools(server, zellij)
           ▼
┌──────────────────────────────────────────────────────┐
│  lib/tools/session.ts   ← query_tabs, dump_layout   │
│  lib/tools/tabs.ts      ← go_to_tab, new_tab        │
│  lib/tools/panes.ts     ← new_pane, close_pane      │
│  lib/tools/terminal.ts  ← write_to_pane, read_pane  │
│  lib/tools/editor.ts    ← edit_file                  │
└──────────┬───────────────────────────────────────────┘
           │ all call through
           ▼
┌──────────────────────────────────────────────────────┐
│  lib/zellij.ts                                       │
│  zellij(args) → spawns ./bin/zellij --session X ...  │
└──────────┬───────────────────────────────────────────┘
           │ exec
           ▼
     ./bin/zellij  →  Zellij session "zellij-mcp"
```

The AI agent (opencode) calls MCP tools → tools call `lib/zellij.ts` → which shells out
to `./bin/zellij --session zellij-mcp action ...` → Zellij performs the action in the
live session.
