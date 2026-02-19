import { beforeEach, describe, expect, mock, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const zellijActionOrThrowMock = mock();

mock.module("../zellij.ts", () => ({
  zellijActionOrThrow: zellijActionOrThrowMock,
}));

const { registerPaneTools } = await import("./panes.ts");

interface ToolEntry {
  handler: (
    ...args: unknown[]
  ) => Promise<{ content: { type: string; text: string }[] }>;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerPaneTools(server);

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

describe("zellij_new_pane", () => {
  test("calls zellijActionOrThrow with new-pane (no options)", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_pane", {});

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["new-pane"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Opened new tiled pane (unnamed)." }],
    });
  });

  test("passes --floating flag when floating is true", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_pane", { floating: true });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-pane",
      "--floating",
    ]);
    expect(result.content[0]?.text).toContain("floating");
  });

  test("passes --name flag when name is provided", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_pane", { name: "scratch" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-pane",
      "--name",
      "scratch",
    ]);
    expect(result.content[0]?.text).toContain('"scratch"');
  });

  test("passes --direction flag for tiled panes", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_pane", { direction: "right" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-pane",
      "--direction",
      "right",
    ]);
  });

  test("ignores direction when floating is true", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_pane", {
      floating: true,
      direction: "right",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-pane",
      "--floating",
    ]);
  });

  test("passes --cwd flag when cwd is provided", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_pane", { cwd: "/home/user/project" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-pane",
      "--cwd",
      "/home/user/project",
    ]);
  });

  test("passes command after -- separator", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_pane", { command: ["npm", "test"] });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-pane",
      "--",
      "npm",
      "test",
    ]);
  });

  test("does not pass -- when command is empty array", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    await callTool("zellij_new_pane", { command: [] });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["new-pane"]);
  });

  test("passes all options together", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_new_pane", {
      floating: true,
      name: "monitor",
      cwd: "/tmp",
      command: ["htop"],
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "new-pane",
      "--floating",
      "--name",
      "monitor",
      "--cwd",
      "/tmp",
      "--",
      "htop",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: 'Opened new floating pane "monitor".' }],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("new-pane failed"));
    await expect(callTool("zellij_new_pane", {})).rejects.toThrow(
      "new-pane failed",
    );
  });
});

describe("zellij_close_pane", () => {
  test("calls zellijActionOrThrow with close-pane", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_close_pane");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["close-pane"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Closed the focused pane." }],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("close-pane failed"));
    await expect(callTool("zellij_close_pane")).rejects.toThrow(
      "close-pane failed",
    );
  });
});

describe("zellij_focus_pane", () => {
  test("calls zellijActionOrThrow with move-focus and direction", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_focus_pane", { direction: "up" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["move-focus", "up"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Moved focus up." }],
    });
  });

  test("handles all directions", async () => {
    for (const direction of ["up", "down", "left", "right"]) {
      zellijActionOrThrowMock.mockReset();
      zellijActionOrThrowMock.mockResolvedValue("");
      const result = await callTool("zellij_focus_pane", { direction });

      expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
        "move-focus",
        direction,
      ]);
      expect(result.content[0]?.text).toBe(`Moved focus ${direction}.`);
    }
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("move-focus failed"));
    await expect(
      callTool("zellij_focus_pane", { direction: "down" }),
    ).rejects.toThrow("move-focus failed");
  });
});

describe("zellij_toggle_floating_panes", () => {
  test("calls zellijActionOrThrow with toggle-floating-panes", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_toggle_floating_panes");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "toggle-floating-panes",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Toggled floating panes." }],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(
      new Error("toggle-floating failed"),
    );
    await expect(callTool("zellij_toggle_floating_panes")).rejects.toThrow(
      "toggle-floating failed",
    );
  });
});

describe("zellij_toggle_fullscreen", () => {
  test("calls zellijActionOrThrow with toggle-fullscreen", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_toggle_fullscreen");

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["toggle-fullscreen"]);
    expect(result).toEqual({
      content: [
        { type: "text", text: "Toggled fullscreen on the focused pane." },
      ],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(
      new Error("toggle-fullscreen failed"),
    );
    await expect(callTool("zellij_toggle_fullscreen")).rejects.toThrow(
      "toggle-fullscreen failed",
    );
  });
});

describe("zellij_rename_pane", () => {
  test("calls zellijActionOrThrow with rename-pane and the name", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_rename_pane", { name: "build" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "rename-pane",
      "build",
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: 'Renamed focused pane to "build".' }],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("rename-pane failed"));
    await expect(
      callTool("zellij_rename_pane", { name: "test" }),
    ).rejects.toThrow("rename-pane failed");
  });
});

describe("zellij_resize_pane", () => {
  test("calls zellijActionOrThrow with resize and direction", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_resize_pane", {
      direction: "down",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["resize", "down"]);
    expect(result).toEqual({
      content: [{ type: "text", text: "Resized focused pane down." }],
    });
  });

  test("handles all directions", async () => {
    for (const direction of ["up", "down", "left", "right"]) {
      zellijActionOrThrowMock.mockReset();
      zellijActionOrThrowMock.mockResolvedValue("");
      const result = await callTool("zellij_resize_pane", { direction });

      expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
        "resize",
        direction,
      ]);
      expect(result.content[0]?.text).toBe(
        `Resized focused pane ${direction}.`,
      );
    }
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("resize failed"));
    await expect(
      callTool("zellij_resize_pane", { direction: "left" }),
    ).rejects.toThrow("resize failed");
  });
});
