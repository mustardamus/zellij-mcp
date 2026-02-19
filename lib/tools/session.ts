import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { zellijActionOrThrow, zellijRawOrThrow } from "../zellij.ts";

export function registerSessionTools(server: McpServer) {
  server.registerTool(
    "zellij_list_sessions",
    {
      title: "List Zellij Sessions",
      description: "List all active Zellij sessions.",
    },
    async () => {
      const stdout = await zellijRawOrThrow([
        "list-sessions",
        "--short",
        "--no-formatting",
      ]);

      return { content: [{ type: "text", text: stdout }] };
    },
  );

  server.registerTool(
    "zellij_query_tab_names",
    {
      title: "Query Tab Names",
      description:
        "Get all tab names in the current Zellij session. Returns one tab name per line. " +
        "Note: This only returns tab names — it does not indicate which tab is currently focused. " +
        "Use dump_layout to determine the focused tab (look for focus=true in the output).",
    },
    async () => {
      const stdout = await zellijActionOrThrow(["query-tab-names"]);
      return { content: [{ type: "text", text: stdout }] };
    },
  );

  server.registerTool(
    "zellij_dump_layout",
    {
      title: "Dump Layout",
      description:
        "Dump the full current layout of the Zellij session to understand the workspace structure including tabs, panes, and their arrangement. " +
        "The output is in KDL format and contains focus=true attributes that indicate which tab and pane are currently focused. " +
        "This is the only tool that can reveal the current focus state of the session.",
    },
    async () => {
      const stdout = await zellijActionOrThrow(["dump-layout"]);
      return { content: [{ type: "text", text: stdout }] };
    },
  );

  server.registerTool(
    "zellij_list_clients",
    {
      title: "List Clients",
      description:
        "List all clients connected to the current Zellij session, their focused pane id, and their running command. " +
        "Returns tabular output with columns: CLIENT_ID, ZELLIJ_PANE_ID, RUNNING_COMMAND.",
    },
    async () => {
      const stdout = await zellijActionOrThrow(["list-clients"]);
      return { content: [{ type: "text", text: stdout }] };
    },
  );
}
