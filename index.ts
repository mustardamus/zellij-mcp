import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerEditorTools } from "./lib/tools/editor.ts";
import { registerPaneTools } from "./lib/tools/panes.ts";
import { registerSessionTools } from "./lib/tools/session.ts";
import { registerTabTools } from "./lib/tools/tabs.ts";
import { registerTerminalTools } from "./lib/tools/terminal.ts";
import pkg from "./package.json";

const server = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

server.registerTool(
  "ping",
  { description: "Check if the server is alive" },
  async () => {
    return { content: [{ type: "text", text: "pong" }] };
  },
);

registerSessionTools(server);
registerTabTools(server);
registerPaneTools(server);
registerTerminalTools(server);
registerEditorTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
