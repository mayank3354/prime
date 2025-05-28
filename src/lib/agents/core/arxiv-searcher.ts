import axios from 'axios';
import * as cheerio from 'cheerio';
import { ArxivPaper } from './academic-types';
import { ResearchStatus, StatusCallback } from '@/types/research';

/**
 * ArXiv paper search and processing utilities
 */
export class ArxivSearcher {
  private statusCallback?: StatusCallback;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback;
  }

  private updateStatus(status: ResearchStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  async searchPapers(query: string): Promise<ArxivPaper[]> {
    try {
      this.updateStatus({
        stage: 'searching',
        message: 'Searching arXiv for academic papers...',
        progress: { current: 1, total: 5 }
      });

      // Enhanced query construction for better results
      const enhancedQuery = this.enhanceArxivQuery(query);
      
      const response = await axios.get(
        `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(enhancedQuery)}&start=0&max_results=10&sortBy=relevance&sortOrder=descending`,
        { timeout: 10000 }
      );

      const $ = cheerio.load(response.data, { xmlMode: true });
      const papers: ArxivPaper[] = [];

      $('entry').each((_, entry) => {
        const $entry = $(entry);
        const title = $entry.find('title').text().trim();
        const summary = $entry.find('summary').text().trim();
        
        // Filter out low-quality or irrelevant papers
        if (this.isRelevantPaper(title, summary, query)) {
          papers.push({
            id: $entry.find('id').text(),
            title: title,
            authors: $entry.find('author name').map((_, name) => $(name).text()).get(),
            summary: summary,
            published: $entry.find('published').text(),
            link: $entry.find('link[title="pdf"]').attr('href') || $entry.find('id').text(),
            pdfLink: $entry.find('link[title="pdf"]').attr('href')
          });
        }
      });

      console.log(`Found ${papers.length} relevant papers from arXiv`);
      return papers.slice(0, 5); // Limit to top 5 most relevant papers
    } catch (error) {
      console.error('arXiv search error:', error);
      this.updateStatus({
        stage: 'searching',
        message: 'arXiv search encountered issues, continuing with other sources...',
        progress: { current: 1, total: 5 }
      });
      return [];
    }
  }

  private enhanceArxivQuery(query: string): string {
    // Add relevant academic terms and categories
    const academicTerms = ['machine learning', 'deep learning', 'neural network', 'algorithm', 'optimization'];
    const queryLower = query.toLowerCase();
    
    let enhancedQuery = query;
    
    // Add category filters for better results
    if (academicTerms.some(term => queryLower.includes(term))) {
      enhancedQuery = `(${query}) AND (cat:cs.LG OR cat:cs.AI OR cat:stat.ML)`;
    } else if (queryLower.includes('physics') || queryLower.includes('quantum')) {
      enhancedQuery = `(${query}) AND (cat:quant-ph OR cat:physics)`;
    } else if (queryLower.includes('math') || queryLower.includes('statistics')) {
      enhancedQuery = `(${query}) AND (cat:math OR cat:stat)`;
    }
    
    return enhancedQuery;
  }

  private isRelevantPaper(title: string, summary: string, query: string): boolean {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const paperText = `${title} ${summary}`.toLowerCase();
    
    // Check if at least 60% of query terms appear in the paper
    const matchingTerms = queryTerms.filter(term => paperText.includes(term));
    const relevanceScore = matchingTerms.length / queryTerms.length;
    
    return relevanceScore >= 0.4 && summary.length > 100; // Ensure substantial content
  }

  /**
   * Calculate relevance score for academic content
   */
  static calculateRelevanceScore(content: string): number {
    let score = 0.5;
    
    // Boost for academic keywords
    const academicKeywords = ['research', 'study', 'analysis', 'method', 'result', 'conclusion', 'experiment'];
    const keywordMatches = academicKeywords.filter(keyword => 
      content.toLowerCase().includes(keyword)
    ).length;
    score += keywordMatches * 0.05;
    
    // Boost for substantial content
    if (content.length > 1000) score += 0.1;
    if (content.length > 3000) score += 0.1;
    
    // Boost for structured content (sections, references)
    if (content.includes('Abstract') || content.includes('Introduction')) score += 0.1;
    if (content.includes('References') || content.includes('Bibliography')) score += 0.05;
    
    return Math.min(score, 1.0);
  }
} 