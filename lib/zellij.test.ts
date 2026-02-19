import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";

const BIN_PATH = join(import.meta.dirname, "..", "bin", "zellij");

const execFileMock = mock();

mock.module("node:child_process", () => ({
  execFile: execFileMock,
}));

const {
  zellij,
  zellijAction,
  zellijActionOrThrow,
  zellijRaw,
  zellijRawOrThrow,
  getFocusedTabName,
  withFocusPreservation,
} = await import("./zellij.ts");

function mockExecResult(error: Error | null, stdout: string, stderr: string) {
  execFileMock.mockImplementation(
    (
      _bin: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      cb(error, stdout, stderr);
    },
  );
}

function mockExecError(code: number | string, stderr = "") {
  const err = Object.assign(new Error("command failed"), { code });
  mockExecResult(err, "", stderr);
}

function mockExecTimeout() {
  const err = Object.assign(new Error("timed out"), { killed: true });
  mockExecResult(err, "", "");
}

function getExecArgs(): {
  bin: string;
  args: string[];
  opts: { timeout: number };
} {
  const call = execFileMock.mock.calls[0] as [
    string,
    string[],
    { timeout: number },
  ];
  return { bin: call[0], args: call[1], opts: call[2] };
}

beforeEach(() => {
  execFileMock.mockReset();
  delete process.env.ZELLIJ_MCP_SESSION;
});

afterEach(() => {
  delete process.env.ZELLIJ_MCP_SESSION;
});

describe("zellij", () => {
  test("prepends --session zellij-mcp by default", async () => {
    mockExecResult(null, "ok", "");
    await zellij(["action", "query-tab-names"]);

    const { bin, args } = getExecArgs();
    expect(bin).toBe(BIN_PATH);
    expect(args).toEqual([
      "--session",
      "zellij-mcp",
      "action",
      "query-tab-names",
    ]);
  });

  test("uses custom session from options", async () => {
    mockExecResult(null, "ok", "");
    await zellij(["action", "query-tab-names"], { session: "my-session" });

    const { args } = getExecArgs();
    expect(args).toEqual([
      "--session",
      "my-session",
      "action",
      "query-tab-names",
    ]);
  });

  test("uses ZELLIJ_MCP_SESSION env var", async () => {
    process.env.ZELLIJ_MCP_SESSION = "env-session";
    mockExecResult(null, "ok", "");
    await zellij(["action", "query-tab-names"]);

    const { args } = getExecArgs();
    expect(args).toEqual([
      "--session",
      "env-session",
      "action",
      "query-tab-names",
    ]);
  });

  test("options.session takes precedence over env var", async () => {
    process.env.ZELLIJ_MCP_SESSION = "env-session";
    mockExecResult(null, "ok", "");
    await zellij(["action", "query-tab-names"], { session: "opt-session" });

    const { args } = getExecArgs();
    expect(args).toEqual([
      "--session",
      "opt-session",
      "action",
      "query-tab-names",
    ]);
  });

  test("raw mode skips session injection", async () => {
    mockExecResult(null, "ok", "");
    await zellij(["list-sessions", "-s"], { raw: true });

    const { args } = getExecArgs();
    expect(args).toEqual(["list-sessions", "-s"]);
  });

  test("returns trimmed stdout and stderr", async () => {
    mockExecResult(null, "  output\n", "  warning\n");
    const result = await zellij(["action", "query-tab-names"]);

    expect(result.stdout).toBe("  output");
    expect(result.stderr).toBe("  warning");
    expect(result.exitCode).toBe(0);
  });

  test("returns numeric exit code from error", async () => {
    mockExecError(42);
    const result = await zellij(["action", "close-tab"]);

    expect(result.exitCode).toBe(42);
  });

  test("returns exit code 1 for non-numeric error code", async () => {
    mockExecError("ENOENT");
    const result = await zellij(["action", "close-tab"]);

    expect(result.exitCode).toBe(1);
  });

  test("returns exit code 0 when no error", async () => {
    mockExecResult(null, "ok", "");
    const result = await zellij(["action", "query-tab-names"]);

    expect(result.exitCode).toBe(0);
  });

  test("rejects on timeout (killed process)", async () => {
    mockExecTimeout();
    await expect(zellij(["action", "query-tab-names"])).rejects.toThrow(
      /timed out/,
    );
  });

  test("passes default timeout to execFile", async () => {
    mockExecResult(null, "ok", "");
    await zellij(["action", "query-tab-names"]);

    const { opts } = getExecArgs();
    expect(opts.timeout).toBe(10_000);
  });

  test("passes custom timeout to execFile", async () => {
    mockExecResult(null, "ok", "");
    await zellij(["action", "query-tab-names"], { timeout: 5000 });

    const { opts } = getExecArgs();
    expect(opts.timeout).toBe(5000);
  });
});

describe("zellijAction", () => {
  test("prepends 'action' to args", async () => {
    mockExecResult(null, "ok", "");
    await zellijAction(["query-tab-names"]);

    const { args } = getExecArgs();
    expect(args).toEqual([
      "--session",
      "zellij-mcp",
      "action",
      "query-tab-names",
    ]);
  });

  test("passes options through", async () => {
    mockExecResult(null, "ok", "");
    await zellijAction(["query-tab-names"], { session: "custom" });

    const { args } = getExecArgs();
    expect(args).toEqual(["--session", "custom", "action", "query-tab-names"]);
  });
});

