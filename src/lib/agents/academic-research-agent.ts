import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { createClient } from "@supabase/supabase-js";
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PdfReader } from 'pdfreader';
import type { ItemHandler } from 'pdfreader';
import { ResearchStatus, StatusCallback } from "@/types/research";
// import { StructuredOutputParser } from "langchain/output_parsers";
// import { z } from "zod";

// function sanitizeJsonString(str: string): string {
//   return str
//     // Remove markdown formatting
//     .replace(/\*\*/g, '')
//     .replace(/\*/g, '')
//     // Replace line breaks with spaces
//     .replace(/\n/g, ' ')
//     // Replace multiple spaces with single space
//     .replace(/\s+/g, ' ')
//     // Fix any broken quotes
//     .replace(/[""]/g, '"')
//     // Escape any remaining special characters
//     .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
//     .trim();
// }
interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  link: string;
  pdfLink?: string;
}

// Add new interface for code examples
interface CodeExample {
  title: string;
  language: 'python' | 'javascript' | 'typescript' | string;
  code: string;
  description: string;
  source: string;
}

// Update RAG response interface
interface RAGResponse {
  analysis: string;
  statistics: Array<{
    value: string;
    metric: string;
    context: string;
    source: string;
  }>;
  questions: string[];
  codeExamples: CodeExample[];
  methodology: {
    approach: string;
    implementation: string;
    evaluation: string;
  };
}

interface CodeRepository {
  title: string;
  description: string;
  url: string;
  stars?: number;
  language?: string;
}

interface GitHubRepo {
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string;
}

interface Finding {
  title: string;
  content: string;
  source: string;
  relevance: string;
  credibility: number;
  type: string;
  category: string;
}

interface KeyInsight {
  point: string;
  explanation: string;
  supportingEvidence: string[];
}

interface ResearchMetadata {
  sourcesCount: number;
  confidence: number;
  researchDepth: string;
  lastUpdated: string;
  error?: boolean;
  attempts?: number;
}

// // Define a schema for your output
// const outputSchema = z.object({
//   analysis: z.string().describe("A detailed analysis of the papers"),
//   statistics: z.array(
//     z.object({
//       value: z.string(),
//       metric: z.string(),
//       context: z.string()
//     })
//   ),
//   questions: z.array(z.string()),
//   codeExamples: z.array(
//     z.object({
//       title: z.string(),
//       language: z.string(),
//       code: z.string(),
//       description: z.string(),
//       source: z.string().default("Generated example")
//     })
//   ),
//   methodology: z.object({
//     approach: z.string(),
//     implementation: z.string(),
//     evaluation: z.string()
//   })
// });

