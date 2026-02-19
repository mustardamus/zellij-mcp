import { beforeEach, describe, expect, mock, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const zellijActionOrThrowMock = mock();
const getFocusedTabNameMock = mock();
const withFocusPreservationMock = mock();

mock.module("../zellij.ts", () => ({
  zellijActionOrThrow: zellijActionOrThrowMock,
  getFocusedTabName: getFocusedTabNameMock,
  withFocusPreservation: withFocusPreservationMock,
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
  getFocusedTabNameMock.mockReset();
  withFocusPreservationMock.mockReset();

  // Default: withFocusPreservation executes the action and respects the preserve flag
  withFocusPreservationMock.mockImplementation(
    async (action: () => Promise<unknown>, _preserve: boolean) => {
      return action();
    },
  );
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
  test("calls withFocusPreservation with preserve=true by default", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_tab", { name: "debug" });

    expect(withFocusPreservationMock).toHaveBeenCalledTimes(1);
    const [, preserve] = withFocusPreservationMock.mock.calls[0]!;
    expect(preserve).toBe(true);
  });

  test("calls zellijActionOrThrow with new-tab and name", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_tab", { name: "debug" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-tab",
      "--name",
      "debug",
    ]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Created new tab "debug" (focus preserved on original tab).',
        },
      ],
    });
  });

  test("calls withFocusPreservation with preserve=false when switch_to is true", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_tab", {
      name: "debug",
      switch_to: true,
    });

    const [, preserve] = withFocusPreservationMock.mock.calls[0]!;
    expect(preserve).toBe(false);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Created new tab "debug" and switched to it.',
        },
      ],
    });
  });

  test("calls zellijActionOrThrow with just new-tab when no options given", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_tab", {});

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["new-tab"]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Created new tab (unnamed) (focus preserved on original tab).",
        },
      ],
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
  test("calls zellijActionOrThrow with rename-tab when no target", async () => {
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

  test("navigates to target tab, renames, and restores focus", async () => {
    getFocusedTabNameMock.mockResolvedValue("editor");
    zellijActionOrThrowMock.mockResolvedValue("");

    const result = await callTool("zellij_rename_tab", {
      name: "new-name",
      target: "server",
    });

    expect(getFocusedTabNameMock).toHaveBeenCalledTimes(1);
    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(3);
    expect(zellijActionOrThrowMock.mock.calls[0]![0]).toEqual([
      "go-to-tab-name",
      "server",
    ]);
    expect(zellijActionOrThrowMock.mock.calls[1]![0]).toEqual([
      "rename-tab",
      "new-name",
    ]);
    expect(zellijActionOrThrowMock.mock.calls[2]![0]).toEqual([
      "go-to-tab-name",
      "editor",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: 'Renamed tab "server" to "new-name".' }],
    });
  });

  test("does not restore focus if target is the focused tab", async () => {
    getFocusedTabNameMock.mockResolvedValue("server");
    zellijActionOrThrowMock.mockResolvedValue("");

    await callTool("zellij_rename_tab", {
      name: "new-name",
      target: "server",
    });

    // go-to-tab-name server + rename-tab new-name (no restore since target === focused)
    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(2);
  });

  test("does not restore focus if getFocusedTabName returns null", async () => {
    getFocusedTabNameMock.mockResolvedValue(null);
    zellijActionOrThrowMock.mockResolvedValue("");

    await callTool("zellij_rename_tab", {
      name: "new-name",
      target: "server",
    });

    // go-to-tab-name server + rename-tab new-name (no restore since focused is null)
    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(2);
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("no focused tab"));
    await expect(
      callTool("zellij_rename_tab", { name: "test" }),
    ).rejects.toThrow("no focused tab");
  });
});

describe("zellij_close_tab", () => {
  test("calls zellijActionOrThrow with close-tab when no target", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_close_tab");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["close-tab"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Closed the focused tab." }],
    });
  });

  test("navigates to target tab, closes, and restores focus", async () => {
    getFocusedTabNameMock.mockResolvedValue("editor");
    zellijActionOrThrowMock.mockResolvedValue("");

    const result = await callTool("zellij_close_tab", { target: "server" });

    expect(getFocusedTabNameMock).toHaveBeenCalledTimes(1);
    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(3);
    expect(zellijActionOrThrowMock.mock.calls[0]![0]).toEqual([
      "go-to-tab-name",
      "server",
    ]);
    expect(zellijActionOrThrowMock.mock.calls[1]![0]).toEqual(["close-tab"]);
    expect(zellijActionOrThrowMock.mock.calls[2]![0]).toEqual([
      "go-to-tab-name",
      "editor",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: 'Closed tab "server".' }],
    });
  });

  test("does not restore focus if target is the focused tab", async () => {
    getFocusedTabNameMock.mockResolvedValue("server");
    zellijActionOrThrowMock.mockResolvedValue("");

    await callTool("zellij_close_tab", { target: "server" });

    // go-to-tab-name server + close-tab (no restore since target === focused)
    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(2);
  });

  test("does not restore focus if getFocusedTabName returns null", async () => {
    getFocusedTabNameMock.mockResolvedValue(null);
    zellijActionOrThrowMock.mockResolvedValue("");

    await callTool("zellij_close_tab", { target: "server" });

    // go-to-tab-name server + close-tab (no restore since focused is null)
    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(2);
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
