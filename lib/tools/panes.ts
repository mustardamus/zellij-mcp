import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withFocusPreservation, zellijActionOrThrow } from "../zellij.ts";

export function registerPaneTools(server: McpServer) {
  server.registerTool(
    "zellij_new_pane",
    {
      title: "New Pane",
      description:
        "Open a new pane in the currently focused tab of the Zellij session. " +
        "By default, opens a tiled pane. Use the floating option to open a floating pane instead. " +
        "Optionally run a command in the new pane (similar to run_command but using the action interface). " +
        "By default, focus stays on the current pane. Set switch_to to true to move focus to the new pane. " +
        "Use the direction option to control where the new tiled pane is placed relative to the focused pane.",
      inputSchema: {
        floating: z
          .boolean()
          .optional()
          .describe(
            "If true, open a floating pane instead of a tiled pane. Defaults to false.",
          ),
        name: z.string().optional().describe("Optional name for the new pane."),
        direction: z
          .enum(["down", "right", "up", "left"])
          .optional()
          .describe(
            "Direction to place the new tiled pane relative to the focused pane. " +
              "Only applies to tiled panes (ignored for floating). " +
              "One of: down, right, up, left.",
          ),
        cwd: z
          .string()
          .optional()
          .describe("Working directory for the new pane."),
        command: z
          .array(z.string())
          .optional()
          .describe(
            "Optional command and arguments to run in the new pane (e.g. ['npm', 'test']).",
          ),
        switch_to: z
          .boolean()
          .optional()
          .describe(
            "If true, move focus to the new pane after creation. Defaults to false (focus stays on the current pane).",
          ),
      },
    },
    async ({ floating, name, direction, cwd, command, switch_to }) => {
      const perform = async () => {
        const args: string[] = ["new-pane"];

        if (floating) {
          args.push("--floating");
        }

        if (name) {
          args.push("--name", name);
        }

        if (direction && !floating) {
          args.push("--direction", direction);
        }

        if (cwd) {
          args.push("--cwd", cwd);
        }

        if (command && command.length > 0) {
          args.push("--", ...command);
        }

        await zellijActionOrThrow(args);
      };

      await withFocusPreservation(perform, !switch_to);

      const label = name ? `"${name}"` : "(unnamed)";
      const style = floating ? "floating" : "tiled";
      const focusNote = switch_to ? "" : " (focus preserved on original pane)";
      return {
        content: [
          {
            type: "text",
            text: `Opened new ${style} pane ${label}${focusNote}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "zellij_close_pane",
    {
      title: "Close Pane",
      description:
        "Close the currently focused pane in the Zellij session. " +
        "Any process running in the pane will be terminated. " +
        "Focus will move to an adjacent pane after closing. " +
        "Use with caution — this is destructive and cannot be undone. " +
        "If this is the last pane in the tab, the tab itself will be closed.",
      annotations: {
        destructiveHint: true,
      },
    },
    async () => {
      await zellijActionOrThrow(["close-pane"]);
      return {
        content: [{ type: "text", text: "Closed the focused pane." }],
      };
    },
  );

  server.registerTool(
    "zellij_focus_pane",
    {
      title: "Focus Pane",
      description:
        "Move focus to an adjacent pane in the given direction within the currently focused tab. " +
        "This only moves focus between tiled panes — it does not affect floating panes. " +
        "If there is no pane in the specified direction, focus does not change. " +
        "The focus change is visible to the human user.",
      inputSchema: {
        direction: z
          .enum(["up", "down", "left", "right"])
          .describe(
            "The direction to move focus. One of: up, down, left, right.",
          ),
      },
    },
    async ({ direction }) => {
      await zellijActionOrThrow(["move-focus", direction]);
      return {
        content: [{ type: "text", text: `Moved focus ${direction}.` }],
      };
    },
  );

  server.registerTool(
    "zellij_toggle_floating_panes",
    {
      title: "Toggle Floating Panes",
      description:
        "Show or hide all floating panes in the currently focused tab. " +
        "When floating panes are shown, focus moves to a floating pane. " +
        "When floating panes are hidden, focus returns to the tiled pane that was focused before. " +
        "This is a toggle — calling it twice returns to the original state.",
      annotations: {
        idempotentHint: false,
      },
    },
    async () => {
      await zellijActionOrThrow(["toggle-floating-panes"]);
      return {
        content: [{ type: "text", text: "Toggled floating panes." }],
      };
    },
  );

  server.registerTool(
    "zellij_toggle_fullscreen",
    {
      title: "Toggle Fullscreen",
      description:
        "Toggle fullscreen mode on the currently focused pane. " +
        "When fullscreen is active, the focused pane expands to fill the entire tab area, hiding other panes. " +
        "Calling it again restores the original pane layout. " +
        "This is a toggle — calling it twice returns to the original state. " +
        "Focus remains on the same pane.",
      annotations: {
        idempotentHint: false,
      },
    },
    async () => {
      await zellijActionOrThrow(["toggle-fullscreen"]);
      return {
        content: [
          { type: "text", text: "Toggled fullscreen on the focused pane." },
        ],
      };
    },
  );

  server.registerTool(
    "zellij_rename_pane",
    {
      title: "Rename Pane",
      description:
        "Rename the currently focused pane in the Zellij session. " +
        "The pane name appears in the pane frame/border. " +
        "Focus does not change — the same pane remains focused after renaming. " +
        "IMPORTANT: Make sure the correct pane is focused before calling this tool.",
      inputSchema: {
        name: z
          .string()
          .describe("The new name for the currently focused pane."),
      },
    },
    async ({ name }) => {
      await zellijActionOrThrow(["rename-pane", name]);
      return {
        content: [{ type: "text", text: `Renamed focused pane to "${name}".` }],
      };
    },
  );

  server.registerTool(
    "zellij_resize_pane",
    {
      title: "Resize Pane",
      description:
        "Resize the currently focused pane in the given direction. " +
        "The pane grows in the specified direction, shrinking adjacent panes. " +
        "This only works for tiled panes — floating panes cannot be resized this way. " +
        "Focus does not change — the same pane remains focused after resizing. " +
        "IMPORTANT: Make sure the correct pane is focused before calling this tool.",
      inputSchema: {
        direction: z
          .enum(["up", "down", "left", "right"])
          .describe(
            "The direction to grow the pane. One of: up, down, left, right.",
          ),
      },
    },
    async ({ direction }) => {
      await zellijActionOrThrow(["resize", direction]);
      return {
        content: [
          {
            type: "text",
            text: `Resized focused pane ${direction}.`,
          },
        ],
      };
    },
  );
}
