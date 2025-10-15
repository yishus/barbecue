import { argv } from 'node:process';
import { readFile } from 'node:fs/promises';

import OpenAI from "openai";

interface Workflow {
  steps: string[];
}

const runWorkflow = async (workflow: Workflow) => {
  const client = new OpenAI();
  const { steps } = workflow;

  const conversation = await client.conversations.create();

  for (const step of steps) {
    const response = await client.responses.create({
      conversation: conversation.id,
      model: "gpt-5",
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: step
        }
      ],
    });

    console.log(response.output)
  }
}

const readWorkflow = async (filePath: string) => {
  try {
    const data = await readFile(filePath, { encoding: 'utf8' });
    const workflow = JSON.parse(data) as Workflow;
    runWorkflow(workflow)
  } catch (err) {
    console.error('Error reading file:', err);
  }

}

const main = () => {
  const workflowFilePath = argv[2]
  readWorkflow(workflowFilePath)
}

main();



