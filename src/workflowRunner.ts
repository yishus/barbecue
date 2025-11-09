import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { Eta } from "eta";

import availableTools from "./tools";
import { snakeToCamel } from "./helper";

import type { ConversationItem } from "openai/resources/conversations";
import type {
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses";

export interface Workflow {
  directory: string;
  steps: Array<string | string[]>;
  systemPrompt?: string;
  tools?: string[];
  files?: string[];
}

export interface PromptData {
  workflow: {
    file?: string;
  };
}

export const execute = async (workflow: Workflow) => {
  if (workflow.files && workflow.files.length > 0) {
    for (const file of workflow.files) {
      runSingleWorkflow(workflow, file);
    }
  } else {
    runSingleWorkflow(workflow);
  }
};

const runSingleWorkflow = async (workflow: Workflow, filePath?: string) => {
  const client = new OpenAI();
  const { steps, systemPrompt, tools: workflowTools } = workflow;

  const initialItems = [
    {
      type: "message",
      role: "system",
      content:
        systemPrompt || filePath
          ? `You are working on the file: ${filePath}`
          : "You are a helpful assistant.",
    },
  ];

  const conversation = await client.conversations.create({
    items: initialItems,
  });

  const promptData: PromptData = {
    workflow: {
      file: filePath,
    },
  };

  for (const step of steps) {
    if (Array.isArray(step)) {
      const parallelSteps = step.map((s) =>
        processStep(s, workflow, promptData, client, conversation),
      );
      await Promise.all(parallelSteps);
    } else {
      await processStep(step, workflow, promptData, client, conversation);
    }
  }

  const items = await client.conversations.items.list(conversation.id, {
    limit: 5,
  });
  printAssistantLastMessage(items.data);
};

const processStep = async (
  step: string,
  workflow: Workflow,
  promptData: PromptData,
  client: OpenAI,
  conversation: OpenAI.Conversations.Conversation,
) => {
  const { tools: workflowTools } = workflow;

  console.log("Processing step:", step);

  const tools = toolDefinitions(workflowTools || []);
  const stepPromptContent = await stepPrompt(workflow, step, promptData);
  const res = await client.responses.create({
    conversation: conversation.id,
    model: "gpt-4.1-nano",
    input: [
      {
        role: "user",
        content: stepPromptContent || step,
      },
    ],
    tools,
  });

  console.log("Assistant:", res.output_text);

  let responseContainsFunctionCall = res.output.some(
    (item) => item.type === "function_call",
  );

  while (responseContainsFunctionCall) {
    let functionResults: ResponseInputItem.FunctionCallOutput[] = [];

    for (const item of res.output) {
      if (item.type === "function_call") {
        console.log("Invoking tool:", item.name);
        console.log("With arguments:", item.arguments);
        const tool =
          availableTools[
            snakeToCamel(item.name) as keyof typeof availableTools
          ];
        if (tool) {
          const functionResult = await tool.callFunction(
            JSON.parse(item.arguments),
          );
          functionResults.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: functionResult || "No output returned.",
          });
        }
      }
    }

    if (functionResults.length > 0) {
      const functionOutputResponse = await client.responses.create({
        conversation: conversation.id,
        model: "gpt-4.1-nano",
        input: functionResults,
        tools,
      });
      responseContainsFunctionCall = functionOutputResponse.output.some(
        (item) => item.type === "function_call",
      );
    }
  }
};

const stepPrompt = async (
  workflow: Workflow,
  step: string,
  data: PromptData,
): Promise<string | null> => {
  try {
    console.log(`${workflow.directory}/${step}/prompt.md`);
    const promptString = await readFile(
      `${workflow.directory}/${step}/prompt.md`,
      {
        encoding: "utf8",
      },
    );
    const eta = new Eta();
    const stepContent = await eta.renderStringAsync(promptString, data);
    return stepContent;
  } catch (err) {
    console.log(err);
    return null;
  }
};

const toolDefinitions = (selectedTools: string[]): Tool[] => {
  const definitions = [];
  for (const tool of selectedTools) {
    const validToolName = tool as keyof typeof availableTools;
    definitions.push(availableTools[validToolName].definition);
  }

  return definitions;
};

const printAssistantLastMessage = (items: ConversationItem[]) => {
  for (const item of items) {
    if (item.type === "message") {
      if (item.role !== "assistant") {
        return;
      }
      for (const contentItem of item.content) {
        if ("text" in contentItem) {
          console.log(contentItem.text);
          return;
        }
      }
    }
  }
};
