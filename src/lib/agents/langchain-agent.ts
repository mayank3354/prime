import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
//import { createStructuredOutputChainFromZod } from "langchain/chains/openai_functions";
import { z } from "zod";
//import { JsonOutputParser } from "langchain/output_parsers";

// Define the output schema
const ResearchOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({
    title: z.string(),
    content: z.string(),
    source: z.string(),
    relevance: z.enum(["High", "Medium", "Low"]),
    credibility: z.enum(["1", "2", "3", "4", "5"])
  })),
  references: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    publishDate: z.string(),
    credibilityScore: z.enum(["1", "2", "3", "4", "5"])
  }))
});

// Initialize Supabase client and vector store
const initVectorStore = async () => {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PRIVATE_KEY!
  );

  return new SupabaseVectorStore(
    new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    }), 
    {
      client,
      tableName: "documents",
      queryName: "match_documents",
    }
  );
};

// Create the research prompt
const researchPrompt = ChatPromptTemplate.fromMessages([
  ["system", `You are a research assistant that provides detailed, accurate information.
    Analyze the search results and create a structured report with:
    - A clear summary
    - Key findings with relevance and credibility scores
    - Verified references
    
    Focus on accuracy and cite your sources.`],
  ["human", "{query}"],
  ["assistant", "I'll research this and provide a structured report."],
  ["human", "Search results: {search_results}"]
]);

export class ResearchAgent {
  private model: ChatOpenAI | ChatGoogleGenerativeAI;
  private searchTool: TavilySearchResults;
  private vectorStore: SupabaseVectorStore | null = null;

  constructor() {
    // Initialize the model (using OpenAI or Google, based on available API keys)
    this.model = process.env.OPENAI_API_KEY 
      ? new ChatOpenAI({ temperature: 0.3 })
      : new ChatGoogleGenerativeAI({ 
          modelName: "gemini-pro",
          temperature: 0.3,
        });

    // Initialize the search tool
    this.searchTool = new TavilySearchResults({
      apiKey: process.env.TAVILY_API_KEY!,
    });
  }

  async validateSetup(): Promise<boolean> {
    try {
      // Check required API keys
      const requiredKeys = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        TAVILY_API_KEY: process.env.TAVILY_API_KEY,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_PRIVATE_KEY: process.env.SUPABASE_PRIVATE_KEY,
      };

      const missingKeys = Object.entries(requiredKeys)
        .filter(([ value]) => !value)
        .map(([key]) => key);

      if (missingKeys.length > 0) {
        throw new Error(`Missing required API keys: ${missingKeys.join(', ')}`);
      }

      // Initialize vector store
      this.vectorStore = await initVectorStore();
      
      return true;
    } catch (error) {
      console.error('Setup validation failed:', error);
      return false;
    }
  }

  async research(query: string) {
    try {
      // Perform search
      const searchResults = await this.searchTool.invoke(query);

      // Create the chain with structured output
      const chain = researchPrompt.pipe(
        this.model.withStructuredOutput(ResearchOutputSchema)
      );

      // Run the chain
      const result = await chain.invoke({
        query,
        search_results: JSON.stringify(searchResults),
      });

      // Store the result in vector store
      if (this.vectorStore) {
        await this.vectorStore.addDocuments([{
          pageContent: JSON.stringify(result),
          metadata: { query, timestamp: new Date().toISOString() }
        }]);
      }

      return result;
    } catch (error) {
      console.error('Research error:', error);
      throw error;
    }
  }

  async findSimilarQueries(query: string) {
    if (!this.vectorStore) return [];

    try {
      const results = await this.vectorStore.similaritySearch(query, 3);
      return results.map(doc => ({
        query: doc.metadata.query,
        timestamp: doc.metadata.timestamp,
      }));
    } catch (error) {
      console.error('Similar queries search error:', error);
      return [];
    }
  }
} 