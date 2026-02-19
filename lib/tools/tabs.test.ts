import { beforeEach, describe, expect, mock, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const zellijActionOrThrowMock = mock();

mock.module("../zellij.ts", () => ({
  zellijActionOrThrow: zellijActionOrThrowMock,
}));

const { registerTabTools } = await import("./tabs.ts");

interface ToolEntry {
  handler: (
    ...args: unknown[]
  ) => Promise<{ content: { type: string; text: string }[] }>;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerTabTools(server);

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

describe("zellij_go_to_tab", () => {
  test("calls zellijActionOrThrow with go-to-tab-name and the tab name", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_go_to_tab", { name: "editor" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "go-to-tab-name",
      "editor",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: 'Switched to tab "editor".' }],
    });
  });

  test("passes through different tab names", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_go_to_tab", { name: "server" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "go-to-tab-name",
      "server",
    ]);
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("tab not found"));
    await expect(
      callTool("zellij_go_to_tab", { name: "nonexistent" }),
    ).rejects.toThrow("tab not found");
  });
});

describe("zellij_new_tab", () => {
  test("calls zellijActionOrThrow with new-tab and name", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_tab", { name: "debug" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-tab",
      "--name",
      "debug",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: 'Created new tab "debug".' }],
    });
  });

  test("calls zellijActionOrThrow with just new-tab when no options given", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_tab", {});

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["new-tab"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Created new tab (unnamed)." }],
    });
  });

  test("passes layout flag when layout is provided", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_tab", {
      name: "test",
      layout: "/path/to/layout.kdl",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-tab",
      "--name",
      "test",
      "--layout",
      "/path/to/layout.kdl",
    ]);
  });

  test("passes cwd flag when cwd is provided", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_tab", {
      name: "project",
      cwd: "/home/user/project",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-tab",
      "--name",
      "project",
      "--cwd",
      "/home/user/project",
    ]);
  });

  test("passes all options together", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_tab", {
      name: "full",
      layout: "compact.kdl",
      cwd: "/tmp",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-tab",
      "--name",
      "full",
      "--layout",
      "compact.kdl",
      "--cwd",
      "/tmp",
    ]);
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("layout not found"));
    await expect(
      callTool("zellij_new_tab", { layout: "bad.kdl" }),
    ).rejects.toThrow("layout not found");
  });
});

describe("zellij_rename_tab", () => {
  test("calls zellijActionOrThrow with rename-tab and the new name", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_rename_tab", {
      name: "my-new-name",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "rename-tab",
      "my-new-name",
    ]);
    expect(result).toEqual({
      content: [
        { type: "text", text: 'Renamed focused tab to "my-new-name".' },
      ],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("no focused tab"));
    await expect(
      callTool("zellij_rename_tab", { name: "test" }),
    ).rejects.toThrow("no focused tab");
  });
});

describe("zellij_close_tab", () => {
  test("calls zellijActionOrThrow with close-tab", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_close_tab");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["close-tab"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Closed the focused tab." }],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(
      new Error("cannot close last tab"),
    );
    await expect(callTool("zellij_close_tab")).rejects.toThrow(
      "cannot close last tab",
    );
  });
});
