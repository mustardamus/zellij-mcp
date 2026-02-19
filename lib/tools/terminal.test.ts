import { beforeEach, describe, expect, mock, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const zellijActionOrThrowMock = mock();
const zellijMock = mock();
const withFocusPreservationMock = mock();

mock.module("../zellij.ts", () => ({
  zellijActionOrThrow: zellijActionOrThrowMock,
  zellij: zellijMock,
  withFocusPreservation: withFocusPreservationMock,
}));

const readFileMock = mock();
const unlinkMock = mock();

mock.module("node:fs/promises", () => ({
  readFile: readFileMock,
  unlink: unlinkMock,
}));

const { registerTerminalTools } = await import("./terminal.ts");

interface ToolEntry {
  handler: (
    ...args: unknown[]
  ) => Promise<{ content: { type: string; text: string }[] }>;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerTerminalTools(server);

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
  zellijMock.mockReset();
  readFileMock.mockReset();
  unlinkMock.mockReset();
  withFocusPreservationMock.mockReset();

  withFocusPreservationMock.mockImplementation(
    async (action: () => Promise<unknown>, _preserve: boolean) => {
      return action();
    },
  );
});

describe("zellij_write_to_pane", () => {
  test("calls zellijActionOrThrow with write-chars and the characters", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_write_to_pane", {
      chars: "ls -la\n",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith([
      "write-chars",
      "ls -la\n",
    ]);
    expect(result).toEqual({
      content: [
        { type: "text", text: "Sent 7 character(s) to the focused pane." },
      ],
    });
  });

  test("handles empty string", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_write_to_pane", { chars: "" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledWith(["write-chars", ""]);
    expect(result).toEqual({
      content: [
        { type: "text", text: "Sent 0 character(s) to the focused pane." },
      ],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("write failed"));
    await expect(
      callTool("zellij_write_to_pane", { chars: "test" }),
    ).rejects.toThrow("write failed");
  });
});

describe("zellij_execute_command", () => {
  test("calls write-chars for the command text then write 13 for Enter", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_execute_command", {
      command: "ls -la",
    });

    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(2);
    expect(zellijActionOrThrowMock).toHaveBeenNthCalledWith(1, [
      "write-chars",
      "ls -la",
    ]);
    expect(zellijActionOrThrowMock).toHaveBeenNthCalledWith(2, ["write", "13"]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Executed command in the focused pane: ls -la",
        },
      ],
    });
  });

  test("handles empty command (still sends Enter)", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    const result = await callTool("zellij_execute_command", { command: "" });

    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(2);
    expect(zellijActionOrThrowMock).toHaveBeenNthCalledWith(1, [
      "write-chars",
      "",
    ]);
    expect(zellijActionOrThrowMock).toHaveBeenNthCalledWith(2, ["write", "13"]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Executed command in the focused pane: ",
        },
      ],
    });
  });

  test("propagates errors from write-chars", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("write failed"));
    await expect(
      callTool("zellij_execute_command", { command: "test" }),
    ).rejects.toThrow("write failed");
  });

  test("propagates errors from write 13", async () => {
    zellijActionOrThrowMock
      .mockResolvedValueOnce("")
      .mockRejectedValueOnce(new Error("enter failed"));
    await expect(
      callTool("zellij_execute_command", { command: "test" }),
    ).rejects.toThrow("enter failed");
  });
});

