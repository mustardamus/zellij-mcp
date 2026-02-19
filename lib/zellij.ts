import { execFile } from "node:child_process";
import { join } from "node:path";

const BIN_PATH = join(import.meta.dirname, "..", "bin", "zellij");
const DEFAULT_SESSION = "zellij-mcp";
const DEFAULT_TIMEOUT_MS = 10_000;
const POST_ACTION_DELAY_MS = 60;

export interface ZellijResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ZellijOptions {
  /** Override the session name (defaults to ZELLIJ_MCP_SESSION env or "zellij-mcp") */
  session?: string;
  /** Timeout in milliseconds (defaults to 10s) */
  timeout?: number;
  /** If true, skip prepending --session flag (for top-level commands like list-sessions) */
  raw?: boolean;
}

function getSession(options?: ZellijOptions): string {
  return options?.session ?? process.env.ZELLIJ_MCP_SESSION ?? DEFAULT_SESSION;
}

function exec(args: string[], timeout: number): Promise<ZellijResult> {
  return new Promise((resolve, reject) => {
    execFile(BIN_PATH, args, { timeout }, (error, stdout, stderr) => {
      if (error && "killed" in error && error.killed) {
        reject(
          new Error(
            `zellij command timed out after ${timeout}ms: zellij ${args.join(" ")}`,
          ),
        );
        return;
      }

      const code = error?.code;
      const exitCode = typeof code === "number" ? code : code != null ? 1 : 0;

      resolve({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode,
      });
    });
  });
}

/**
 * Execute a zellij CLI command.
 *
 * For `action` subcommands, automatically prepends `--session <name>` so the
 * command targets the correct Zellij session even though this process runs
 * outside of it.
 *
 * For top-level commands (list-sessions, kill-session, etc.) pass `raw: true`
 * to skip session injection.
 */
export async function zellij(
  args: string[],
  options?: ZellijOptions,
): Promise<ZellijResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  let finalArgs: string[];

  if (options?.raw) {
    finalArgs = args;
  } else {
    const session = getSession(options);
    finalArgs = ["--session", session, ...args];
  }

  return exec(finalArgs, timeout);
}

/**
 * Execute a zellij action command. Convenience wrapper that prepends "action"
 * to the args.
 *
 * Example: `zellijAction(["query-tab-names"])` runs `zellij --session X action query-tab-names`
 */
export async function zellijAction(
  args: string[],
  options?: ZellijOptions,
): Promise<ZellijResult> {
  return zellij(["action", ...args], options);
}

/**
 * Execute a zellij action and return stdout. Throws on non-zero exit code.
 *
 * Includes a short post-action delay to allow the Zellij server to process the
 * action before subsequent commands are sent. The CLI process exiting only means
 * it delivered the message — the server handles it asynchronously.
 */
export async function zellijActionOrThrow(
  args: string[],
  options?: ZellijOptions,
): Promise<string> {
  const result = await zellijAction(args, options);

  if (result.exitCode !== 0) {
    const detail = result.stderr || result.stdout || "unknown error";
    throw new Error(
      `zellij action ${args[0]} failed (exit ${result.exitCode}): ${detail}`,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, POST_ACTION_DELAY_MS));

  return result.stdout;
}

/**
 * Execute a top-level zellij command (not an action). Skips session injection.
 *
 * Example: `zellijRaw(["list-sessions", "-s", "-n"])` runs `zellij list-sessions -s -n`
 */
export async function zellijRaw(
  args: string[],
  options?: Omit<ZellijOptions, "raw">,
): Promise<ZellijResult> {
  return zellij(args, { ...options, raw: true });
}

/**
 * Execute a top-level zellij command and return stdout. Throws on non-zero exit code.
 */
export async function zellijRawOrThrow(
  args: string[],
  options?: Omit<ZellijOptions, "raw">,
): Promise<string> {
  const result = await zellijRaw(args, options);

  if (result.exitCode !== 0) {
    const detail = result.stderr || result.stdout || "unknown error";
    throw new Error(
      `zellij ${args[0]} failed (exit ${result.exitCode}): ${detail}`,
    );
  }

  return result.stdout;
}

/**
 * Parse the KDL output of `dump-layout` to find the name of the currently
 * focused tab. Returns the tab name, or null if no focused tab is found.
 */
export async function getFocusedTabName(
  options?: ZellijOptions,
): Promise<string | null> {
  const layout = await zellijActionOrThrow(["dump-layout"], options);
  const match = layout.match(/tab\s+name="([^"]+)"[^{]*\bfocus=true/);
  return match?.[1] ?? null;
}

/**
 * Execute an action while preserving the user's current tab focus.
 *
 * If `preserve` is true (the default): snapshots the focused tab name before
 * the action, runs the action, then switches back to the original tab.
 *
 * If `preserve` is false: just runs the action (raw Zellij behavior).
 */
export async function withFocusPreservation<T>(
  action: () => Promise<T>,
  preserve: boolean,
  options?: ZellijOptions,
): Promise<T> {
  if (!preserve) {
    return action();
  }

  const focusedTab = await getFocusedTabName(options);
  const result = await action();

  if (focusedTab) {
    await zellijActionOrThrow(["go-to-tab-name", focusedTab], options);
  }

  return result;
}
