import OpenAI from "openai";

import availableTools from "./tools";
import { snakeToCamel } from "./helper";

import type { ConversationItem } from "openai/resources/conversations";
import type {
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses";

export interface Workflow {
  systemPrompt?: string;
  steps: string[];
  tools?: string[];
  files?: string[];
}

export const execute = async (workflow: Workflow) => {
  for (const file of workflow.files || []) {
    runSingleWorkflow(workflow, file);
  }
};

const runSingleWorkflow = async (workflow: Workflow, filePath: string) => {
  const client = new OpenAI();
  const { steps, systemPrompt, tools: workflowTools } = workflow;

  const initialItems = [
    {
      type: "message",
      role: "system",
      content: systemPrompt || `You are working on the file: ${filePath}`,
    },
  ];

  const conversation = await client.conversations.create({
    items: initialItems,
  });

  const tools = toolDefinitions(workflowTools || []);

  for (const step of steps) {
    console.log("Processing step:", step);
    const res = await client.responses.create({
      conversation: conversation.id,
      model: "gpt-4.1-nano",
      input: [
        {
          role: "user",
          content: step,
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
  }

  const items = await client.conversations.items.list(conversation.id, {
    limit: 5,
  });
  printAssistantLastMessage(items.data);
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
