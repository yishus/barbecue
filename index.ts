import { argv } from "node:process";
import { readFile, stat } from "node:fs/promises";

import OpenAI from "openai";

import type { ConversationItem } from "openai/resources/conversations";

interface Workflow {
  steps: string[];
}

const runWorkflow = async (workflow: Workflow) => {
  const client = new OpenAI();
  const { steps } = workflow;

  const conversation = await client.conversations.create();

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

const readFileAtPath = async (filePath: string) => {
  try {
    const data = await readFile(filePath, { encoding: "utf8" });
    const workflow = JSON.parse(data) as Workflow;
    runWorkflow(workflow);
  } catch (err) {
    console.error("Error reading file:", err);
  }
};

const printAssistantLastMessage = (items: ConversationItem[]) => {
  items.forEach((item) => {
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
    readFileAtPath(`${workflowPath}/workflow.json`);
  } else if (res?.isFile) {
    readFileAtPath(workflowPath);
  } else {
    console.log("Please pass a file or directory path.");
  }
};

main();
