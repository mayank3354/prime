import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Import our modular components
import { 
  ResearchResult, 
  ResearchStatus, 
  ResearchMetadata,
  CodeExample,
  Statistic
} from './core/types';
import { SearchUtils } from './core/search-utils';
import { DocumentProcessor } from './core/document-processor';
import { ContentAnalyzer } from './core/content-analyzer';
import { CodeProcessor } from './core/code-processor';
import { TavilySearcher } from './core/tavily-searcher';
import { SpeedOptimizer } from './core/speed-optimizer';

/**
 * Fast Research Agent optimized for speed and accuracy
 */
export class FastResearchAgent {
  private model: BaseChatModel;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private vectorStore: MemoryVectorStore;
  private tavilySearcher: TavilySearcher;

  constructor() {
    console.log("Initializing FastResearchAgent with speed optimizations");
    
    this.model = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.0-flash",
      apiKey: process.env.GOOGLE_API_KEY!,
      temperature: 0.2, // Lower temperature for faster, more focused responses
      maxOutputTokens: 4096, // Reduced for speed
    });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY!,
      modelName: "text-embedding-004",
    });

    this.vectorStore = new MemoryVectorStore(this.embeddings);
    this.tavilySearcher = new TavilySearcher(process.env.TAVILY_API_KEY);
  }

  async research(query: string): Promise<ResearchResult> {
    try {
      console.log(`Starting fast research for: ${query}`);
      
      // Determine optimal strategy based on query complexity
      const strategy = SpeedOptimizer.getOptimalSearchStrategy(query);
      const timeouts = SpeedOptimizer.getTimeouts(strategy);
      
      console.log(`Using ${strategy} strategy with ${timeouts.search}ms search timeout`);
      
      // Enhanced search with timeout
      const searchDocuments = await SpeedOptimizer.createTimeoutPromise(
        this.performOptimizedSearch(query, strategy),
        timeouts.search
      );
      
      // Optimize document processing based on strategy
      const processedDocs = await this.processDocumentsOptimized(
        searchDocuments, 
        query, 
        strategy
      );
      
      // Generate results with timeout
      const results = await SpeedOptimizer.createTimeoutPromise(
        this.generateResultsOptimized(query, processedDocs, strategy),
        timeouts.processing
      );
      
      console.log(`Fast research completed in ${strategy} mode`);
      return results;
      
    } catch (error) {
      console.error("Fast research error:", error);
      return this.createFastFallback(query, error);
    }
  }

  private async performOptimizedSearch(query: string, strategy: string): Promise<Document[]> {
    if (!this.tavilySearcher.hasApiKey()) {
      return [new Document({
        pageContent: `Research topic: ${query}. API limitations prevent comprehensive search.`,
        metadata: { source: "Limited search", title: query }
      })];
    }

    let searchDocuments: Document[] = [];
    
    switch (strategy) {
      case 'quick':
        // Single fast search
        searchDocuments = await this.tavilySearcher.quickSearch(query);
        break;
      case 'comprehensive':
        // Multiple queries for thorough coverage
        searchDocuments = await this.tavilySearcher.searchWithMultipleQueries(query);
        break;
      default:
        // Balanced approach
        const results = await this.tavilySearcher.searchSingle(query, 10, 'advanced');
        searchDocuments = results.map(result => new Document({
          pageContent: SearchUtils.cleanContent(result.content || result.raw_content || ""),
          metadata: { 
            source: result.url,
            title: result.title || "",
            score: result.score || 0,
            domain: SearchUtils.extractDomain(result.url)
          }
        }));
    }

    // Speed-optimize results
    const optimizedResults = SpeedOptimizer.filterForSpeed(
      searchDocuments.map(doc => ({
        title: doc.metadata.title || '',
        url: doc.metadata.source || '',
        content: doc.pageContent,
        score: doc.metadata.score || 0
      }))
    );

    return optimizedResults.map(result => new Document({
      pageContent: result.content,
      metadata: { 
        source: result.url,
        title: result.title,
        score: result.score
      }
    }));
  }

  private async processDocumentsOptimized(
    documents: Document[], 
    query: string, 
    strategy: string
  ): Promise<Document[]> {
    // Filter for quality and speed
    const qualityDocs = DocumentProcessor.filterQualityDocuments(documents);
    const prioritizedDocs = SpeedOptimizer.prioritizeDocuments(qualityDocs);
    
    // Optimize chunk size based on strategy
    const chunkSize = SpeedOptimizer.getOptimalChunkSize(prioritizedDocs.length, strategy);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap: Math.floor(chunkSize * 0.1), // 10% overlap for speed
      separators: ["\n\n", "\n", ". ", " "]
    });
    
    // Create fresh vector store
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    
    // Process documents in batches for efficiency
    const maxDocs = SpeedOptimizer.getOptimalDocumentCount(strategy);
    const selectedDocs = prioritizedDocs.slice(0, maxDocs);
    
    const splitDocs = await textSplitter.splitDocuments(selectedDocs);
    await this.vectorStore.addDocuments(splitDocs);
    
    // Get relevant documents with optimized count
    const relevantDocCount = Math.min(8, Math.floor(maxDocs * 0.8));
    return await DocumentProcessor.getEnhancedRelevantDocs(
      this.vectorStore, 
      query, 
      relevantDocCount
    );
  }

  private async generateResultsOptimized(
    query: string, 
    documents: Document[], 
    strategy: string
  ): Promise<ResearchResult> {
    // Generate summary (always needed)
    const summaryPromise = ContentAnalyzer.generateEnhancedSummary(
      query, 
      documents, 
      this.model
    );

    // Generate findings (always needed)
    const findingsPromise = ContentAnalyzer.extractEnhancedFindings(
      documents, 
      query, 
      this.model
    );

    // Conditionally generate other content based on strategy
    let codeExamplesPromise: Promise<CodeExample[]> = Promise.resolve([]);
    let questionsPromise: Promise<string[]> = Promise.resolve([]);
    let statisticsPromise: Promise<Statistic[]> = Promise.resolve([]);

    if (strategy === 'comprehensive') {
      // Full analysis for comprehensive strategy
      if (SearchUtils.isProgrammingQuery(query)) {
        codeExamplesPromise = CodeProcessor.extractEnhancedCodeExamples(
          documents, 
          query, 
          this.model
        );
      }
      
      questionsPromise = ContentAnalyzer.generateContextualQuestions(
        query, 
        documents, 
        this.model
      );
      
      statisticsPromise = ContentAnalyzer.extractValidatedStatistics(
        documents, 
        query, 
        this.model
      );
    } else if (strategy === 'standard' && SearchUtils.isProgrammingQuery(query)) {
      // Only code examples for standard programming queries
      codeExamplesPromise = CodeProcessor.extractEnhancedCodeExamples(
        documents, 
        query, 
        this.model
      );
    }

    // Execute all promises concurrently
    const [summary, findings, codeExamples, suggestedQuestions, statistics] = await Promise.all([
      summaryPromise,
      findingsPromise,
      codeExamplesPromise,
      questionsPromise,
      statisticsPromise
    ]);

    // Build metadata
    const metadata: ResearchMetadata = {
      sourcesCount: documents.length,
      confidence: DocumentProcessor.calculateConfidence(documents, findings.length),
      researchDepth: strategy === 'quick' ? 'Quick' : strategy === 'comprehensive' ? 'Comprehensive' : 'Standard',
      lastUpdated: new Date().toISOString(),
      searchQueries: strategy === 'comprehensive' ? 3 : 1,
      qualityScore: DocumentProcessor.calculateQualityScore(documents)
    };

    return {
      summary,
      findings: Array.isArray(findings) ? findings : [],
      codeExamples: Array.isArray(codeExamples) ? codeExamples : [],
      suggestedQuestions: Array.isArray(suggestedQuestions) ? suggestedQuestions : [],
      statistics: statistics || [],
      metadata
    };
  }

  private createFastFallback(query: string, error?: unknown): ResearchResult {
    const metadata: ResearchMetadata = {
      sourcesCount: 0,
      confidence: 0.2,
      researchDepth: "Error",
      lastUpdated: new Date().toISOString(),
      searchQueries: 1,
      qualityScore: 0.1,
      error: true,
      errorMessage: error instanceof Error ? error.message : 'Fast search failed'
    };

    return {
      summary: `Fast research for "${query}" encountered limitations. ${error instanceof Error ? error.message : 'Please try again.'}`,
      findings: ContentAnalyzer.createFallbackFindings(query),
      codeExamples: SearchUtils.isProgrammingQuery(query) ? CodeProcessor.createFallbackCodeExamples(query) : [],
      suggestedQuestions: ContentAnalyzer.createFallbackQuestions(query),
      statistics: [],
      metadata
    };
  }

  // Streaming research with real-time updates
  async researchWithStreaming(
    query: string, 
    statusCallback: (status: ResearchStatus) => void
  ): Promise<ResearchResult> {
    try {
      statusCallback({
        stage: 'searching',
        message: 'Performing optimized search...',
        progress: { current: 1, total: 4 }
      });
      
      const strategy = SpeedOptimizer.getOptimalSearchStrategy(query);
      
      statusCallback({
        stage: 'downloading',
        message: `Using ${strategy} search strategy...`,
        progress: { current: 2, total: 4 }
      });
      
      const result = await this.research(query);
      
      statusCallback({
        stage: 'complete',
        message: 'Fast research complete!',
        progress: { current: 4, total: 4 }
      });
      
      return result;
    } catch (error) {
      console.error("Streaming fast research error:", error);
      statusCallback({
        stage: 'complete',
        message: 'Research encountered an error',
        progress: { current: 4, total: 4 }
      });
      
      return this.createFastFallback(query, error);
    }
  }
} 