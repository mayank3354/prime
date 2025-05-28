import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { SearchUtils } from './search-utils';

/**
 * Document processing utilities for quality filtering and retrieval
 */
export class DocumentProcessor {
  // Filter documents by quality
  static filterQualityDocuments(docs: Document[]): Document[] {
    return docs.filter(doc => {
      const content = doc.pageContent;
      const contentLength = content.length;
      
      // Filter out very short or very long documents
      if (contentLength < 100 || contentLength > 10000) {
        return false;
      }

      // Filter out documents with too many special characters
      const specialCharRatio = (content.match(/[^\w\s]/g) || []).length / contentLength;
      if (specialCharRatio > 0.3) {
        return false;
      }

      return true;
    });
  }

  // Enhanced relevant document retrieval
  static async getEnhancedRelevantDocs(
    vectorStore: MemoryVectorStore, 
    query: string, 
    k: number
  ): Promise<Document[]> {
    // Get initial results
    const initialDocs = await vectorStore.similaritySearch(query, k * 2);
    
    // Re-rank based on multiple factors
    const rankedDocs = initialDocs
      .map(doc => {
        let score = 0;
        const content = doc.pageContent.toLowerCase();
        const queryTerms = query.toLowerCase().split(/\s+/);
        
        // Term frequency scoring
        queryTerms.forEach(term => {
          const matches = (content.match(new RegExp(term, 'g')) || []).length;
          score += matches;
        });
        
        // Length penalty for very short docs
        if (doc.pageContent.length < 200) {
          score *= 0.5;
        }
        
        // Authority bonus
        if (doc.metadata.source && SearchUtils.isAuthoritativeDomain(SearchUtils.extractDomain(doc.metadata.source))) {
          score *= 1.5;
        }
        
        return { doc, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(item => item.doc);
    
    return rankedDocs;
  }

  // Calculate confidence score
  static calculateConfidence(docs: Document[], findingsCount: number): number {
    let confidence = 0.5; // Base confidence
    
    // Boost for number of sources
    confidence += Math.min(docs.length * 0.05, 0.3);
    
    // Boost for authoritative sources
    const authSources = docs.filter(doc => 
      doc.metadata.source && SearchUtils.isAuthoritativeDomain(SearchUtils.extractDomain(doc.metadata.source))
    ).length;
    confidence += authSources * 0.1;
    
    // Boost for number of findings
    confidence += Math.min(findingsCount * 0.05, 0.2);
    
    return Math.min(confidence, 1.0);
  }

  // Calculate quality score
  static calculateQualityScore(docs: Document[]): number {
    if (docs.length === 0) return 0;
    
    const avgLength = docs.reduce((sum, doc) => sum + doc.pageContent.length, 0) / docs.length;
    const authoritativeCount = docs.filter(doc => 
      doc.metadata.source && SearchUtils.isAuthoritativeDomain(SearchUtils.extractDomain(doc.metadata.source))
    ).length;
    
    let score = 0.5;
    score += Math.min(avgLength / 2000, 0.3); // Content length factor
    score += (authoritativeCount / docs.length) * 0.2; // Authority factor
    
    return Math.min(score, 1.0);
  }
} 