describe("zellij_read_pane", () => {
  test("calls dump-screen, reads the temp file, and cleans up", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    readFileMock.mockResolvedValue("line 1\nline 2\nline 3\n");
    unlinkMock.mockResolvedValue(undefined);

    const result = await callTool("zellij_read_pane");

    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(1);
    const call = zellijActionOrThrowMock.mock.calls[0];
    expect(call).toBeDefined();
    const callArgs = call![0] as string[];
    expect(callArgs[0]).toBe("dump-screen");
    expect(callArgs).toHaveLength(2);
    expect(callArgs[1]).toMatch(/^\/tmp\/zellij-mcp-dump-\d+\.txt$/);

    expect(readFileMock).toHaveBeenCalledWith(callArgs[1], "utf-8");
    expect(unlinkMock).toHaveBeenCalledWith(callArgs[1]);

    expect(result).toEqual({
      content: [{ type: "text", text: "line 1\nline 2\nline 3" }],
    });
  });

  test("cleans up temp file even if readFile fails", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    readFileMock.mockRejectedValue(new Error("read failed"));
    unlinkMock.mockResolvedValue(undefined);

    await expect(callTool("zellij_read_pane")).rejects.toThrow("read failed");
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  test("does not throw if unlink fails", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    readFileMock.mockResolvedValue("content\n");
    unlinkMock.mockRejectedValue(new Error("unlink failed"));

    const result = await callTool("zellij_read_pane");
    expect(result).toEqual({
      content: [{ type: "text", text: "content" }],
    });
  });

  test("uses ZELLIJ_MCP_DUMP_DIR env var when set", async () => {
    const original = process.env.ZELLIJ_MCP_DUMP_DIR;
    process.env.ZELLIJ_MCP_DUMP_DIR = "/custom/dump/dir";

    try {
      zellijActionOrThrowMock.mockResolvedValue("");
      readFileMock.mockResolvedValue("output\n");
      unlinkMock.mockResolvedValue(undefined);

      await callTool("zellij_read_pane");

      const call = zellijActionOrThrowMock.mock.calls[0];
      expect(call).toBeDefined();
      const callArgs = call![0] as string[];
      expect(callArgs[1]).toMatch(
        /^\/custom\/dump\/dir\/zellij-mcp-dump-\d+\.txt$/,
      );
    } finally {
      if (original === undefined) {
        delete process.env.ZELLIJ_MCP_DUMP_DIR;
      } else {
        process.env.ZELLIJ_MCP_DUMP_DIR = original;
      }
    }
  });

  test("falls back to /tmp when ZELLIJ_MCP_DUMP_DIR is not set", async () => {
    const original = process.env.ZELLIJ_MCP_DUMP_DIR;
    delete process.env.ZELLIJ_MCP_DUMP_DIR;

    try {
      zellijActionOrThrowMock.mockResolvedValue("");
      readFileMock.mockResolvedValue("output\n");
      unlinkMock.mockResolvedValue(undefined);

      await callTool("zellij_read_pane");

      const call = zellijActionOrThrowMock.mock.calls[0];
      expect(call).toBeDefined();
      const callArgs = call![0] as string[];
      expect(callArgs[1]).toMatch(/^\/tmp\/zellij-mcp-dump-\d+\.txt$/);
    } finally {
      if (original !== undefined) {
        process.env.ZELLIJ_MCP_DUMP_DIR = original;
      }
    }
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("dump failed"));
    await expect(callTool("zellij_read_pane")).rejects.toThrow("dump failed");
  });
});

describe("zellij_read_pane_full", () => {
  test("calls dump-screen --full, reads the temp file, and cleans up", async () => {
    zellijActionOrThrowMock.mockResolvedValue("");
    readFileMock.mockResolvedValue("full history\nline 2\n");
    unlinkMock.mockResolvedValue(undefined);

    const result = await callTool("zellij_read_pane_full");

    expect(zellijActionOrThrowMock).toHaveBeenCalledTimes(1);
    const call = zellijActionOrThrowMock.mock.calls[0];
    expect(call).toBeDefined();
    const callArgs = call![0] as string[];
    expect(callArgs[0]).toBe("dump-screen");
    expect(callArgs[1]).toBe("--full");
    expect(callArgs).toHaveLength(3);
    expect(callArgs[2]).toMatch(/^\/tmp\/zellij-mcp-dump-\d+\.txt$/);

    expect(readFileMock).toHaveBeenCalledWith(callArgs[2], "utf-8");
    expect(unlinkMock).toHaveBeenCalledWith(callArgs[2]);

    expect(result).toEqual({
      content: [{ type: "text", text: "full history\nline 2" }],
    });
  });

  test("propagates errors from zellijActionOrThrow", async () => {
    zellijActionOrThrowMock.mockRejectedValue(new Error("dump failed"));
    await expect(callTool("zellij_read_pane_full")).rejects.toThrow(
      "dump failed",
    );
  });
});

