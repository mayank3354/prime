import { Document } from "langchain/document";
import { TavilyResult, TavilyResponse } from './types';
import { SearchUtils } from './search-utils';

/**
 * Tavily search API wrapper for efficient web searching
 */
export class TavilySearcher {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Tavily API key not found. Search functionality will be limited.');
    }
  }

  // Enhanced search with multiple strategies
  async searchWithMultipleQueries(query: string): Promise<Document[]> {
    if (!this.apiKey) {
      console.error("Tavily API key is missing");
      throw new Error("Tavily API key is missing");
    }

    try {
      // Use multiple search queries for better coverage
      const searchQueries = SearchUtils.generateSearchQueries(query);
      const allResults: TavilyResult[] = [];
      
      for (const searchQuery of searchQueries) {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            query: searchQuery,
            search_depth: "advanced",
            include_raw_content: true,
            include_images: false,
            max_results: 5,
            include_domains: SearchUtils.getRelevantDomains(query),
            exclude_domains: ["pinterest.com", "instagram.com", "facebook.com"]
          })
        });
        
        if (response.ok) {
          const data: TavilyResponse = await response.json();
          allResults.push(...data.results);
        } else {
          console.warn(`Search failed for query: ${searchQuery}`);
        }
      }
      
      // Remove duplicates and sort by relevance
      const uniqueResults = SearchUtils.deduplicateResults(allResults);
      const sortedResults = SearchUtils.rankResults(uniqueResults, query);
      
      // Convert to Documents with enhanced metadata
      const documents = sortedResults.slice(0, 15).map(result => {
        return new Document({
          pageContent: SearchUtils.cleanContent(result.raw_content || result.content || ""),
          metadata: { 
            source: result.url,
            title: result.title || "",
            score: result.score || 0,
            domain: SearchUtils.extractDomain(result.url),
            contentLength: (result.raw_content || result.content || "").length
          }
        });
      });
      
      console.log(`Found ${documents.length} high-quality documents from enhanced search`);
      return documents;
      
    } catch (error) {
      console.error("Error fetching documents from Tavily:", error);
      // Create fallback documents
      return [
        new Document({
          pageContent: `Unable to retrieve comprehensive information for: ${query}. This may be due to API limitations or network issues.`,
          metadata: { source: "Error recovery", title: query }
        })
      ];
    }
  }

  // Simple single query search
  async searchSingle(
    query: string, 
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'advanced'
  ): Promise<TavilyResult[]> {
    if (!this.apiKey) {
      throw new Error("Tavily API key is missing");
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query: query,
          search_depth: searchDepth,
          include_raw_content: true,
          include_images: false,
          max_results: maxResults,
          include_domains: SearchUtils.getRelevantDomains(query),
          exclude_domains: ["pinterest.com", "instagram.com", "facebook.com"]
        })
      });
      
      if (response.ok) {
        const data: TavilyResponse = await response.json();
        return data.results;
      } else {
        throw new Error(`Tavily search failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error in Tavily search:", error);
      throw error;
    }
  }

  // Optimized search for speed
  async quickSearch(query: string): Promise<Document[]> {
    if (!this.apiKey) {
      return this.createFallbackDocuments(query);
    }

    try {
      const results = await this.searchSingle(query, 8, 'basic');
      
      return results.map(result => new Document({
        pageContent: SearchUtils.cleanContent(result.content || result.raw_content || ""),
        metadata: { 
          source: result.url,
          title: result.title || "",
          score: result.score || 0,
          domain: SearchUtils.extractDomain(result.url)
        }
      }));
    } catch (error) {
      console.error("Quick search failed:", error);
      return this.createFallbackDocuments(query);
    }
  }

  // Create fallback documents when search fails
  private createFallbackDocuments(query: string): Document[] {
    return [
      new Document({
        pageContent: `Search results unavailable for: ${query}. This may be due to API limitations or network issues.`,
        metadata: { source: "Fallback", title: query }
      })
    ];
  }

  // Check if API key is available
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  // Update API key
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
} 