import { spawn } from "node:child_process";

import type { SpawnOptions } from "node:child_process";
import type { Tool } from "openai/resources/responses/responses";

interface SpawnResult {
  stdout: string;
  stderr: string;
}

const definition: Tool = {
  type: "function",
  name: "grep",
  description:
    "Searches for a specific string pattern within the provided directory (defaults to current directory) and returns matching lines along with their file paths.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description:
          "The regular expression pattern to search for in file contents.",
      },
      path: {
        type: "string",
        description:
          "The directory to search in. Defaults to the current working directory.",
      },
      include: {
        type: "string",
        description:
          "File pattern to include in the search (e.g. '*.js', '*.{ts,tsx}')",
      },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  strict: true,
};

const callFunction = async (args: {
  pattern: string;
  path?: string;
  include?: string;
}) => {
  const { pattern, path = ".", include } = args;
  try {
    const { stdout } = await spawnAsync("rg", [
      pattern,
      path,
      ...(include ? ["-g", include] : []),
    ]);
    console.log("stdout:", stdout);
    return stdout;
  } catch (error) {
    if (error instanceof Error) {
      console.error("error:", error.message);
    } else {
      console.error("An unknown error occurred");
    }
  }
};

const spawnAsync = (
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
): Promise<SpawnResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdoutData = "";
    let stderrData = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdoutData += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderrData += data.toString();
    });

    // Use 'error' for system errors (e.g., command not found)
    child.on("error", (err: Error) => {
      reject(err);
    });

    // Use 'close' for when the stdio streams have been closed (usually follows 'exit')
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve({ stdout: stdoutData, stderr: stderrData });
      } else {
        // Reject with a clear error message including the exit code and stderr
        reject(
          new Error(`Process failed with code ${code}. Stderr: ${stderrData}`),
        );
      }
    });
  });
};

export default {
  callFunction,
  definition,
};