describe("zellij_run_command", () => {
  test("calls withFocusPreservation with preserve=true by default", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    await callTool("zellij_run_command", { command: ["npm", "test"] });

    expect(withFocusPreservationMock).toHaveBeenCalledTimes(1);
    const [, preserve] = withFocusPreservationMock.mock.calls[0]!;
    expect(preserve).toBe(true);
  });

  test("calls withFocusPreservation with preserve=false when switch_to is true", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    await callTool("zellij_run_command", {
      command: ["npm", "test"],
      switch_to: true,
    });

    const [, preserve] = withFocusPreservationMock.mock.calls[0]!;
    expect(preserve).toBe(false);
  });

  test("calls zellij with run and the command", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const result = await callTool("zellij_run_command", {
      command: ["npm", "test"],
    });

    expect(zellijMock).toHaveBeenCalledWith(["run", "--", "npm", "test"]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Started command in new tiled pane (unnamed): npm test (focus preserved on original pane)",
        },
      ],
    });
  });

  test("passes --floating flag when floating is true", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    await callTool("zellij_run_command", {
      command: ["ls"],
      floating: true,
    });

    expect(zellijMock).toHaveBeenCalledWith(["run", "--floating", "--", "ls"]);
  });

  test("passes --name flag when name is provided", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const result = await callTool("zellij_run_command", {
      command: ["htop"],
      name: "monitor",
    });

    expect(zellijMock).toHaveBeenCalledWith([
      "run",
      "--name",
      "monitor",
      "--",
      "htop",
    ]);
    expect(result.content[0]?.text).toContain('"monitor"');
  });

  test("passes --close-on-exit flag when close_on_exit is true", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    await callTool("zellij_run_command", {
      command: ["echo", "hello"],
      close_on_exit: true,
    });

    expect(zellijMock).toHaveBeenCalledWith([
      "run",
      "--close-on-exit",
      "--",
      "echo",
      "hello",
    ]);
  });

  test("passes --cwd flag when cwd is provided", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    await callTool("zellij_run_command", {
      command: ["ls"],
      cwd: "/home/user/project",
    });

    expect(zellijMock).toHaveBeenCalledWith([
      "run",
      "--cwd",
      "/home/user/project",
      "--",
      "ls",
    ]);
  });

  test("passes all options together", async () => {
    zellijMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const result = await callTool("zellij_run_command", {
      command: ["npm", "run", "dev"],
      floating: true,
      name: "devserver",
      close_on_exit: true,
      cwd: "/tmp",
      switch_to: true,
    });

    expect(zellijMock).toHaveBeenCalledWith([
      "run",
      "--floating",
      "--name",
      "devserver",
      "--close-on-exit",
      "--cwd",
      "/tmp",
      "--",
      "npm",
      "run",
      "dev",
    ]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Started command in new floating pane "devserver": npm run dev',
        },
      ],
    });
  });

  test("throws on non-zero exit code", async () => {
    zellijMock.mockResolvedValue({
      stdout: "",
      stderr: "command not found",
      exitCode: 1,
    });

    await expect(
      callTool("zellij_run_command", { command: ["nonexistent"] }),
    ).rejects.toThrow("zellij run failed (exit 1): command not found");
  });

  test("uses stdout when stderr is empty on error", async () => {
    zellijMock.mockResolvedValue({
      stdout: "some output",
      stderr: "",
      exitCode: 1,
    });

    await expect(
      callTool("zellij_run_command", { command: ["bad"] }),
    ).rejects.toThrow("zellij run failed (exit 1): some output");
  });
});
