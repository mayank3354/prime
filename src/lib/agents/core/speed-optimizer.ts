import { Document } from "langchain/document";
import { TavilyResult } from './types';

/**
 * Speed optimization utilities for faster research responses
 */
export class SpeedOptimizer {
  // Determine optimal search strategy based on query complexity
  static getOptimalSearchStrategy(query: string): 'quick' | 'standard' | 'comprehensive' {
    const queryLength = query.length;
    const wordCount = query.split(/\s+/).length;
    
    // Quick search for simple queries
    if (queryLength < 30 && wordCount <= 5) {
      return 'quick';
    }
    
    // Comprehensive search for complex queries
    if (queryLength > 100 || wordCount > 15) {
      return 'comprehensive';
    }
    
    // Standard search for most queries
    return 'standard';
  }

  // Get optimal chunk size based on document count and query complexity
  static getOptimalChunkSize(documentCount: number, queryComplexity: string): number {
    if (queryComplexity === 'quick') {
      return 600; // Smaller chunks for speed
    }
    
    if (documentCount > 20) {
      return 800; // Smaller chunks for many documents
    }
    
    return 1200; // Standard chunk size
  }

  // Determine optimal number of documents to retrieve
  static getOptimalDocumentCount(strategy: string): number {
    switch (strategy) {
      case 'quick':
        return 6;
      case 'standard':
        return 12;
      case 'comprehensive':
        return 18;
      default:
        return 10;
    }
  }

  // Filter results for fastest processing
  static filterForSpeed(results: TavilyResult[]): TavilyResult[] {
    return results
      .filter(result => {
        // Filter out very long content that slows processing
        const contentLength = (result.content || result.raw_content || '').length;
        return contentLength > 100 && contentLength < 5000;
      })
      .slice(0, 10); // Limit to top 10 for speed
  }

  // Prioritize documents for faster processing
  static prioritizeDocuments(docs: Document[]): Document[] {
    return docs
      .map(doc => ({
        doc,
        score: this.calculateSpeedScore(doc)
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.doc);
  }

  // Calculate speed score for document prioritization
  private static calculateSpeedScore(doc: Document): number {
    let score = 1;
    const contentLength = doc.pageContent.length;
    
    // Prefer medium-length documents (faster to process)
    if (contentLength >= 200 && contentLength <= 2000) {
      score += 2;
    }
    
    // Boost authoritative domains
    const domain = doc.metadata?.source ? this.extractDomain(doc.metadata.source) : '';
    if (this.isAuthoritativeDomain(domain)) {
      score += 1;
    }
    
    // Prefer documents with titles
    if (doc.metadata?.title) {
      score += 0.5;
    }
    
    return score;
  }

  // Extract domain from URL
  private static extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  // Check if domain is authoritative (reused from SearchUtils for consistency)
  private static isAuthoritativeDomain(domain: string): boolean {
    const authoritative = [
      'wikipedia.org', 'github.com', 'stackoverflow.com', 'mozilla.org',
      'python.org', 'nodejs.org', 'reactjs.org', 'angular.io', 'vuejs.org',
      'arxiv.org', 'nature.com', 'science.org', 'ieee.org'
    ];
    return authoritative.some(auth => domain.includes(auth));
  }

  // Get timeout values based on strategy
  static getTimeouts(strategy: string): { search: number; processing: number } {
    switch (strategy) {
      case 'quick':
        return { search: 3000, processing: 5000 };
      case 'standard':
        return { search: 5000, processing: 10000 };
      case 'comprehensive':
        return { search: 8000, processing: 15000 };
      default:
        return { search: 5000, processing: 10000 };
    }
  }

  // Create a timeout promise for operations
  static createTimeoutPromise<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // Batch process documents for efficiency
  static batchProcess<T, R>(
    items: T[], 
    processor: (item: T) => Promise<R>, 
    batchSize: number = 3
  ): Promise<R[]> {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches.reduce(async (accPromise, batch) => {
      const acc = await accPromise;
      const batchResults = await Promise.all(batch.map(processor));
      return [...acc, ...batchResults];
    }, Promise.resolve([] as R[]));
  }
} 