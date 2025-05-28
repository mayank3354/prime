import axios from 'axios';
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PdfReader } from 'pdfreader';
import type { ItemHandler } from 'pdfreader';
import { ArxivPaper } from './academic-types';
import { ResearchStatus, StatusCallback } from '@/types/research';

/**
 * PDF processing and document handling utilities for academic papers
 */
export class PDFProcessor {
  private textSplitter: RecursiveCharacterTextSplitter;
  private statusCallback?: StatusCallback;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", ". ", " ", ""]
    });
  }

  private updateStatus(status: ResearchStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  async downloadAndProcessPaper(paper: ArxivPaper): Promise<Document[]> {
    if (!paper.pdfLink) {
      // Create document from summary if PDF not available
      return [new Document({
        pageContent: `${paper.title}\n\n${paper.summary}`,
        metadata: {
          title: paper.title,
          authors: paper.authors.join(', '),
          published: paper.published,
          source: paper.link,
          type: 'academic_paper'
        }
      })];
    }

    try {
      this.updateStatus({
        stage: 'downloading',
        message: `Processing paper: ${paper.title.substring(0, 50)}...`,
        progress: { current: 2, total: 5 }
      });

      const response = await axios.get(paper.pdfLink, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024 // 10MB limit
      });
      
      const buffer = Buffer.from(response.data);
      
      const text = await new Promise<string>((resolve, reject) => {
        let content = '';
        let pageCount = 0;
        const maxPages = 20; // Limit processing to first 20 pages
        
        new PdfReader().parseBuffer(buffer, ((err, item) => {
          if (err) {
            reject(err);
          } else if (!item) {
            resolve(content);
          } else if (item.text && pageCount < maxPages) {
            content += item.text + ' ';
          } else if (item.page) {
            pageCount = item.page;
          }
        }) as ItemHandler);
      });

      if (text.length < 100) {
        // Fallback to summary if PDF extraction failed
        return [new Document({
          pageContent: `${paper.title}\n\n${paper.summary}`,
          metadata: {
            title: paper.title,
            authors: paper.authors.join(', '),
            published: paper.published,
            source: paper.link,
            type: 'academic_paper'
          }
        })];
      }

      const cleanedText = this.sanitizeText(text);
      return await this.textSplitter.createDocuments([cleanedText], [{
        title: paper.title,
        authors: paper.authors.join(', '),
        published: paper.published,
        source: paper.link,
        type: 'academic_paper'
      }]);

    } catch (error) {
      console.error(`Paper processing error for ${paper.title}:`, error);
      // Return summary-based document as fallback
      return [new Document({
        pageContent: `${paper.title}\n\n${paper.summary}`,
        metadata: {
          title: paper.title,
          authors: paper.authors.join(', '),
          source: paper.link,
          published: paper.published,
          type: 'academic_paper'
        }
      })];
    }
  }

  async processAndEmbedPapers(
    papers: ArxivPaper[], 
    vectorStoreAddFunction: (docs: Document[]) => Promise<void>
  ): Promise<Document[]> {
    this.updateStatus({
      stage: 'processing',
      message: 'Processing and embedding research papers...',
      progress: { current: 3, total: 5 }
    });

    const documents: Document[] = [];
    
    for (const [index, paper] of papers.entries()) {
      try {
        this.updateStatus({
          stage: 'processing',
          message: `Processing paper ${index + 1}/${papers.length}: ${paper.title.substring(0, 40)}...`,
          progress: { current: 3, total: 5 }
        });

        const paperDocs = await this.downloadAndProcessPaper(paper);
        
        // Enhanced document preparation
        const enhancedDocs = paperDocs.map(doc => {
          const cleanContent = this.sanitizeText(doc.pageContent);
          const enhancedMetadata = {
            ...doc.metadata,
            title: this.sanitizeText(paper.title),
            authors: paper.authors.join(', '),
            source: paper.link,
            published: paper.published,
            relevanceScore: this.calculateRelevanceScore(cleanContent),
            contentLength: cleanContent.length
          };

          return new Document({
            pageContent: cleanContent,
            metadata: enhancedMetadata
          });
        });

        documents.push(...enhancedDocs);

        // Batch embedding with error handling and rate limiting
        const batchSize = 2;
        for (let i = 0; i < enhancedDocs.length; i += batchSize) {
          const batch = enhancedDocs.slice(i, i + batchSize);
          try {
            // Add delay between batches to prevent rate limiting
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            await vectorStoreAddFunction(batch);
            console.log(`Embedded batch ${Math.floor(i / batchSize) + 1} for paper: ${paper.title.substring(0, 30)}`);
          } catch (embedError) {
            console.error(`Batch embedding error for paper ${paper.title}:`, embedError);
            // Continue with next batch instead of failing completely
            continue;
          }
        }

      } catch (error) {
        console.error(`Error processing paper ${paper.title}:`, error);
        // Add a fallback document with just the summary
        const fallbackDoc = new Document({
          pageContent: `${paper.title}\n\n${paper.summary}`,
          metadata: {
            title: paper.title,
            authors: paper.authors.join(', '),
            source: paper.link,
            published: paper.published,
            type: 'fallback'
          }
        });
        documents.push(fallbackDoc);
        continue;
      }
    }

    console.log(`Successfully processed ${documents.length} documents from ${papers.length} papers`);
    return documents;
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/[^\x20-\x7E\n]/g, '') // Keep only printable ASCII and newlines
      .replace(/\\./g, '') // Remove escape sequences
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/(.)\1{4,}/g, '$1$1$1') // Remove excessive repetition
      .trim()
      .substring(0, 5000); // Reasonable length limit
  }

  private calculateRelevanceScore(content: string): number {
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

  /**
   * Extract text content from PDF buffer
   */
  static async extractTextFromPDF(buffer: Buffer, maxPages: number = 20): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let content = '';
      let pageCount = 0;
      
      new PdfReader().parseBuffer(buffer, ((err, item) => {
        if (err) {
          reject(err);
        } else if (!item) {
          resolve(content);
        } else if (item.text && pageCount < maxPages) {
          content += item.text + ' ';
        } else if (item.page) {
          pageCount = item.page;
        }
      }) as ItemHandler);
    });
  }

  /**
   * Create fallback document from paper metadata
   */
  static createFallbackDocument(paper: ArxivPaper): Document {
    return new Document({
      pageContent: `${paper.title}\n\n${paper.summary}`,
      metadata: {
        title: paper.title,
        authors: paper.authors.join(', '),
        published: paper.published,
        source: paper.link,
        type: 'academic_paper_summary'
      }
    });
  }
} 