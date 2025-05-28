import { TavilyResult } from './types';

/**
 * Utility functions for search operations
 */
export class SearchUtils {
  // Enhanced search query generation
  static generateSearchQueries(query: string): string[] {
    const baseQuery = query.trim();
    const queries = [baseQuery];
    
    // Add variations for better coverage
    if (this.isProgrammingQuery(query)) {
      queries.push(`${baseQuery} tutorial examples`);
      queries.push(`${baseQuery} best practices guide`);
      queries.push(`${baseQuery} documentation official`);
    } else {
      queries.push(`${baseQuery} latest research 2024`);
      queries.push(`${baseQuery} comprehensive guide`);
      queries.push(`${baseQuery} expert analysis`);
    }
    
    // Add specific domain queries
    if (baseQuery.length > 20) {
      const keywords = this.extractKeywords(baseQuery);
      if (keywords.length > 1) {
        queries.push(keywords.slice(0, 3).join(' '));
      }
    }
    
    return queries.slice(0, 3); // Limit to 3 queries to avoid rate limits
  }

  // Get relevant domains for search
  static getRelevantDomains(query: string): string[] {
    const domains: string[] = [];
    
    if (this.isProgrammingQuery(query)) {
      domains.push("stackoverflow.com", "github.com", "developer.mozilla.org", "docs.python.org");
    }
    
    // Add academic domains for research topics
    if (query.toLowerCase().includes('research') || query.toLowerCase().includes('study')) {
      domains.push("arxiv.org", "scholar.google.com", "researchgate.net");
    }
    
    // Add news domains for current events
    if (query.toLowerCase().includes('news') || query.toLowerCase().includes('2024')) {
      domains.push("reuters.com", "bbc.com", "techcrunch.com");
    }
    
    return domains;
  }

  // Deduplicate search results
  static deduplicateResults(results: TavilyResult[]): TavilyResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.url.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Rank results by relevance
  static rankResults(results: TavilyResult[], query: string): TavilyResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return results
      .map(result => {
        let relevanceScore = result.score || 0;
        
        // Boost score based on title relevance
        const titleLower = result.title.toLowerCase();
        const titleMatches = queryTerms.filter(term => titleLower.includes(term)).length;
        relevanceScore += titleMatches * 0.2;
        
        // Boost score based on content relevance
        const contentLower = (result.content || '').toLowerCase();
        const contentMatches = queryTerms.filter(term => contentLower.includes(term)).length;
        relevanceScore += contentMatches * 0.1;
        
        // Boost authoritative domains
        const domain = this.extractDomain(result.url);
        if (this.isAuthoritativeDomain(domain)) {
          relevanceScore += 0.3;
        }
        
        return { ...result, score: relevanceScore };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // Clean content for better processing
  static cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()\-"']/g, '')
      .trim();
  }

  // Extract domain from URL
  static extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  // Check if domain is authoritative
  static isAuthoritativeDomain(domain: string): boolean {
    const authoritative = [
      'wikipedia.org', 'github.com', 'stackoverflow.com', 'mozilla.org',
      'python.org', 'nodejs.org', 'reactjs.org', 'angular.io', 'vuejs.org',
      'arxiv.org', 'nature.com', 'science.org', 'ieee.org'
    ];
    return authoritative.some(auth => domain.includes(auth));
  }

  // Check if query is programming-related
  static isProgrammingQuery(query: string): boolean {
    const programmingKeywords = [
      'code', 'program', 'function', 'algorithm', 'develop', 'software',
      'app', 'application', 'website', 'web', 'javascript', 'python', 'java',
      'c++', 'programming', 'developer', 'development', 'script', 'library',
      'framework', 'api', 'backend', 'frontend', 'fullstack', 'database',
      'sql', 'nosql', 'react', 'angular', 'vue', 'node', 'express', 'django',
      'flask', 'spring', 'boot', 'docker', 'kubernetes', 'devops', 'git',
      'github', 'gitlab', 'bitbucket', 'ci/cd', 'continuous integration',
      'deployment', 'testing', 'unit test', 'integration test', 'e2e test'
    ];
    
    const queryLower = query.toLowerCase();
    return programmingKeywords.some(keyword => queryLower.includes(keyword));
  }

  // Extract keywords from query
  static extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why']);
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5);
  }
} 