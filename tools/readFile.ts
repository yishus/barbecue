import { readdir, readFile } from "node:fs/promises";

import type { Tool } from "openai/resources/responses/responses";

import { fileStatAtPath } from "../helper";

export const definition: Tool = {
  type: "function",
  name: "read_file",
  description:
    "Reads the content of a file at the specified path. If the path is a directory, list the contents.",
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
    const res = await fileStatAtPath(path);
    if (res?.isDirectory) {
      const files = await readdir(path);
      return `Contents of directory "${path}":\n` + files.join("\n");
    } else if (res?.isFile) {
      const data = await readFile(path, { encoding: "utf8" });
      return data.toString();
    } else {
      return `The path "${path}" does not exist.`;
    }
  } catch (err: any) {
    console.error("Error reading file:", err);
    return `Error reading file at path "${path}": ${err.message}`;
  }
};

export default {
  definition,
  callFunction,
};
