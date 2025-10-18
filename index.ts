import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { argv } from "node:process";

import OpenAI from "openai";

import type { ConversationItem } from "openai/resources/conversations";

interface Workflow {
  systemPrompt?: string;
  steps: string[];
}

const runWorkflow = async (workflow: Workflow) => {
  const client = new OpenAI();
  const { steps } = workflow;

  const initialItems = [
    {
      type: "message",
      role: "system",
      content: workflow.systemPrompt || "You are a helpful assistant.",
    },
  ];

  const conversation = await client.conversations.create({
    items: initialItems,
  });

  for (const step of steps) {
    await client.responses.create({
      conversation: conversation.id,
      model: "gpt-4.1-nano",
      input: [
        {
          role: "user",
          content: step,
        },
      ],
    });
  }

  const items = await client.conversations.items.list(conversation.id, {
    limit: 5,
  });
  printAssistantLastMessage(items.data);
};

const fileStatAtPath = async (path: string) => {
  try {
    const stats = await stat(path);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (err) {
    console.log(err);
  }
};

const runWorkflowAtPath = async (filePath: string) => {
  let workflow: Workflow = { steps: [] };
  try {
    const data = await readFile(filePath, { encoding: "utf8" });
    workflow = JSON.parse(data) as Workflow;

    const directory = path.dirname(filePath);
    const workflowPrompt = await readFile(`${directory}/workflow.md`);
    runWorkflow({ ...workflow, systemPrompt: workflowPrompt.toString() });
  } catch (err: any) {
    if (err.code === "ENOENT" && err.path.endsWith("workflow.md")) {
      runWorkflow(workflow);
      return;
    }
    console.error("Error reading file:", err);
  }
};

const printAssistantLastMessage = (items: ConversationItem[]) => {
  for (const item of items) {
    if (item.type === "message") {
      if (item.role !== "assistant") {
        return;
      }
      item.content.forEach((contentItem) => {
        if ("text" in contentItem) {
          console.log(contentItem.text);
          return;
        }
      });
    }
  });
};

const main = async () => {
  const workflowPath = argv[2];
  const res = await fileStatAtPath(workflowPath);
  if (res?.isDirectory) {
    runWorkflowAtPath(`${workflowPath}/workflow.json`);
  } else if (res?.isFile) {
    runWorkflowAtPath(workflowPath);
  } else {
    console.log("Please pass a file or directory path.");
  }
};

main();
