import { glob } from "glob";

import type { Tool } from "openai/resources/responses/responses";

const definition: Tool = {
  type: "function",
  name: "search_files",
  description:
    "Searches for files in a directory matching a specific filename pattern and returns their paths.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "The glob pattern to match files against.",
      },
      path: {
        type: "string",
        description:
          "The directory to search in. Defaults to the current working directory.",
      },
    },
    required: ["pattern"],
    additionalProperties: false,
  },
  strict: true,
};

const callFunction = async (args: { pattern: string; path?: string }) => {
  const { pattern, path = "." } = args;
  const files = await glob(pattern, { cwd: path, absolute: true });
  return files.join("\n");
};

export default {
  callFunction,
  definition,
};
