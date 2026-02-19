import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  withFocusPreservation,
  zellij,
  zellijActionOrThrow,
} from "../zellij.ts";

const DEFAULT_DUMP_DIR = "/tmp";

function getDumpDir(): string {
  return process.env.ZELLIJ_MCP_DUMP_DIR || DEFAULT_DUMP_DIR;
}

function dumpPath(): string {
  return join(getDumpDir(), `zellij-mcp-dump-${Date.now()}.txt`);
}

async function dumpScreen(full: boolean): Promise<string> {
  const path = dumpPath();

  const args = full ? ["dump-screen", "--full", path] : ["dump-screen", path];

  await zellijActionOrThrow(args);

  try {
    const content = await readFile(path, "utf-8");
    return content.trimEnd();
  } finally {
    await unlink(path).catch(() => {});
  }
}

export function registerTerminalTools(server: McpServer) {
  server.registerTool(
    "zellij_write_to_pane",
    {
      title: "Write To Pane",
      description:
        "Send keystrokes to the currently focused pane in the Zellij session. " +
        "This is raw keystroke injection — characters are typed exactly as provided into whatever pane is focused. " +
        "To execute a command, append a newline character (\\n) at the end of the string (e.g. 'ls -la\\n'). " +
        "IMPORTANT: Always verify you are on the correct tab/pane before calling this tool (use go_to_tab or query_tab_names first). " +
        "This action does not change focus — the focused tab/pane remains the same after the keystrokes are sent.",
      inputSchema: {
        chars: z
          .string()
          .describe(
            "The characters to type into the focused pane. Include \\n for Enter key.",
          ),
      },
    },
    async ({ chars }) => {
      await zellijActionOrThrow(["write-chars", chars]);
      return {
        content: [
          {
            type: "text",
            text: `Sent ${chars.length} character(s) to the focused pane.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "zellij_read_pane",
    {
      title: "Read Pane",
      description:
        "Capture the visible terminal output of the currently focused pane in the Zellij session. " +
        "Returns only what is currently visible on screen (not scrollback history). " +
        "Use read_pane_full to capture the full scrollback buffer. " +
        "This is a read-only operation — it does not change focus or affect the pane in any way. " +
        "IMPORTANT: Make sure the correct tab/pane is focused before calling this tool.",
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const content = await dumpScreen(false);
      return { content: [{ type: "text", text: content }] };
    },
  );

  server.registerTool(
    "zellij_read_pane_full",
    {
      title: "Read Pane Full",
      description:
        "Capture the full scrollback buffer of the currently focused pane in the Zellij session. " +
        "Returns all terminal output including history that has scrolled off screen. " +
        "Use read_pane for only the currently visible portion. " +
        "This is a read-only operation — it does not change focus or affect the pane in any way. " +
        "IMPORTANT: Make sure the correct tab/pane is focused before calling this tool. " +
        "Note: The output can be very large for long-running processes.",
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const content = await dumpScreen(true);
      return { content: [{ type: "text", text: content }] };
    },
  );

  server.registerTool(
    "zellij_run_command",
    {
      title: "Run Command",
      description:
        "Run a command in a new Zellij pane. By default, opens a new tiled pane. " +
        "Use the floating option to open in a floating pane instead. " +
        "The pane will remain open after the command finishes unless close_on_exit is set to true. " +
        "This does NOT run the command in the currently focused pane — it always creates a new pane. " +
        "By default, focus stays on the current pane. Set switch_to to true to move focus to the new pane.",
      inputSchema: {
        command: z
          .array(z.string())
          .describe(
            "The command and its arguments to run (e.g. ['npm', 'test'] or ['ls', '-la']).",
          ),
        floating: z
          .boolean()
          .optional()
          .describe(
            "If true, run in a floating pane instead of a tiled pane. Defaults to false.",
          ),
        name: z.string().optional().describe("Optional name for the new pane."),
        close_on_exit: z
          .boolean()
          .optional()
          .describe(
            "If true, the pane will automatically close when the command finishes. Defaults to false.",
          ),
        cwd: z
          .string()
          .optional()
          .describe("Working directory for the command."),
        switch_to: z
          .boolean()
          .optional()
          .describe(
            "If true, move focus to the new command pane after creation. Defaults to false (focus stays on the current pane).",
          ),
      },
    },
    async ({ command, floating, name, close_on_exit, cwd, switch_to }) => {
      const perform = async () => {
        const args: string[] = ["run"];

        if (floating) {
          args.push("--floating");
        }

        if (name) {
          args.push("--name", name);
        }

        if (close_on_exit) {
          args.push("--close-on-exit");
        }

        if (cwd) {
          args.push("--cwd", cwd);
        }

        args.push("--", ...command);

        const result = await zellij(args);

        if (result.exitCode !== 0) {
          const detail = result.stderr || result.stdout || "unknown error";
          throw new Error(
            `zellij run failed (exit ${result.exitCode}): ${detail}`,
          );
        }
      };

      await withFocusPreservation(perform, !switch_to);

      const label = name ? `"${name}"` : "(unnamed)";
      const style = floating ? "floating" : "tiled";
      const focusNote = switch_to ? "" : " (focus preserved on original pane)";
      return {
        content: [
          {
            type: "text",
            text: `Started command in new ${style} pane ${label}: ${command.join(" ")}${focusNote}`,
          },
        ],
      };
    },
  );
}