describe("zellijActionOrThrow", () => {
  test("returns stdout on success", async () => {
    mockExecResult(null, "tab1\ntab2\n", "");
    const result = await zellijActionOrThrow(["query-tab-names"]);

    expect(result).toBe("tab1\ntab2");
  });

  test("throws on non-zero exit with stderr detail", async () => {
    mockExecError(1, "session not found");
    await expect(zellijActionOrThrow(["query-tab-names"])).rejects.toThrow(
      /query-tab-names failed.*session not found/,
    );
  });

  test("throws with stdout detail when stderr is empty", async () => {
    const err = Object.assign(new Error("fail"), { code: 1 });
    execFileMock.mockImplementation(
      (
        _bin: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(err, "stdout error info\n", "");
      },
    );

    await expect(zellijActionOrThrow(["query-tab-names"])).rejects.toThrow(
      /stdout error info/,
    );
  });

  test("throws with 'unknown error' when both streams empty", async () => {
    mockExecError(1, "");
    await expect(zellijActionOrThrow(["query-tab-names"])).rejects.toThrow(
      /unknown error/,
    );
  });
});

describe("zellijRaw", () => {
  test("skips session injection", async () => {
    mockExecResult(null, "session1\nsession2\n", "");
    await zellijRaw(["list-sessions", "-s", "-n"]);

    const { args } = getExecArgs();
    expect(args).toEqual(["list-sessions", "-s", "-n"]);
  });

  test("still passes timeout", async () => {
    mockExecResult(null, "ok", "");
    await zellijRaw(["list-sessions"], { timeout: 3000 });

    const { opts } = getExecArgs();
    expect(opts.timeout).toBe(3000);
  });
});

describe("zellijRawOrThrow", () => {
  test("returns stdout on success", async () => {
    mockExecResult(null, "session1\nsession2\n", "");
    const result = await zellijRawOrThrow(["list-sessions", "-s"]);

    expect(result).toBe("session1\nsession2");
  });

  test("throws on non-zero exit", async () => {
    mockExecError(1, "no sessions");
    await expect(zellijRawOrThrow(["list-sessions"])).rejects.toThrow(
      /list-sessions failed.*no sessions/,
    );
  });
});

describe("getFocusedTabName", () => {
  test("extracts focused tab name from dump-layout output", async () => {
    const layout = `layout {
    tab name="editor" {
        pane
    }
    tab name="server" focus=true {
        pane
    }
    tab name="git" {
        pane
    }
}`;
    mockExecResult(null, layout, "");
    const result = await getFocusedTabName();
    expect(result).toBe("server");
  });

  test("returns first focused tab name", async () => {
    const layout = `layout {
    tab name="agent" focus=true hide_floating_panes=true {
        pane
    }
    tab name="editor" {
        pane
    }
}`;
    mockExecResult(null, layout, "");
    const result = await getFocusedTabName();
    expect(result).toBe("agent");
  });

  test("returns null when no tab has focus=true", async () => {
    const layout = `layout {
    tab name="editor" {
        pane
    }
    tab name="server" {
        pane
    }
}`;
    mockExecResult(null, layout, "");
    const result = await getFocusedTabName();
    expect(result).toBeNull();
  });

  test("handles focus=true with other attributes before it", async () => {
    const layout = `layout {
    tab name="agent" focus=true hide_floating_panes=true {
        pane
    }
}`;
    mockExecResult(null, layout, "");
    const result = await getFocusedTabName();
    expect(result).toBe("agent");
  });
});

describe("withFocusPreservation", () => {
  test("executes action directly when preserve is false", async () => {
    const action = mock().mockResolvedValue("result");
    const result = await withFocusPreservation(action, false);

    expect(result).toBe("result");
    expect(action).toHaveBeenCalledTimes(1);
    // Should NOT call dump-layout (only 0 exec calls for focus)
    expect(execFileMock).not.toHaveBeenCalled();
  });

  test("snapshots focus, runs action, and restores when preserve is true", async () => {
    const calls: string[][] = [];

    // First call: dump-layout (getFocusedTabName)
    // Second call: the action itself (new-tab)
    // Third call: go-to-tab-name (restore)
    execFileMock.mockImplementation(
      (
        _bin: string,
        args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        calls.push(args);

        // dump-layout response
        if (args.includes("dump-layout")) {
          cb(
            null,
            `layout {\n    tab name="original" focus=true {\n        pane\n    }\n}`,
            "",
          );
          return;
        }

        cb(null, "", "");
      },
    );

    const action = async () => {
      await zellijActionOrThrow(["new-tab", "--name", "test"]);
      return "action-done";
    };

    const result = await withFocusPreservation(action, true);

    expect(result).toBe("action-done");
    // Should have called: dump-layout, new-tab, go-to-tab-name
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain("dump-layout");
    expect(calls[1]).toContain("new-tab");
    expect(calls[2]).toContain("go-to-tab-name");
    expect(calls[2]).toContain("original");
  });

  test("does not restore focus when getFocusedTabName returns null", async () => {
    const calls: string[][] = [];

    execFileMock.mockImplementation(
      (
        _bin: string,
        args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        calls.push(args);

        // dump-layout response with no focus=true
        if (args.includes("dump-layout")) {
          cb(
            null,
            `layout {\n    tab name="editor" {\n        pane\n    }\n}`,
            "",
          );
          return;
        }

        cb(null, "", "");
      },
    );

    const action = async () => {
      await zellijActionOrThrow(["new-tab"]);
    };

    await withFocusPreservation(action, true);

    // Should have called: dump-layout, new-tab (NO go-to-tab-name)
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("dump-layout");
    expect(calls[1]).toContain("new-tab");
  });
});
