import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getFocusedTabName,
  withFocusPreservation,
  zellijActionOrThrow,
} from "../zellij.ts";

export function registerTabTools(server: McpServer) {
  server.registerTool(
    "zellij_go_to_tab",
    {
      title: "Go To Tab",
      description:
        "Switch to a named tab in the Zellij session. Use query_tab_names first to discover available tab names. " +
        "The focus change is visible to the human user and affects all clients connected to the session. " +
        "Calling this with the already-focused tab name has no additional effect.",
      annotations: {
        idempotentHint: true,
      },
      inputSchema: {
        name: z
          .string()
          .describe(
            "The name of the tab to switch to (e.g. 'editor', 'server', 'git').",
          ),
      },
    },
    async ({ name }) => {
      await zellijActionOrThrow(["go-to-tab-name", name]);
      return {
        content: [{ type: "text", text: `Switched to tab "${name}".` }],
      };
    },
  );

  server.registerTool(
    "zellij_new_tab",
    {
      title: "New Tab",
      description:
        "Create a new tab in the Zellij session with an optional name and layout. " +
        "By default, the tab is created in the background and focus stays on the current tab. " +
        "Set switch_to to true to switch focus to the new tab after creation.",
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe(
            "Name for the new tab. If omitted, Zellij assigns a default name.",
          ),
        layout: z
          .string()
          .optional()
          .describe("Path to a layout file to use for the new tab."),
        cwd: z
          .string()
          .optional()
          .describe("Working directory for the new tab."),
        switch_to: z
          .boolean()
          .optional()
          .describe(
            "If true, switch focus to the new tab after creation. Defaults to false (focus stays on the current tab).",
          ),
      },
    },
    async ({ name, layout, cwd, switch_to }) => {
      const perform = async () => {
        const args: string[] = ["new-tab"];

        if (name) {
          args.push("--name", name);
        }

        if (layout) {
          args.push("--layout", layout);
        }

        if (cwd) {
          args.push("--cwd", cwd);
        }

        await zellijActionOrThrow(args);
      };

      await withFocusPreservation(perform, !switch_to);

      const label = name ? `"${name}"` : "(unnamed)";
      const focusNote = switch_to
        ? "and switched to it"
        : "(focus preserved on original tab)";
      return {
        content: [
          { type: "text", text: `Created new tab ${label} ${focusNote}.` },
        ],
      };
    },
  );

  server.registerTool(
    "zellij_rename_tab",
    {
      title: "Rename Tab",
      description:
        "Rename a tab in the Zellij session. " +
        "If target is provided, renames that specific tab without changing focus. " +
        "If target is omitted, renames the currently focused tab.",
      inputSchema: {
        name: z.string().describe("The new name for the tab."),
        target: z
          .string()
          .optional()
          .describe(
            "The current name of the tab to rename. If omitted, renames the currently focused tab.",
          ),
      },
    },
    async ({ name, target }) => {
      if (target) {
        const focusedTab = await getFocusedTabName();
        await zellijActionOrThrow(["go-to-tab-name", target]);
        await zellijActionOrThrow(["rename-tab", name]);

        if (focusedTab && focusedTab !== target) {
          await zellijActionOrThrow(["go-to-tab-name", focusedTab]);
        }

        return {
          content: [
            { type: "text", text: `Renamed tab "${target}" to "${name}".` },
          ],
        };
      }

      await zellijActionOrThrow(["rename-tab", name]);
      return {
        content: [{ type: "text", text: `Renamed focused tab to "${name}".` }],
      };
    },
  );

  server.registerTool(
    "zellij_close_tab",
    {
      title: "Close Tab",
      description:
        "Close a tab in the Zellij session. " +
        "If target is provided, closes that specific tab and restores focus to the original tab. " +
        "If target is omitted, closes the currently focused tab and focus moves to an adjacent tab. " +
        "All panes and their running processes within the tab are terminated. " +
        "WARNING: Closing the last tab in the session will terminate the entire Zellij session. " +
        "Use with caution — this is destructive and cannot be undone.",
      annotations: {
        destructiveHint: true,
      },
      inputSchema: {
        target: z
          .string()
          .optional()
          .describe(
            "The name of the tab to close. If omitted, closes the currently focused tab.",
          ),
      },
    },
    async ({ target }) => {
      if (target) {
        const focusedTab = await getFocusedTabName();
        await zellijActionOrThrow(["go-to-tab-name", target]);
        await zellijActionOrThrow(["close-tab"]);

        if (focusedTab && focusedTab !== target) {
          await zellijActionOrThrow(["go-to-tab-name", focusedTab]);
        }

        return {
          content: [{ type: "text", text: `Closed tab "${target}".` }],
        };
      }

      await zellijActionOrThrow(["close-tab"]);
      return { content: [{ type: "text", text: "Closed the focused tab." }] };
    },
  );
}
