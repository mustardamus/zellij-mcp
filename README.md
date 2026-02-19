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
