import { readFile } from "node:fs/promises";

import type { Tool } from "openai/resources/responses/responses";

export const definition: Tool = {
  type: "function",
  name: "read_file",
  description: "Reads the content of a file at the specified path.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file to be read.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  strict: true,
};

export const callFunction = async (args: { path: string }) => {
  const { path } = args;

  try {
    const data = await readFile(path, { encoding: "utf8" });

    return data.toString();
  } catch (err: any) {
    console.error("Error reading file:", err);
  }
};

export default {
  definition,
  callFunction,
};
