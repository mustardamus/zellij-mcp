import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zellijActionOrThrow } from "../zellij.ts";

export function registerTabTools(server: McpServer) {
  server.registerTool(
    "zellij_go_to_tab",
    {
      title: "Go To Tab",
      description:
        "Switch to a named tab in the Zellij session. Use query_tab_names first to discover available tab names.",
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
        "Create a new tab in the Zellij session with an optional name and layout.",
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
      },
    },
    async ({ name, layout, cwd }) => {
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

      const label = name ? `"${name}"` : "(unnamed)";
      return { content: [{ type: "text", text: `Created new tab ${label}.` }] };
    },
  );

  server.registerTool(
    "zellij_rename_tab",
    {
      title: "Rename Tab",
      description: "Rename the currently focused tab in the Zellij session.",
      inputSchema: {
        name: z
          .string()
          .describe("The new name for the currently focused tab."),
      },
    },
    async ({ name }) => {
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
        "Close the currently focused tab in the Zellij session. Use with caution — this is destructive and cannot be undone.",
      annotations: {
        destructiveHint: true,
      },
    },
    async () => {
      await zellijActionOrThrow(["close-tab"]);
      return { content: [{ type: "text", text: "Closed the focused tab." }] };
    },
  );
}
