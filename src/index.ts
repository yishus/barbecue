import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { fileStatAtPath } from "./helper";
import { execute } from "./workflowRunner";

import type { Configuration } from "./workflowRunner";

const runWorkflowAtPath = async (filePath: string, target?: string) => {
  let configuration: Configuration = {
    directory: path.dirname(filePath),
    steps: [],
  };
  const data = await readFile(filePath, { encoding: "utf8" });
  const configurationFromFile = JSON.parse(data) as Configuration;
  // TODO Support other forms of targets
  configuration = {
    ...configuration,
    ...configurationFromFile,
    files: target ? [target] : undefined,
  };

  execute(configuration);
};

const main = async () => {
  const options = {
    target: {
      type: "string",
      short: "t",
    },
  } as const;
  const {
    positionals,
    values: { target },
  } = parseArgs({
    options,
    allowPositionals: true,
  });
  const workflowPath = positionals[0];
  const res = await fileStatAtPath(workflowPath);
  if (res?.isDirectory) {
    // Add trailing slash if not present
    runWorkflowAtPath(
      `${workflowPath.replace(/([^/])$/, "$1/")}workflow.json`,
      target,
    );
  } else if (res?.isFile) {
    runWorkflowAtPath(workflowPath, target);
  } else {
    console.log("Please pass a file or directory path.");
  }
};

main();
