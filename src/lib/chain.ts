import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    summary: z.string().describe("A concise summary of the GitHub repository"),
    cool_facts: z.array(z.string()).describe("Interesting facts extracted from the README")
  })
);

const prompt = PromptTemplate.fromTemplate(`
Summarize this github repository from the readme file content below.
Format your response using the following structure:
{format_instructions}

README Content:
{readme_content}
`);

export async function summarizeReadme(readmeContent: string) {
  const model = new ChatGoogleGenerativeAI({
    modelName: "gemini-1.5-pro",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.7
  });

  const chain = RunnableSequence.from([
    {
      format_instructions: async () => parser.getFormatInstructions(),
      readme_content: (input: string) => input
    },
    prompt,
    model,
    parser
  ]);

  const response = await chain.invoke(readmeContent);
  
  return response;
} 