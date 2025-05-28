import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { createClient } from "@supabase/supabase-js";
import { ResearchStatus, StatusCallback } from "@/types/research";

// Import modular components
import { 
  ArxivPaper, 
  CodeRepository, 

  RAGResponse 
} from './academic-types';
import { ArxivSearcher } from './arxiv-searcher';
import { GitHubSearcher } from './github-searcher';
import { PDFProcessor } from './pdf-processor';
import { AcademicRAGAnalyzer } from './academic-rag-analyzer';

/**
 * Modular Academic Research Agent that orchestrates specialized research components
 */
export class ModularAcademicAgent {
  private model: ChatGoogleGenerativeAI;
  private vectorStore: SupabaseVectorStore;
  private statusCallback?: StatusCallback;

  // Specialized modules
  private arxivSearcher: ArxivSearcher;
  private githubSearcher: GitHubSearcher;
  private pdfProcessor: PDFProcessor;
  private ragAnalyzer: AcademicRAGAnalyzer;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback;
    
    // Initialize AI model
    this.model = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.0-flash",
      apiKey: process.env.GOOGLE_API_KEY!,
      temperature: 0.3,
      maxOutputTokens: 8192,
    });

    // Initialize embeddings and vector store
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY!,
      modelName: "text-embedding-004",
    });

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.vectorStore = new SupabaseVectorStore(embeddings, {
      client,
      tableName: 'documents',
      queryName: 'match_documents',
      filter: undefined,
    });

    // Initialize specialized modules
    this.arxivSearcher = new ArxivSearcher(statusCallback);
    this.githubSearcher = new GitHubSearcher(statusCallback);
    this.pdfProcessor = new PDFProcessor(statusCallback);
    this.ragAnalyzer = new AcademicRAGAnalyzer(statusCallback);
  }

  private updateStatus(status: ResearchStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  /**
   * Main research method that orchestrates all components
   */
  async research(query: string) {
    if (!query || query.trim().length < 3) {
      return this.getEmptyResponse("Please provide a more specific research query");
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
        
        // Phase 1: Search for papers and code repositories in parallel
        const [papers, codeResults] = await Promise.allSettled([
          this.arxivSearcher.searchPapers(query),
          this.githubSearcher.searchRepositories(query)
        ]);

        const validPapers = papers.status === 'fulfilled' ? papers.value : [];
        const validCodeResults = codeResults.status === 'fulfilled' ? codeResults.value : [];

        if (validPapers.length === 0 && validCodeResults.length === 0) {
          throw new Error("No relevant sources found");
        }

        // Phase 2: Process and embed papers if found
        if (validPapers.length > 0) {
          await this.pdfProcessor.processAndEmbedPapers(
            validPapers, 
            async (docs) => {
              await this.vectorStore.addDocuments(docs);
            }
          );
        }

        this.updateStatus({
          stage: 'analyzing',
          message: 'Performing comprehensive analysis...',
          progress: { current: 4, total: 5 }
        });

        // Phase 3: Perform RAG-based analysis
        const ragResults = await this.ragAnalyzer.performRAGSearch(
          query, 
          this.vectorStore, 
          this.model
        );

        this.updateStatus({
          stage: 'complete',
          message: 'Academic research completed successfully!',
          progress: { current: 5, total: 5 }
        });

        // Phase 4: Format and return results
        return this.formatResearchResults(query, ragResults, validPapers, validCodeResults);

      } catch (error) {
        console.error(`Academic research error (attempt ${attempts}):`, error);
        
        if (attempts >= maxAttempts) {
          this.updateStatus({
            stage: 'complete',
            message: 'Research completed with limitations',
            progress: { current: 5, total: 5 }
          });

          return this.getErrorResponse(query, maxAttempts);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Format research results into the expected structure
   */
  private formatResearchResults(
    query: string, 
    ragResults: RAGResponse, 
    papers: ArxivPaper[], 
    codeResults: CodeRepository[]
  ) {
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
      suggestedQuestions: AcademicRAGAnalyzer.generateContextualQuestions(
        ragResults.questions || [], 
        query
      ),
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
        confidence: AcademicRAGAnalyzer.calculateConfidenceScore(ragResults, papers.length),
        researchDepth: "Academic",
        lastUpdated: new Date().toISOString()
      }
    };
  }

  // Helper methods
  private getEmptyResponse(message: string) {
    return {
      summary: message,
      findings: [],
      keyInsights: [],
      statistics: [],
      codeExamples: [],
      suggestedQuestions: ["What specific aspect would you like to research?"],
      metadata: { 
        sourcesCount: 0, 
        confidence: 0, 
        researchDepth: "None", 
        lastUpdated: new Date().toISOString() 
      }
    };
  }

  private getErrorResponse(query: string, maxAttempts: number) {
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

  private determineRelevance(summary: string, query: string): string {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const summaryLower = summary.toLowerCase();
    const matches = queryTerms.filter(term => summaryLower.includes(term)).length;
    const relevanceRatio = matches / queryTerms.length;
    
    if (relevanceRatio >= 0.7) return "High";
    if (relevanceRatio >= 0.4) return "Medium";
    return "Low";
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
} 