export class AcademicResearchAgent {
  private model: ChatGoogleGenerativeAI;
  private vectorStore: SupabaseVectorStore;
  private textSplitter: RecursiveCharacterTextSplitter;
  private statusCallback?: StatusCallback;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback;
    this.model = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.0-flash",
      apiKey: process.env.GOOGLE_API_KEY!,
      temperature: 0.3,
      maxOutputTokens: 8192,
    });

    // Initialize embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY!,
      modelName: "text-embedding-004",
    });

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Initialize vector store with correct configuration
    this.vectorStore = new SupabaseVectorStore(embeddings, {
      client,
      tableName: 'documents',
      queryName: 'match_documents',
      filter: undefined,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,  // Increased chunk size for better context
      chunkOverlap: 100, // Increased overlap for better continuity
      separators: ["\n\n", "\n", ". ", " ", ""]
    });
  }

  private updateStatus(status: ResearchStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  private async searchArxiv(query: string): Promise<ArxivPaper[]> {
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

  private async downloadAndProcessPaper(paper: ArxivPaper): Promise<Document[]> {
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

  private async searchCodeRepositories(query: string): Promise<CodeRepository[]> {
    try {
      this.updateStatus({
        stage: 'searching',
        message: 'Searching GitHub repositories...',
        progress: { current: 2, total: 5 }
      });

      // Enhanced GitHub search with better query construction
      const searchQuery = this.enhanceGitHubQuery(query);
      
      const response = await axios.get(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=8`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Academic-Research-Agent'
          }
        }
      );

      const repositories = response.data.items
        .filter((repo: GitHubRepo) => this.isRelevantRepository(repo, query))
        .map((repo: GitHubRepo) => ({
          title: repo.full_name,
          description: repo.description || 'No description available',
          url: repo.html_url,
          stars: repo.stargazers_count,
          language: repo.language || 'Unknown'
        }));

      console.log(`Found ${repositories.length} relevant repositories`);
      return repositories;
    } catch (error) {
      console.error('GitHub search error:', error);
      return [];
    }
  }

  private enhanceGitHubQuery(query: string): string {
    const queryLower = query.toLowerCase();
    let enhancedQuery = query;
    
    // Add language filters for programming queries
    if (queryLower.includes('python')) {
      enhancedQuery += ' language:python';
    } else if (queryLower.includes('javascript') || queryLower.includes('js')) {
      enhancedQuery += ' language:javascript';
    } else if (queryLower.includes('typescript') || queryLower.includes('ts')) {
      enhancedQuery += ' language:typescript';
    }
    
    // Add quality filters
    enhancedQuery += ' stars:>10 pushed:>2022-01-01';
    
    return enhancedQuery;
  }

  private isRelevantRepository(repo: GitHubRepo, query: string): boolean {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const repoText = `${repo.full_name} ${repo.description || ''}`.toLowerCase();
    
    // Check relevance and quality
    const hasRelevantTerms = queryTerms.some(term => repoText.includes(term));
    const hasMinimumStars = repo.stargazers_count >= 5;
    const hasDescription = repo.description && repo.description.length > 10;
    if (hasRelevantTerms && hasMinimumStars && hasDescription) {  
      return true;
    }
    return false;
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

  private async processAndEmbedPapers(papers: ArxivPaper[]): Promise<Document[]> {
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
            
            await this.vectorStore.addDocuments(batch);
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

  private calculateRelevanceScore(content: string): number {
    // Simple relevance scoring based on content quality indicators
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

  private async performRAGSearch(query: string): Promise<RAGResponse> {
    try {
      this.updateStatus({
        stage: 'analyzing',
        message: 'Performing RAG analysis on research data...',
        progress: { current: 4, total: 5 }
      });

      const relevantDocs = await this.vectorStore.similaritySearch(query, 10);
      
      if (relevantDocs.length === 0) {
        return this.getFallbackResponse("No relevant documents found in vector store.");
      }

      // Enhanced prompt for better structured output
      const prompt = this.createEnhancedPrompt(query, relevantDocs);
      
      const response = await this.model.invoke(prompt);
      
      const responseText = response.content.toString();
      
      // Use enhanced extraction method
      return this.extractStructuredData(responseText, query);
    } catch (error) {
      console.error("RAG search error:", error);
      return this.getFallbackResponse("Error during RAG analysis process.");
    }
  }

  private createEnhancedPrompt(query: string, docs: Document[]): string {
    const contextSections = docs.map((doc, i) => {
      const metadata = doc.metadata;
      return `[Document ${i+1}]
Title: ${metadata.title || 'Unknown'}
Authors: ${metadata.authors || 'Unknown'}
Source: ${metadata.source || 'Unknown'}
Content: ${doc.pageContent.substring(0, 800)}...
---`;
    }).join('\n\n');

    return `You are an expert academic research analyst. Analyze the following research question: "${query}"

Based on these academic papers and sources:

${contextSections}

Provide a comprehensive analysis in the following structured format:

ANALYSIS_START
[Write a detailed 3-4 paragraph analysis covering:
1. Current state of research in this area
2. Key methodologies and approaches
3. Main findings and conclusions
4. Gaps and future directions]
ANALYSIS_END

STATISTICS_START
[Extract 3-5 specific numerical findings, metrics, or data points from the papers]
Format each as: STAT: [metric] | VALUE: [number with units] | CONTEXT: [significance] | SOURCE: [paper/author]
STATISTICS_END

QUESTIONS_START
[Generate 5 insightful follow-up research questions that would advance this field]
Format each as: Q: [question]
QUESTIONS_END

CODE_EXAMPLES_START
[If applicable, provide 2-3 code examples or algorithmic approaches mentioned in the papers]
Format each as: 
TITLE: [example title]
LANGUAGE: [programming language]
CODE: [code snippet]
DESCRIPTION: [what it does]
SOURCE: [which paper/source]
CODE_EXAMPLES_END

METHODOLOGY_START
APPROACH: [Overall research approach used in the field]
IMPLEMENTATION: [Common implementation strategies]
EVALUATION: [How results are typically evaluated]
METHODOLOGY_END

Focus on factual information from the provided sources. Be specific and cite relevant papers.`;
  }

  private extractStructuredData(text: string, query: string): RAGResponse {
    console.log("Extracting structured data from response");
    
    try {
      // Extract analysis
      const analysisMatch = text.match(/ANALYSIS_START\s*([\s\S]*?)\s*ANALYSIS_END/);
      const analysis = analysisMatch?.[1]?.trim() || 
        `Analysis of ${query} based on available research papers. The research covers various aspects of this topic with multiple methodological approaches.`;

      // Extract statistics
      const statistics = this.extractStatistics(text);

      // Extract questions
      const questions = this.extractQuestions(text);

      // Extract code examples
      const codeExamples = this.extractCodeExamples(text);

      // Extract methodology
      const methodology = this.extractMethodology(text);

      return {
        analysis,
        statistics,
        questions,
        codeExamples,
        methodology
      };
    } catch (error) {
      console.error("Error extracting structured data:", error);
      return this.getFallbackResponse("Error parsing research analysis.");
    }
  }

  private extractStatistics(text: string): Array<{value: string, metric: string, context: string, source: string}> {
    const statistics: Array<{value: string, metric: string, context: string, source: string}> = [];
    
    const statsSection = text.match(/STATISTICS_START\s*([\s\S]*?)\s*STATISTICS_END/);
    if (statsSection?.[1]) {
      const statLines = statsSection[1].split('\n').filter(line => line.includes('STAT:'));
      
      for (const line of statLines) {
        const statMatch = line.match(/STAT:\s*([^|]+)\s*\|\s*VALUE:\s*([^|]+)\s*\|\s*CONTEXT:\s*([^|]+)\s*\|\s*SOURCE:\s*(.+)/);
        if (statMatch) {
          statistics.push({
            metric: statMatch[1].trim(),
            value: statMatch[2].trim(),
            context: statMatch[3].trim(),
            source: statMatch[4].trim()
          });
        }
      }
    }
    
    return statistics;
  }

  private extractQuestions(text: string): string[] {
    const questions: string[] = [];
    
    const questionsSection = text.match(/QUESTIONS_START\s*([\s\S]*?)\s*QUESTIONS_END/);
    if (questionsSection?.[1]) {
      const questionLines = questionsSection[1].split('\n').filter(line => line.includes('Q:'));
      
      for (const line of questionLines) {
        const questionMatch = line.match(/Q:\s*(.+)/);
        if (questionMatch) {
          questions.push(questionMatch[1].trim());
        }
      }
    }
    
    return questions.length > 0 ? questions : [
      "What are the current limitations in this research area?",
      "How can the methodology be improved?",
      "What are the practical applications of these findings?"
    ];
  }

  private extractCodeExamples(text: string): CodeExample[] {
    const codeExamples: CodeExample[] = [];
    
    const codeSection = text.match(/CODE_EXAMPLES_START\s*([\s\S]*?)\s*CODE_EXAMPLES_END/);
    if (codeSection?.[1]) {
      const codeBlocks = codeSection[1].split('TITLE:').slice(1);
      
      for (const block of codeBlocks) {
        const titleMatch = block.match(/^([^\n]+)/);
        const languageMatch = block.match(/LANGUAGE:\s*([^\n]+)/);
        const codeMatch = block.match(/CODE:\s*([\s\S]*?)(?=DESCRIPTION:|$)/);
        const descriptionMatch = block.match(/DESCRIPTION:\s*([^\n]+)/);
        const sourceMatch = block.match(/SOURCE:\s*([^\n]+)/);
        
        if (titleMatch && codeMatch) {
          codeExamples.push({
            title: titleMatch[1].trim(),
            language: languageMatch?.[1]?.trim() || 'text',
            code: codeMatch[1].trim(),
            description: descriptionMatch?.[1]?.trim() || 'Code example from research',
            source: sourceMatch?.[1]?.trim() || 'Academic paper'
          });
        }
      }
    }
    
    return codeExamples;
  }

  private extractMethodology(text: string): {approach: string, implementation: string, evaluation: string} {
    const methodologySection = text.match(/METHODOLOGY_START\s*([\s\S]*?)\s*METHODOLOGY_END/);
    
    let approach = "Not specified";
    let implementation = "Not specified";
    let evaluation = "Not specified";
    
    if (methodologySection?.[1]) {
      const approachMatch = methodologySection[1].match(/APPROACH:\s*([^\n]+)/);
      const implementationMatch = methodologySection[1].match(/IMPLEMENTATION:\s*([^\n]+)/);
      const evaluationMatch = methodologySection[1].match(/EVALUATION:\s*([^\n]+)/);
      
      if (approachMatch) approach = approachMatch[1].trim();
      if (implementationMatch) implementation = implementationMatch[1].trim();
      if (evaluationMatch) evaluation = evaluationMatch[1].trim();
    }
    
    return { approach, implementation, evaluation };
  }

  private getFallbackResponse(errorMessage: string): RAGResponse {
    console.log("Generating fallback response due to error:", errorMessage);
    
    return {
      analysis: `Academic research analysis encountered technical difficulties. The system attempted to process research papers and extract relevant information but faced processing challenges. This may be due to complex document structures or API limitations.`,
      statistics: [
        {
          value: "N/A",
          metric: "Research Completion",
          context: "The research process encountered technical issues",
          source: "System"
        }
      ],
      questions: [
        "Could you try rephrasing your research question?",
        "Would you like to focus on a more specific aspect of this topic?",
        "Can you provide additional context or keywords?"
      ],
      codeExamples: [],
      methodology: {
        approach: "The research process was initiated but encountered technical difficulties",
        implementation: "Error handling procedures were activated",
        evaluation: "Please try again with a refined query"
      }
    };
  }

  // Helper methods for result formatting
  private determineRelevance(summary: string, query: string): string {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const summaryLower = summary.toLowerCase();
    const matches = queryTerms.filter(term => summaryLower.includes(term)).length;
    const relevanceRatio = matches / queryTerms.length;
    
    if (relevanceRatio >= 0.7) return "High";
    if (relevanceRatio >= 0.4) return "Medium";
    return "Low";
  }

  private generateContextualQuestions(baseQuestions: string[], query: string): string[] {
    const contextualQuestions = baseQuestions.map(q => {
      if (q.includes("this topic")) {
        return q.replace("this topic", query);
      }
      return q;
    });
    
    // Add query-specific questions
    contextualQuestions.push(`How does ${query} compare to alternative approaches?`);
    contextualQuestions.push(`What are the latest developments in ${query}?`);
    
    return contextualQuestions.slice(0, 5);
  }

  private generateCodeTitle(code: string, query: string): string {
    if (code.includes('def ') || code.includes('function')) {
      return `Implementation Example for ${query}`;
    }
    if (code.includes('class ')) {
      return `Class Structure for ${query}`;
    }
    return `Code Example: ${query}`;
  }

  private generateCodeDescription(code: string, query: string): string {
    const lines = code.split('\n').length;
    return `A ${lines}-line code example demonstrating ${query} implementation with practical applications.`;
  }

  private generateStepTitle(paragraph: string, query: string): string {
    const firstWords = paragraph.split(' ').slice(0, 5).join(' ');
    return `${firstWords} in ${query}`;
  }

  private formatResearchResults(query: string, ragResults: RAGResponse, papers: ArxivPaper[], codeResults: CodeRepository[]): {
    summary: string;
    findings: Finding[];
    keyInsights: KeyInsight[];
    statistics: Array<{value: string, metric: string, context: string, source: string}>;
    suggestedQuestions: string[];
    codeExamples: CodeExample[];
    metadata: ResearchMetadata;
  } {
    // Extract key steps from the analysis
    const keySteps = this.extractKeySteps(ragResults.analysis, query);
    
    return {
      summary: this.formatSummaryForQuery(ragResults.analysis, query),
      findings: papers.map(paper => ({
        title: paper.title,
        content: paper.summary,
        source: paper.link,
        relevance: this.determineRelevance(paper.summary, query),
        credibility: 0.9,
        type: "academic",
        category: "Research Paper"
      })),
      keyInsights: [
        ...keySteps.map(step => ({
          point: step.title,
          explanation: step.content,
          supportingEvidence: step.evidence || []
        })),
        ...(ragResults.methodology ? [{
          point: "Research Methodology",
          explanation: ragResults.methodology.approach,
          supportingEvidence: [
            ragResults.methodology.implementation,
            ragResults.methodology.evaluation
          ]
        }] : [])
      ],
      statistics: ragResults.statistics || [],
      suggestedQuestions: this.generateContextualQuestions(ragResults.questions || [], query),
      codeExamples: [
        ...(ragResults.codeExamples || []).map(example => ({
          title: example.title || this.generateCodeTitle(example.code, query),
          language: example.language || 'text',
          code: example.code || '',
          description: example.description || this.generateCodeDescription(example.code, query),
          source: example.source || 'Research data'
        })),
        ...(codeResults.map(repo => ({
          title: repo.title || 'Repository',
          language: repo.language || 'text',
          code: `// Repository: ${repo.title}\n// Description: ${repo.description}\n// Stars: ${repo.stars}\n// Access full code at: ${repo.url}`,
          description: repo.description || 'No description available',
          source: repo.url
        })))
      ],
      metadata: {
        sourcesCount: papers.length + codeResults.length,
        confidence: this.calculateConfidenceScore(papers, ragResults),
        researchDepth: "Academic",
        lastUpdated: new Date().toISOString()
      }
    };
  }

  private extractKeySteps(analysis: string, query: string): Array<{title: string, content: string, evidence?: string[]}> {
    const paragraphs = analysis.split('\n\n').filter(p => p.trim().length > 50);
    
    if (paragraphs.length <= 1) {
      return [{
        title: `Research Overview: ${query}`,
        content: analysis
      }];
    }
    
    return paragraphs.map((paragraph, index) => {
      const firstSentence = paragraph.split('.')[0];
      const title = firstSentence.length < 60 ? 
        firstSentence : 
        `Research Finding ${index + 1}: ${this.generateStepTitle(paragraph, query)}`;
      
      return {
        title: title,
        content: paragraph
      };
    });
  }

  private formatSummaryForQuery(analysis: string, query: string): string {
    if (!analysis.toLowerCase().includes(query.toLowerCase().substring(0, 15))) {
      return `Academic research on ${query}:\n\n${analysis}`;
    }
    return analysis;
  }

  private calculateConfidenceScore(papers: ArxivPaper[], ragResults: RAGResponse): number {
    let confidence = 0.5;
    
    // Boost for number of papers
    confidence += Math.min(papers.length * 0.1, 0.3);
    
    // Boost for quality indicators
    if (ragResults.statistics.length > 0) confidence += 0.1;
    if (ragResults.codeExamples.length > 0) confidence += 0.1;
    if (ragResults.analysis.length > 500) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  async research(query: string) {
    if (!query || query.trim().length < 3) {
      return {
        summary: "Please provide a more specific research query",
        findings: [],
        keyInsights: [],
        statistics: [],
        codeExamples: [],
        suggestedQuestions: ["What specific aspect would you like to research?"],
        metadata: { sourcesCount: 0, confidence: 0, researchDepth: "None", lastUpdated: new Date().toISOString() }
      };
    }
    
    const maxAttempts = 2;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`Academic research attempt ${attempts} for query: ${query}`);
        
        this.updateStatus({
          stage: 'searching',
          message: attempts > 1 ? `Retrying research (attempt ${attempts})...` : 'Starting academic research...',
          progress: { current: 1, total: 5 }
        });
        
        // Search papers and code repositories in parallel
        const [papers, codeResults] = await Promise.allSettled([
          this.searchArxiv(query),
          this.searchCodeRepositories(query)
        ]);

        const validPapers = papers.status === 'fulfilled' ? papers.value : [];
        const validCodeResults = codeResults.status === 'fulfilled' ? codeResults.value : [];

        if (validPapers.length === 0 && validCodeResults.length === 0) {
          throw new Error("No relevant sources found");
        }

        // Process papers if found
        if (validPapers.length > 0) {
          await this.processAndEmbedPapers(validPapers);
        }

        this.updateStatus({
          stage: 'analyzing',
          message: 'Performing comprehensive analysis...',
          progress: { current: 4, total: 5 }
        });

        // Perform RAG-based analysis
        const ragResults = await this.performRAGSearch(query);

        this.updateStatus({
          stage: 'complete',
          message: 'Academic research completed successfully!',
          progress: { current: 5, total: 5 }
        });

        // Use enhanced formatting method
        return this.formatResearchResults(query, ragResults, validPapers, validCodeResults);

      } catch (error) {
        console.error(`Academic research error (attempt ${attempts}):`, error);
        
        if (attempts >= maxAttempts) {
          this.updateStatus({
            stage: 'complete',
            message: 'Research completed with limitations',
            progress: { current: 5, total: 5 }
          });

          return {
            summary: `After ${maxAttempts} attempts, the academic research for "${query}" encountered technical challenges. This may be due to API limitations, network issues, or the complexity of the query. Please try rephrasing your query or focusing on a more specific aspect.`,
            findings: [],
            keyInsights: [{
              point: "Research Limitation",
              explanation: `The system encountered technical difficulties while processing your query after ${maxAttempts} attempts.`,
              supportingEvidence: ["API rate limits", "Network connectivity issues", "Complex query processing"]
            }],
            statistics: [],
            codeExamples: [],
            suggestedQuestions: [
              "Could you try a more specific research question?",
              "Would you like to focus on a particular aspect of this topic?",
              "Can you provide additional keywords or context?"
            ],
            metadata: { 
              error: true, 
              attempts: maxAttempts,
              sourcesCount: 0,
              confidence: 0.2,
              researchDepth: "Limited",
              lastUpdated: new Date().toISOString()
            }
          };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
} 