# zellij-mcp

An [MCP](https://modelcontextprotocol.io/) server that exposes [Zellij](https://zellij.dev/) terminal multiplexer operations as tools for AI coding agents. Create tabs, open panes, run commands, read terminal output, and open files in your `$EDITOR` -- all from an AI assistant.

Tools map mostly 1:1 to Zellij CLI actions, but improve on them by preserving the user's focus by default -- when an agent creates a tab or runs a command, it won't yank your view away from what you're working on.

## Usage

### Claude Code

```bash
claude mcp add zellij-mcp -- npx zellij-mcp
```

Or in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "zellij-mcp": {
      "command": "npx",
      "args": ["zellij-mcp"],
      "env": {
        "ZELLIJ_MCP_SESSION": "my-session"
      }
    }
  }
}
```

### opencode

In `opencode.json`:

```json
{
  "mcp": {
    "zellij-mcp": {
      "type": "local",
      "command": ["npx", "zellij-mcp"],
      "environment": {
        "ZELLIJ_MCP_SESSION": "my-session"
      }
    }
  }
}
```

### Other MCP clients

zellij-mcp uses stdio transport. Point your client at:

```bash
npx zellij-mcp
```

Set `ZELLIJ_MCP_SESSION` to target a specific Zellij session (defaults to `zellij-mcp`).

## Prerequisites

- [Bun](https://bun.sh)
- A running [Zellij](https://zellij.dev/) session

## Setup

```bash
git clone https://github.com/mustardamus/zellij-mcp.git
cd zellij-mcp
bun install
bun run setup
```

## Development

Start a Zellij session with four tabs - agent, editor, server, and git:

```bash
bun run dev:zellij
```

Requires:

- [opencode](https://opencode.ai)
- [Helix](https://helix-editor.com)
- [lazygit](https://github.com/jesseduffield/lazygit)

Or run the MCP server standalone (with watch mode):

```bash
bun run dev
```

## Environment Variables

### `ZELLIJ_MCP_SESSION`

The Zellij session name to target with all commands. Defaults to `zellij-mcp`.

### `ZELLIJ_MCP_DUMP_DIR`

Directory for temporary screen dump files created by `read_pane` and `read_pane_full`. Defaults to `/tmp`. Files are cleaned up automatically after reading.

## Focus Preservation

By default, several tools in zellij-mcp **preserve the user's current focus** instead of switching to the newly created tab or pane. This differs from raw Zellij behavior, where actions like `new-tab` or `new-pane` always move focus to the new element.

The rationale: when an AI agent creates a background tab for a dev server or spawns a pane to run tests, it shouldn't yank the user's view away from what they're working on.

### Affected tools

| Tool | Zellij default | zellij-mcp default | Override |
|------|---------------|-------------------|----------|
| `new_tab` | Switches focus to new tab | Focus stays on current tab | `switch_to: true` |
| `new_pane` | Switches focus to new pane | Focus stays on current pane | `switch_to: true` |
| `run_command` | Switches focus to new pane | Focus stays on current pane | `switch_to: true` |
| `rename_tab` | Operates on focused tab only | Can target any tab by name | `target: "tab-name"` |
| `close_tab` | Operates on focused tab only | Can target any tab by name | `target: "tab-name"` |

`edit_file` is **not** focus-preserving — it always switches focus to the editor pane, since the user needs to interact with it.

### How it works

When focus preservation is active, the tool:

1. Calls `dump-layout` to find the currently focused tab
2. Performs the action (which may move focus as a side effect)
3. Calls `go-to-tab-name` to restore focus to the original tab

### Examples

These are the default behaviors — the agent will preserve focus automatically:

> "Create a new tab called server"
>
> "Run npm test in a floating pane"
>
> "Rename the server tab to dev-server"
>
> "Close the git tab"

To override and switch focus, tell the agent explicitly:

> "Create a new tab called server and switch to it"
>
> "Run npm test in a floating pane and show me the output"

## Tools

### Session

#### `zellij_list_sessions`

List all active Zellij sessions. [Docs](https://zellij.dev/documentation/controlling-zellij-through-cli)

```bash
zellij list-sessions --short --no-formatting
```

#### `zellij_query_tab_names`

Get all tab names in the current session. Returns one tab name per line. [Docs](https://zellij.dev/documentation/cli-actions#query-tab-names)

```bash
zellij --session zellij-mcp action query-tab-names
```

#### `zellij_dump_layout`

Dump the full current layout of the session to understand the workspace structure including tabs, panes, and their arrangement. [Docs](https://zellij.dev/documentation/cli-actions#dump-layout)

```bash
zellij --session zellij-mcp action dump-layout
```

#### `zellij_list_clients`

List all clients connected to the current session, their focused pane id, and their running command. [Docs](https://zellij.dev/documentation/cli-actions#list-clients)

```bash
zellij --session zellij-mcp action list-clients
```

### Tabs

#### `zellij_go_to_tab`

Switch to a named tab in the session. Use `zellij_query_tab_names` first to discover available tab names. [Docs](https://zellij.dev/documentation/cli-actions#go-to-tab-name)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | The name of the tab to switch to (e.g. "editor", "server", "git"). |

```bash
zellij --session zellij-mcp action go-to-tab-name <name>
```

#### `zellij_new_tab`

Create a new tab in the session with an optional name and layout. By default, focus stays on the current tab. [Docs](https://zellij.dev/documentation/cli-actions#new-tab)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | no | Name for the new tab. If omitted, Zellij assigns a default name. |
| `layout` | no | Path to a layout file to use for the new tab. |
| `cwd` | no | Working directory for the new tab. |
| `switch_to` | no | If true, switch focus to the new tab. Defaults to false. |

```bash
zellij --session zellij-mcp action new-tab [--name <name>] [--layout <layout>] [--cwd <cwd>]
```

#### `zellij_rename_tab`

Rename a tab in the session. If `target` is provided, renames that specific tab without changing focus. If omitted, renames the currently focused tab. [Docs](https://zellij.dev/documentation/cli-actions#rename-tab)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | The new name for the tab. |
| `target` | no | The current name of the tab to rename. If omitted, renames the focused tab. |

```bash
zellij --session zellij-mcp action rename-tab <name>
```

#### `zellij_close_tab`

Close a tab in the session. If `target` is provided, closes that specific tab and restores focus to the original tab. If omitted, closes the currently focused tab. Use with caution -- this is destructive and cannot be undone. [Docs](https://zellij.dev/documentation/cli-actions#close-tab)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `target` | no | The name of the tab to close. If omitted, closes the focused tab. |

```bash
zellij --session zellij-mcp action close-tab
```

### Terminal I/O

#### `zellij_write_to_pane`

Send keystrokes to the currently focused pane. This is raw keystroke injection -- characters are typed exactly as provided. By default, a carriage return (Enter key, char 13) is sent after the characters to execute them. Set `enter` to `false` to send only the raw characters without a trailing Enter. [Docs](https://zellij.dev/documentation/cli-actions#write-chars)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `chars` | yes | The characters to type into the focused pane. |
| `enter` | no | If true (default), send a carriage return (char 13) after the characters. Set to false to skip the trailing Enter. |

```bash
zellij --session zellij-mcp action write-chars <chars>
zellij --session zellij-mcp action write 13        # sent automatically unless enter=false
```

#### `zellij_read_pane`

Capture the visible terminal output of the currently focused pane. Writes to a temporary file in `ZELLIJ_MCP_DUMP_DIR` (defaults to `/tmp`), reads it, then cleans up. [Docs](https://zellij.dev/documentation/cli-actions#dump-screen)

```bash
zellij --session zellij-mcp action dump-screen <path>
```

#### `zellij_read_pane_full`

Capture the full scrollback buffer of the currently focused pane. Same as `read_pane` but includes all history that has scrolled off screen. Output can be very large for long-running processes. [Docs](https://zellij.dev/documentation/cli-actions#dump-screen)

```bash
zellij --session zellij-mcp action dump-screen --full <path>
```

#### `zellij_run_command`

Run a command in a new Zellij pane. Always creates a new pane -- does not run in the currently focused pane. By default, focus stays on the current pane. [Docs](https://zellij.dev/documentation/cli-actions#run)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `command` | yes | The command and its arguments as an array (e.g. `["npm", "test"]`). |
| `floating` | no | If true, run in a floating pane instead of a tiled pane. |
| `name` | no | Optional name for the new pane. |
| `close_on_exit` | no | If true, the pane closes automatically when the command finishes. |
| `cwd` | no | Working directory for the command. |
| `switch_to` | no | If true, move focus to the new command pane. Defaults to false. |

```bash
zellij --session zellij-mcp run [--floating] [--name <name>] [--close-on-exit] [--cwd <cwd>] -- <command...>
```

### Panes

#### `zellij_new_pane`

Open a new pane in the currently focused tab. By default, opens a tiled pane. By default, focus stays on the current pane. [Docs](https://zellij.dev/documentation/cli-actions#new-pane)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `floating` | no | If true, open a floating pane instead of a tiled pane. |
| `name` | no | Optional name for the new pane. |
| `direction` | no | Direction to place the new tiled pane relative to the focused pane (down, right, up, left). Ignored for floating panes. |
| `cwd` | no | Working directory for the new pane. |
| `command` | no | Optional command and arguments to run in the new pane (e.g. `["npm", "test"]`). |
| `switch_to` | no | If true, move focus to the new pane. Defaults to false. |

```bash
zellij --session zellij-mcp action new-pane [--floating] [--name <name>] [--direction <direction>] [--cwd <cwd>] [-- <command...>]
```

#### `zellij_close_pane`

Close the currently focused pane. Any process running in the pane will be terminated. Focus moves to an adjacent pane. Use with caution -- this is destructive and cannot be undone. [Docs](https://zellij.dev/documentation/cli-actions#close-pane)

```bash
zellij --session zellij-mcp action close-pane
```

#### `zellij_focus_pane`

Move focus to an adjacent pane in the given direction. Only moves focus between tiled panes. If there is no pane in the specified direction, focus does not change. [Docs](https://zellij.dev/documentation/cli-actions#move-focus)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `direction` | yes | The direction to move focus (up, down, left, right). |

```bash
zellij --session zellij-mcp action move-focus <direction>
```

#### `zellij_toggle_floating_panes`

Show or hide all floating panes in the currently focused tab. This is a toggle -- calling it twice returns to the original state. [Docs](https://zellij.dev/documentation/cli-actions#toggle-floating-panes)

```bash
zellij --session zellij-mcp action toggle-floating-panes
```

#### `zellij_toggle_fullscreen`

Toggle fullscreen mode on the currently focused pane. When active, the pane expands to fill the entire tab area. Calling it again restores the original layout. Focus remains on the same pane. [Docs](https://zellij.dev/documentation/cli-actions#toggle-fullscreen)

```bash
zellij --session zellij-mcp action toggle-fullscreen
```

#### `zellij_rename_pane`

Rename the currently focused pane. The name appears in the pane frame/border. Focus does not change. [Docs](https://zellij.dev/documentation/cli-actions#rename-pane)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | The new name for the currently focused pane. |

```bash
zellij --session zellij-mcp action rename-pane <name>
```

#### `zellij_resize_pane`

Resize the currently focused pane in the given direction. The pane grows in the specified direction, shrinking adjacent panes. Only works for tiled panes. Focus does not change. [Docs](https://zellij.dev/documentation/cli-actions#resize)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `direction` | yes | The direction to grow the pane (up, down, left, right). |

```bash
zellij --session zellij-mcp action resize <direction>
```

### Editor

#### `zellij_edit_file`

Open a file in the user's `$EDITOR` (e.g. Helix, Vim, Nano) in a new Zellij pane. Focus moves to the newly created editor pane. The pane closes automatically when the user exits the editor. This opens the file for the human user to edit interactively -- it does not return file contents. [Docs](https://zellij.dev/documentation/cli-actions#edit)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file` | yes | The path to the file to open. Can be absolute or relative to the session's working directory. |
| `floating` | no | If true, open the editor in a floating pane instead of a tiled pane. |
| `line_number` | no | Line number to jump to when opening the file (1-indexed). |
| `direction` | no | Direction to place the new tiled pane relative to the focused pane (down, right, up, left). Ignored for floating panes. |
| `cwd` | no | Working directory for the editor pane. Useful when the file path is relative. |

```bash
zellij --session zellij-mcp action edit <file> [--floating] [--line-number <n>] [--direction <direction>] [--cwd <cwd>]
```
