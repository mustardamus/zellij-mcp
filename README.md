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
