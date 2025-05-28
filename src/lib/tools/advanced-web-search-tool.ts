import { Tool } from "@langchain/core/tools";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { StatusCallback } from "@/types/research";

export interface AdvancedWebSearchToolInput {
  llm: BaseChatModel;
  tavilyApiKey: string;
  statusCallback: StatusCallback;
  tavilySearchToolOptions?: Record<string, unknown>;
}

export class AdvancedWebSearchTool extends Tool {
  name = "advanced_web_search";
  description = `Performs an advanced web search using multiple query variations to find comprehensive information and then summarizes the findings. Input should be the research query.`;
  
  private llm: BaseChatModel;
  private tavilySearch: TavilySearchResults;
  private updateStatus: StatusCallback;
  private queryGenerationChain: LLMChain;
  private synthesisChain: LLMChain;

  constructor({
    llm,
    tavilyApiKey,
    statusCallback,
    tavilySearchToolOptions = {},
  }: AdvancedWebSearchToolInput) {
    super();
    this.llm = llm;
    this.updateStatus = statusCallback;
    
    this.tavilySearch = new TavilySearchResults({ 
      apiKey: tavilyApiKey,
      ...tavilySearchToolOptions 
    });

    const queryGenerationPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "You are a helpful AI assistant that generates 3 diverse search queries based on a single input query. " +
        "The goal is to explore different facets of the topic. Output a JSON list of strings, for example: [\"query 1\", \"query 2\", \"query 3\"]"
      ),
      HumanMessagePromptTemplate.fromTemplate("Generate search queries for: {query}\nJSON List of strings:"),
    ]);
    this.queryGenerationChain = new LLMChain({ llm: this.llm, prompt: queryGenerationPrompt });

    const synthesisPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "You are a helpful AI assistant. Synthesize the following search results into a single, coherent, and comprehensive summary that directly answers the original query. " +
        "Focus on extracting key information and presenting it clearly. Discard irrelevant information or parts of results that don't contribute to answering the query. Be concise yet informative."
      ),
      HumanMessagePromptTemplate.fromTemplate(
        "Original Query: {original_query}\n\nAggregated Search Results:\n{search_results}\n\nSynthesized Summary:"
      ),
    ]);
    this.synthesisChain = new LLMChain({ llm: this.llm, prompt: synthesisPrompt });
  }

  async _call(originalQuery: string): Promise<string> {
    this.updateStatus({ stage: 'searching', message: "Generating diverse search query variations...", progress: { current: 1, total: 4 } });

    let generatedQueriesJsonString: string;
    try {
      const queryGenResult = await this.queryGenerationChain.call({ query: originalQuery });
      generatedQueriesJsonString = queryGenResult.text;
    } catch (error) {
      console.error("Error during query generation LLM call:", error);
      this.updateStatus({ stage: 'searching', message: "Failed to generate query variations.", progress: { current: 1, total: 4 } });
      // Fallback to just using the original query
      generatedQueriesJsonString = JSON.stringify([originalQuery]);
    }
    
    let queries: string[];
    try {
      queries = JSON.parse(generatedQueriesJsonString || "[]");
      if (!Array.isArray(queries) || queries.length === 0 || queries.some(q => typeof q !== 'string')) {
        console.warn("Parsed queries are not a valid string array, using original query. Parsed:", queries);
        queries = [originalQuery]; // Fallback
      }
    } catch (e) {
      console.warn("Failed to parse generated queries JSON, using original query.", e);
      queries = [originalQuery];
    }
    
    // Ensure original query is included and limit total queries
    if (!queries.includes(originalQuery)) {
        queries.unshift(originalQuery); // Add to the beginning
    }
    queries = [...new Set(queries)].slice(0, 3); // Deduplicate and limit

    this.updateStatus({ stage: 'searching', message: `Performing web searches for ${queries.length} query variations...`, progress: { current: 2, total: 4 } });
    
    const allSearchResultsPromises = queries.map(async (q, index) => {
      try {
        this.updateStatus({ stage: 'searching', message: `Searching for: "${q}" (Variation ${index + 1}/${queries.length})...`, progress: { current: 2, total: 4 } });
        const result = await this.tavilySearch.call(q);
        return `Results for query "${q}":\n${result}`;
      } catch (error) {
        console.error(`Error searching for query "${q}":`, error);
        return `Results for query "${q}":\nError during search. ${error instanceof Error ? error.message : String(error)}`;
      }
    });

    const allSearchResults = await Promise.all(allSearchResultsPromises);
    const combinedResults = allSearchResults.join("\n\n---\n\n");

    this.updateStatus({ stage: 'processing', message: "Synthesizing search results into a comprehensive summary...", progress: { current: 3, total: 4 } });
    
    try {
      const synthesisResult = await this.synthesisChain.call({
        original_query: originalQuery,
        search_results: combinedResults,
      });
      this.updateStatus({ stage: 'complete', message: "Search and synthesis complete.", progress: { current: 4, total: 4 } });
      return synthesisResult.text || "Could not synthesize results from web search.";
    } catch (error) {
      console.error("Error during synthesis LLM call:", error);
      this.updateStatus({ stage: 'searching', message: "Failed to synthesize search results.", progress: { current: 4, total: 4 } });
      return "Error: Could not synthesize search results. Raw data: " + combinedResults.substring(0, 1000); // Return some raw data on error
    }
  }
} 