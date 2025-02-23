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
function sanitizeJsonString(str: string): string {
  return str
    // Remove markdown formatting
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    // Replace line breaks with spaces
    .replace(/\n/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Fix any broken quotes
    .replace(/[""]/g, '"')
    // Escape any remaining special characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}
interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  link: string;
  pdfLink?: string;
}

export class AcademicResearchAgent {
  private model: ChatGoogleGenerativeAI;
  private vectorStore: SupabaseVectorStore;
  private textSplitter: RecursiveCharacterTextSplitter;
  private statusCallback?: StatusCallback;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback;
    this.model = new ChatGoogleGenerativeAI({
      modelName: "gemini-pro",
      apiKey: process.env.GOOGLE_API_KEY!,
      temperature: 0.3,
    });

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Initialize vector store with proper table name and schema
    this.vectorStore = new SupabaseVectorStore(
      new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY!,
        modelName: "embedding-001"
      }),
      {
        client,
        tableName: 'research_documents', // Changed table name
        queryName: 'match_documents'     // Added query name
      }
    );

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
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

  async research(query: string) {
    try {
      this.updateStatus({
        stage: 'searching',
        message: 'Searching academic papers...'
      });
      const papers = await this.searchArxiv(query);

      this.updateStatus({
        stage: 'analyzing',
        message: 'Analyzing research papers...'
      });

      // Enhanced prompt to generate statistics and questions
      const researchPrompt = `Based on these academic papers, provide a comprehensive analysis of "${query}".
      Extract key statistics, metrics, and numerical data from the papers.
      Also generate relevant follow-up questions for deeper research.
      
      Format your response as JSON with this structure:
      {
        "analysis": "detailed analysis here",
        "statistics": [
          {
            "value": "extracted numerical data",
            "metric": "what is being measured",
            "context": "why this is important",
            "source": "paper title"
          }
        ],
        "questions": [
          "specific follow-up question 1",
          "specific follow-up question 2"
        ]
      }`;

      const response = await this.model.invoke(researchPrompt + "\n\n" + 
        papers.map(paper => `Title: ${paper.title}\nAuthors: ${paper.authors.join(', ')}\nSummary: ${paper.summary}`).join('\n\n')
      );

      // Parse the model's response
      const analysisResult = JSON.parse(sanitizeJsonString(response.text));

      // Return complete research results
      return {
        summary: papers.map(p => p.summary).join('\n\n'),
        findings: papers.map(paper => ({
          title: paper.title,
          content: paper.summary,
          source: paper.link,
          relevance: "High",
          credibility: 0.9,
          type: "academic",
          category: "Research Paper"
        })),
        keyInsights: papers.map(paper => ({
          point: paper.title,
          explanation: paper.summary,
          supportingEvidence: [paper.authors.join(', '), paper.published]
        })),
        statistics: analysisResult.statistics || [
          {
            value: "N/A",
            metric: "Publication Count",
            context: "Number of papers analyzed",
            source: "Research Analysis"
          }
        ],
        suggestedQuestions: analysisResult.questions || [
          "What are the latest developments in this field?",
          "How does this compare to other approaches?",
          "What are the practical applications of this research?"
        ],
        metadata: {
          sourcesCount: papers.length,
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