import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

const transport = new StdioServerTransport();
await server.connect(transport);
