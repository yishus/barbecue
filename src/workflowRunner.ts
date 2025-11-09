import { readFile } from "node:fs/promises";
import vm from "node:vm";
import OpenAI from "openai";
import { Eta } from "eta";

import availableTools from "./tools";
import { snakeToCamel } from "./helper";

import type { ConversationItem } from "openai/resources/conversations";
import type {
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses";

export interface Configuration {
  directory: string;
  steps: Array<string | string[]>;
  systemPrompt?: string;
  tools?: string[];
  files?: string[];
}

export interface Workflow {
  output: { [key: string]: any };
  finalOutput: string[];
  file?: string;
}

export const execute = async (configuration: Configuration) => {
  if (configuration.files && configuration.files.length > 0) {
    for (const file of configuration.files) {
      runSingleWorkflow(configuration, file);
    }
  } else {
    runSingleWorkflow(configuration);
  }
};

const runSingleWorkflow = async (
  configuration: Configuration,
  filePath?: string,
) => {
  const workflow: Workflow = { output: {}, finalOutput: [], file: filePath };
  const client = new OpenAI();
  const { steps, systemPrompt } = configuration;

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

  for (const step of steps) {
    if (Array.isArray(step)) {
      const parallelSteps = step.map((s) =>
        processStep(s, workflow, configuration, client, conversation),
      );
      await Promise.all(parallelSteps);
    } else {
      await processStep(step, workflow, configuration, client, conversation);
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
  configuration: Configuration,
  client: OpenAI,
  conversation: OpenAI.Conversations.Conversation,
) => {
  const { tools: workflowTools } = configuration;

  console.log("Processing step:", step);

  const isCustomStep = await runCustomStep(
    step,
    workflow,
    configuration,
    client,
    conversation,
  );
  if (isCustomStep) {
    console.log(`Custom step ${step} executed.`);
    return;
  }

  const tools = toolDefinitions(workflowTools || []);
  const stepPromptContent = await stepPrompt(step, workflow, configuration);
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

  workflow.output[step] = res.output_text;
  console.log("Assistant:", res.output_text);
};

const stepPrompt = async (
  step: string,
  workflow: Workflow,
  configuration: Configuration,
): Promise<string | null> => {
  try {
    const promptString = await readFile(
      `${configuration.directory}/${step}/prompt.md`,
      {
        encoding: "utf8",
      },
    );
    const eta = new Eta();
    const stepContent = await eta.renderStringAsync(promptString, workflow);
    return stepContent;
  } catch (err) {
    console.log(err);
    return null;
  }
};

const runCustomStep = async (
  step: string,
  workflow: Workflow,
  configuration: Configuration,
  client: OpenAI,
  conversation: OpenAI.Conversations.Conversation,
): Promise<Boolean> => {
  try {
    const customStepCode = await readFile(
      `${configuration.directory}/${step}.js`,
      {
        encoding: "utf8",
      },
    );

    const contextObject = {
      workflow,
      appendToFinalOutput: (output: string) => {
        workflow.finalOutput.push(output);
      },
    };

    const res = vm.runInNewContext(customStepCode, contextObject);

    await client.conversations.items.create(conversation.id, {
      items: [
        {
          type: "message",
          role: "user",
          content: `Custom step ${step} executed.`,
        },
        {
          type: "message",
          role: "user",
          content: `Result: ${res}`,
        },
      ],
    });

    workflow.output[step] = res;
    return true;
  } catch (err) {
    return false;
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
