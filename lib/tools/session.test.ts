import { beforeEach, describe, expect, mock, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const zellijActionOrThrowMock = mock();
const zellijRawOrThrowMock = mock();

mock.module("../zellij.ts", () => ({
  zellijActionOrThrow: zellijActionOrThrowMock,
  zellijRawOrThrow: zellijRawOrThrowMock,
}));

const { registerSessionTools } = await import("./session.ts");

interface ToolEntry {
  handler: (...args: unknown[]) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}

async function callTool(name: string) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerSessionTools(server);

  const registry = (
    server as unknown as { _registeredTools: Record<string, ToolEntry> }
  )._registeredTools;
  const tool = registry[name];

  if (!tool) {
    throw new Error(`Tool "${name}" not registered`);
  }

  return tool.handler({});
}

beforeEach(() => {
  zellijActionOrThrowMock.mockReset();
  zellijRawOrThrowMock.mockReset();
});

describe("zellij_list_sessions", () => {
  test("calls zellijRawOrThrow with list-sessions flags", async () => {
    zellijRawOrThrowMock.mockResolvedValue("session1\nsession2");
    const result = await callTool("zellij_list_sessions");

    expect(zellijRawOrThrowMock).toHaveBeenCalledWith([
      "list-sessions",
      "--short",
      "--no-formatting",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: "session1\nsession2" }],
    });
  });

  test("returns isError on failure", async () => {
    zellijRawOrThrowMock.mockRejectedValue(new Error("no sessions"));
    const result = await callTool("zellij_list_sessions");
    expect(result).toEqual({
      content: [{ type: "text", text: "no sessions" }],
      isError: true,
    });
  });
});

describe("zellij_query_tab_names", () => {
  test("calls zellijActionOrThrow with query-tab-names", async () => {
    zellijActionOrThrowMock.mockResolvedValue("agent\neditor\nserver\ngit");
    const result = await callTool("zellij_query_tab_names");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["query-tab-names"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "agent\neditor\nserver\ngit" }],
    });
  });

  test("returns isError on failure", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("session not found"));
    const result = await callTool("zellij_query_tab_names");
    expect(result).toEqual({
      content: [{ type: "text", text: "session not found" }],
      isError: true,
    });
  });
});

describe("zellij_dump_layout", () => {
  test("calls zellijActionOrThrow with dump-layout", async () => {
    const layout = 'layout {\n  tab name="agent" {\n  }\n}';
    zellijActionOrThrowMock.mockResolvedValue(layout);
    const result = await callTool("zellij_dump_layout");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["dump-layout"]);
    expect(result).toEqual({
      content: [{ type: "text", text: layout }],
    });
  });

  test("returns isError on failure", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("failed"));
    const result = await callTool("zellij_dump_layout");
    expect(result).toEqual({
      content: [{ type: "text", text: "failed" }],
      isError: true,
    });
  });
});

describe("zellij_list_clients", () => {
  test("calls zellijActionOrThrow with list-clients", async () => {
    const clientOutput =
      "CLIENT_ID ZELLIJ_PANE_ID RUNNING_COMMAND\n1 terminal_3 vim";
    zellijActionOrThrowMock.mockResolvedValue(clientOutput);
    const result = await callTool("zellij_list_clients");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["list-clients"]);
    expect(result).toEqual({
      content: [{ type: "text", text: clientOutput }],
    });
  });

  test("returns isError on failure", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("failed"));
    const result = await callTool("zellij_list_clients");
    expect(result).toEqual({
      content: [{ type: "text", text: "failed" }],
      isError: true,
    });
  });
});
