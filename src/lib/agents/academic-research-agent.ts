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
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";

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

// Define a schema for your output
const outputSchema = z.object({
  analysis: z.string().describe("A detailed analysis of the papers"),
  statistics: z.array(
    z.object({
      value: z.string(),
      metric: z.string(),
      context: z.string()
    })
  ),
  questions: z.array(z.string()),
  codeExamples: z.array(
    z.object({
      title: z.string(),
      language: z.string(),
      code: z.string(),
      description: z.string(),
      source: z.string().default("Generated example")
    })
  ),
  methodology: z.object({
    approach: z.string(),
    implementation: z.string(),
    evaluation: z.string()
  })
});

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
      chunkSize: 500,  // Reduced chunk size
      chunkOverlap: 50,
    });
  }

  private updateStatus(status: ResearchStatus) {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  private async searchArxiv(query: string): Promise<ArxivPaper[]> {
    try {
      const response = await axios.get(
        `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5&sortBy=relevance`
      );

      const $ = cheerio.load(response.data, { xmlMode: true });
      const papers: ArxivPaper[] = [];

      $('entry').each((_, entry) => {
        const $entry = $(entry);
        papers.push({
          id: $entry.find('id').text(),
          title: $entry.find('title').text().trim(),
          authors: $entry.find('author name').map((_, name) => $(name).text()).get(),
          summary: $entry.find('summary').text().trim(),
          published: $entry.find('published').text(),
          link: $entry.find('link[title="pdf"]').attr('href') || '',
          pdfLink: $entry.find('link[title="pdf"]').attr('href')
        });
      });

      return papers;
    } catch (error) {
      console.error('arXiv search error:', error);
      return [];
    }
  }

  private async downloadAndProcessPaper(paper: ArxivPaper): Promise<Document[]> {
    if (!paper.pdfLink) return [];

    try {
      const response = await axios.get(paper.pdfLink, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      
      const text = await new Promise<string>((resolve, reject) => {
        let content = '';
        new PdfReader().parseBuffer(buffer, ((err, item) => {
          if (err) reject(err);
          else if (!item) resolve(content);
          else if (item.text) content += item.text + ' ';
        }) as ItemHandler);
      });

      return await this.textSplitter.createDocuments([text], [{
        title: paper.title,
        authors: paper.authors.join(', '),
        published: paper.published,
        source: paper.link
      }]);

    } catch (error) {
      console.error('Paper processing error:', error);
      return [];
    }
  }

  private async searchCodeRepositories(query: string): Promise<CodeRepository[]> {
    try {
      // Search GitHub repositories
      const response = await axios.get(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars`
      );

      return response.data.items.map((repo: GitHubRepo) => ({
        title: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        language: repo.language
      }));
    } catch (error) {
      console.error('GitHub search error:', error);
      return [];
    }
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/[^\x20-\x7E\n]/g, '') // Keep only printable ASCII and newlines
      .replace(/\\./g, '') // Remove escape sequences
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 1000); // Limit length
  }

  private sanitizeJsonString(str: string): string {
    return str
      // Remove markdown formatting
      .replace(/```json/g, '')
      .replace(/```/g, '')
      // Fix escaped quotes
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      // Fix unescaped quotes within strings
      .replace(/"([^"]*)":/g, (match) => match.replace(/"/g, '\\"'))
      // Remove control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .trim();
  }

  private async processAndEmbedPapers(papers: ArxivPaper[]): Promise<Document[]> {
    this.updateStatus({
      stage: 'processing',
      message: 'Processing and embedding research papers...'
    });

    const documents: Document[] = [];
    
    for (const paper of papers) {
      try {
        // Download and process PDF content
        const paperDocs = await this.downloadAndProcessPaper(paper);
        
        // Clean and prepare documents
        const cleanedDocs = paperDocs.map(doc => {
          const cleanContent = this.sanitizeText(doc.pageContent);
          const cleanMetadata = {
            title: this.sanitizeText(paper.title),
            authors: paper.authors.join(', '),
            source: paper.link,
            published: paper.published
          };

          return new Document({
            pageContent: cleanContent,
            metadata: cleanMetadata
          });
        });

        documents.push(...cleanedDocs);

        // Process in smaller batches with better error handling
        const batchSize = 3;
        for (let i = 0; i < cleanedDocs.length; i += batchSize) {
          const batch = cleanedDocs.slice(i, i + batchSize);
          try {
            // Add delay between batches to prevent rate limiting
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            await this.vectorStore.addDocuments(
              batch.map(doc => ({
                ...doc,
                pageContent: doc.pageContent.substring(0, 1000) // Limit content length
              }))
            );
          } catch (embedError) {
            console.error(`Batch ${i / batchSize + 1} embedding error:`, embedError);
            continue;
          }
        }

      } catch (error) {
        console.error(`Error processing paper ${paper.title}:`, error);
        continue;
      }
    }

    return documents;
  }

  private async performRAGSearch(query: string): Promise<RAGResponse> {
    try {
      const relevantDocs = await this.vectorStore.similaritySearch(query, 5);
      
      // Create a parser
      const parser = StructuredOutputParser.fromZodSchema(outputSchema);
      const formatInstructions = parser.getFormatInstructions();
      
      // Create a prompt with format instructions
      const prompt = `
        Based on the following academic papers and the query "${query}", provide a comprehensive analysis.
        
        Papers:
        ${relevantDocs.map(doc => `- ${doc.pageContent}`).join('\n')}
        
        ${formatInstructions}
      `;
      
      // Get response from model
      const response = await this.model.invoke(prompt);
      const responseText = response.content.toString();
      
      // Parse the response
      return await parser.parse(responseText);
    } catch (error) {
      console.error("RAG search error:", error);
      // Return fallback response
      return {
        analysis: "Error processing research results.",
        statistics: [],
        questions: [],
        codeExamples: [],
        methodology: {
          approach: "Not available",
          implementation: "Not available",
          evaluation: "Not available"
        }
      };
    }
  }

  private formatCodeExample(code: string, ): string {
    // Clean up code formatting
    return code
      .trim()
      .replace(/^\s+/gm, '')  // Remove leading whitespace
      .replace(/\n{3,}/g, '\n\n'); // Normalize line breaks
  }

  private getFallbackResponse(text: string): RAGResponse {
    return {
      analysis: text,
      statistics: [],
      questions: [],
      codeExamples: [],
      methodology: {
        approach: "Not available",
        implementation: "Not available",
        evaluation: "Not available"
      }
    };
  }

  async research(query: string) {
    try {
      this.updateStatus({
        stage: 'searching',
        message: 'Searching academic papers and code repositories...'
      });
      
      // Search papers and code repositories
      const [papers, codeResults] = await Promise.all([
        this.searchArxiv(query),
        this.searchCodeRepositories(query)
      ]);

      // Process and embed papers for RAG
      //const documents = await this.processAndEmbedPapers(papers);

      this.updateStatus({
        stage: 'analyzing',
        message: 'Performing RAG analysis...'
      });

      // Perform RAG-based analysis
      const ragResults = await this.performRAGSearch(query);

      // Combine RAG results with code examples
      return {
        summary: ragResults.analysis,
        findings: papers.map(paper => ({
          title: paper.title,
          content: paper.summary,
          source: paper.link,
          relevance: "High",
          credibility: 0.9,
          type: "academic",
          category: "Research Paper"
        })),
        keyInsights: ragResults.methodology ? [{
          point: "Research Methodology",
          explanation: ragResults.methodology.approach,
          supportingEvidence: [
            ragResults.methodology.implementation,
            ragResults.methodology.evaluation
          ]
        }] : [],
        statistics: ragResults.statistics || [],
        suggestedQuestions: ragResults.questions || [],
        codeExamples: [
          ...(ragResults.codeExamples || []),
          ...(codeResults.map(repo => ({
            title: repo.title,
            description: repo.description,
            language: repo.language,
            code: "// Code from repository\n// Access full code at: " + repo.url,
            source: repo.url
          })))
        ],
        metadata: {
          sourcesCount: papers.length + codeResults.length,
          confidence: 0.9,
          researchDepth: "Academic",
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Academic research error:', error);
      throw error;
    }
  }
} 