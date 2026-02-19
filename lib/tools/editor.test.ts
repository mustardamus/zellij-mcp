import { beforeEach, describe, expect, mock, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const zellijActionOrThrowMock = mock();

mock.module("../zellij.ts", () => ({
  zellijActionOrThrow: zellijActionOrThrowMock,
}));

const { registerEditorTools } = await import("./editor.ts");

interface ToolEntry {
  handler: (...args: unknown[]) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerEditorTools(server);

  const registry = (
    server as unknown as { _registeredTools: Record<string, ToolEntry> }
  )._registeredTools;
  const tool = registry[name];

  if (!tool) {
    throw new Error(`Tool "${name}" not registered`);
  }

  return tool.handler(args);
}

beforeEach(() => {
  zellijActionOrThrowMock.mockReset();
});

describe("zellij_edit_file", () => {
  test("calls zellijActionOrThrow with edit and file path", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_edit_file", {
      file: "src/main.ts",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "src/main.ts",
    ]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Opened "src/main.ts" in $EDITOR in a new tiled pane.',
        },
      ],
    });
  });

  test("passes --floating flag when floating is true", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_edit_file", {
      file: "README.md",
      floating: true,
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "--floating",
      "README.md",
    ]);
    expect(result.content[0]?.text).toContain("floating");
  });

  test("passes --line-number flag when line_number is provided", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_edit_file", {
      file: "src/main.ts",
      line_number: 42,
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "--line-number",
      "42",
      "src/main.ts",
    ]);
    expect(result.content[0]?.text).toContain("at line 42");
  });

  test("passes --direction flag for tiled panes", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_edit_file", {
      file: "src/main.ts",
      direction: "right",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "--direction",
      "right",
      "src/main.ts",
    ]);
  });

  test("ignores direction when floating is true", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_edit_file", {
      file: "src/main.ts",
      floating: true,
      direction: "right",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "--floating",
      "src/main.ts",
    ]);
  });

  test("passes --cwd flag when cwd is provided", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_edit_file", {
      file: "main.ts",
      cwd: "/home/user/project",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "--cwd",
      "/home/user/project",
      "main.ts",
    ]);
  });

  test("passes all options together", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_edit_file", {
      file: "src/index.ts",
      floating: true,
      line_number: 10,
      cwd: "/home/user/project",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "--floating",
      "--cwd",
      "/home/user/project",
      "--line-number",
      "10",
      "src/index.ts",
    ]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Opened "src/index.ts" at line 10 in $EDITOR in a new floating pane.',
        },
      ],
    });
  });

  test("passes tiled options together (direction + cwd + line_number)", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_edit_file", {
      file: "lib/utils.ts",
      direction: "down",
      cwd: "/tmp",
      line_number: 5,
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "edit",
      "--direction",
      "down",
      "--cwd",
      "/tmp",
      "--line-number",
      "5",
      "lib/utils.ts",
    ]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Opened "lib/utils.ts" at line 5 in $EDITOR in a new tiled pane.',
        },
      ],
    });
  });

  test("returns isError on failure", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("edit failed"));
    const result = await callTool("zellij_edit_file", { file: "missing.txt" });
    expect(result).toEqual({
      content: [{ type: "text", text: "edit failed" }],
      isError: true,
    });
  });
});
