import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSessionTools } from "./lib/tools/session.ts";

const server = new McpServer({
  name: "zellij-mcp",
  version: "1.0.0",
});

server.registerTool(
  "ping",
  { description: "Check if the server is alive" },
  async () => {
    return { content: [{ type: "text", text: "pong" }] };
  },
);

registerSessionTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
