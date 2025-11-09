import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { fileStatAtPath } from "./helper";
import { execute } from "./workflowRunner";

import type { Workflow } from "./workflowRunner";

const runWorkflowAtPath = async (filePath: string, target?: string) => {
  const directory = path.dirname(filePath);
  let workflow: Workflow = { directory, steps: [] };
  try {
    const data = await readFile(filePath, { encoding: "utf8" });
    const workflowFromFile = JSON.parse(data) as Workflow;
    // TODO Support other forms of targets
    workflow = {
      ...workflow,
      ...workflowFromFile,
      files: target ? [target] : undefined,
    };

    const workflowPrompt = await readFile(`${directory}/workflow.md`);
    execute({ ...workflow, systemPrompt: workflowPrompt.toString() });
  } catch (err: any) {
    if (err.code === "ENOENT" && err.path.endsWith("workflow.md")) {
      execute(workflow);
      return;
    }
    console.error("Error reading file:", err);
  }
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
