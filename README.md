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
