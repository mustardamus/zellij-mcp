# zellij-mcp

## Prerequisites

- [Bun](https://bun.sh)

## Setup

Install dependencies and download the Zellij binary:

```bash
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

Or run the dev server standalone:

```bash
bun run dev
```

## Environment Variables

### `ZELLIJ_MCP_SESSION`

The Zellij session name to target with all commands. Defaults to `zellij-mcp`.

### `ZELLIJ_MCP_DUMP_DIR`

Directory for temporary screen dump files created by `read_pane` and `read_pane_full`. Defaults to `/tmp`. Files are cleaned up automatically after reading.

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

Create a new tab in the session with an optional name and layout. [Docs](https://zellij.dev/documentation/cli-actions#new-tab)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | no | Name for the new tab. If omitted, Zellij assigns a default name. |
| `layout` | no | Path to a layout file to use for the new tab. |
| `cwd` | no | Working directory for the new tab. |

```bash
zellij --session zellij-mcp action new-tab [--name <name>] [--layout <layout>] [--cwd <cwd>]
```

#### `zellij_rename_tab`

Rename the currently focused tab in the session. [Docs](https://zellij.dev/documentation/cli-actions#rename-tab)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | The new name for the currently focused tab. |

```bash
zellij --session zellij-mcp action rename-tab <name>
```

#### `zellij_close_tab`

Close the currently focused tab in the session. Use with caution -- this is destructive and cannot be undone. [Docs](https://zellij.dev/documentation/cli-actions#close-tab)

```bash
zellij --session zellij-mcp action close-tab
```

### Terminal I/O

#### `zellij_write_to_pane`

Send keystrokes to the currently focused pane. This is raw keystroke injection -- characters are typed exactly as provided. Append `\n` to execute a command. [Docs](https://zellij.dev/documentation/cli-actions#write-chars)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `chars` | yes | The characters to type into the focused pane. Include `\n` for Enter key. |

```bash
zellij --session zellij-mcp action write-chars <chars>
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

Run a command in a new Zellij pane. Always creates a new pane -- does not run in the currently focused pane. [Docs](https://zellij.dev/documentation/cli-actions#run)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `command` | yes | The command and its arguments as an array (e.g. `["npm", "test"]`). |
| `floating` | no | If true, run in a floating pane instead of a tiled pane. |
| `name` | no | Optional name for the new pane. |
| `close_on_exit` | no | If true, the pane closes automatically when the command finishes. |
| `cwd` | no | Working directory for the command. |

```bash
zellij --session zellij-mcp run [--floating] [--name <name>] [--close-on-exit] [--cwd <cwd>] -- <command...>
```

### Panes

#### `zellij_new_pane`

Open a new pane in the currently focused tab. By default, opens a tiled pane. Focus moves to the newly created pane. [Docs](https://zellij.dev/documentation/cli-actions#new-pane)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `floating` | no | If true, open a floating pane instead of a tiled pane. |
| `name` | no | Optional name for the new pane. |
| `direction` | no | Direction to place the new tiled pane relative to the focused pane (down, right, up, left). Ignored for floating panes. |
| `cwd` | no | Working directory for the new pane. |
| `command` | no | Optional command and arguments to run in the new pane (e.g. `["npm", "test"]`). |

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
