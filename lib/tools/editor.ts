import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zellijActionOrThrow } from "../zellij.ts";

export function registerEditorTools(server: McpServer) {
  server.registerTool(
    "zellij_edit_file",
    {
      title: "Edit File",
      description:
        "Open a file in the user's $EDITOR (e.g. Helix, Vim, Nano) in a new Zellij pane. " +
        "By default, opens in a new tiled pane. Use the floating option to open in a floating pane instead. " +
        "Optionally jump to a specific line number using the line_number parameter. " +
        "Focus will move to the newly created editor pane — there is no need to call focus_pane afterward. " +
        "The editor pane will close automatically when the user exits the editor. " +
        "IMPORTANT: This opens the file for the human user to edit interactively — " +
        "it does not return file contents. Use this when the user needs to manually edit a file.",
      inputSchema: {
        file: z
          .string()
          .describe(
            "The path to the file to open in the editor. Can be absolute or relative to the Zellij session's working directory.",
          ),
        floating: z
          .boolean()
          .optional()
          .describe(
            "If true, open the editor in a floating pane instead of a tiled pane. Defaults to false.",
          ),
        line_number: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Optional line number to jump to when opening the file (1-indexed).",
          ),
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
          .describe(
            "Working directory for the editor pane. Useful when the file path is relative.",
          ),
      },
    },
    async ({ file, floating, line_number, direction, cwd }) => {
      const args: string[] = ["edit"];

      if (floating) {
        args.push("--floating");
      }

      if (direction && !floating) {
        args.push("--direction", direction);
      }

      if (cwd) {
        args.push("--cwd", cwd);
      }

      if (line_number) {
        args.push("--line-number", String(line_number));
      }

      args.push(file);

      await zellijActionOrThrow(args);

      const style = floating ? "floating" : "tiled";
      const lineInfo = line_number ? ` at line ${line_number}` : "";
      return {
        content: [
          {
            type: "text",
            text: `Opened "${file}"${lineInfo} in $EDITOR in a new ${style} pane.`,
          },
        ],
      };
    },
  );
}
