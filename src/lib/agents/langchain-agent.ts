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
    credibility: z.number(),
    imageUrl: z.string().optional(),
    type: z.enum(["text", "image", "chart", "quote"]).default("text"),
    category: z.string()
  })),
  visualData: z.array(z.object({
    type: z.enum(["image", "chart", "graph", "diagram"]),
    url: z.string(),
    caption: z.string(),
    source: z.string()
  })).optional(),
  keyInsights: z.array(z.object({
    point: z.string(),
    explanation: z.string(),
    supportingEvidence: z.array(z.string())
  })),
  statistics: z.array(z.object({
    value: z.string(),
    metric: z.string(),
    context: z.string(),
    source: z.string()
  })).optional(),
  metadata: z.object({
    sourcesCount: z.number(),
    confidence: z.number(),
    researchDepth: z.enum(["basic", "intermediate", "comprehensive"]),
    lastUpdated: z.string()
  })
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
  ["system", `You are an expert research assistant that provides comprehensive, detailed information.
    Analyze the search results and create a detailed report.
    
    IMPORTANT: Your response must be in valid JSON format with the following structure:
    {
      "summary": "thorough executive summary",
      "findings": [
        {
          "title": "main point",
          "content": "detailed explanation",
          "source": "source url",
          "relevance": "High/Medium/Low",
          "credibility": 0.95,
          "type": "text",
          "category": "category name"
        }
      ],
      "visualData": [
        {
          "type": "image/chart/graph/diagram",
          "url": "image url",
          "caption": "descriptive caption",
          "source": "image source"
        }
      ],
      "keyInsights": [
        {
          "point": "key insight title",
          "explanation": "detailed explanation",
          "supportingEvidence": ["evidence 1", "evidence 2"]
        }
      ],
      "statistics": [
        {
          "value": "statistical value",
          "metric": "metric name",
          "context": "contextual explanation",
          "source": "data source"
        }
      ],
      "metadata": {
        "sourcesCount": 5,
        "confidence": 0.9,
        "researchDepth": "comprehensive",
        "lastUpdated": "2024-03-21T12:00:00Z"
      }
    }

    Ensure your response:
    1. Is valid JSON
    2. Follows the exact structure above
    3. Includes all required fields
    4. Uses proper JSON syntax with double quotes
    `],
  ["human", "{query}"],
  ["assistant", "I'll analyze this and provide a properly formatted JSON response."],
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

      // Add image search results if needed
      if (!result.visualData || result.visualData.length === 0) {
        const imageSearchResults = await this.searchTool.invoke(`${query} relevant images diagrams charts`);
        if (imageSearchResults && Array.isArray(imageSearchResults)) {
          result.visualData = imageSearchResults
            .filter(item => item.url && item.url.match(/\.(jpg|jpeg|png|gif)$/i))
            .slice(0, 4)
            .map(item => ({
              type: "image",
              url: item.url,
              caption: item.title || "Related visual",
              source: item.source || item.url
            }));
        }
      }

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