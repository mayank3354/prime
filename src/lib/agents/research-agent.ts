import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
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
  CodeExample
} from './core/types';
import { SearchUtils } from './core/search-utils';
import { DocumentProcessor } from './core/document-processor';
import { ContentAnalyzer } from './core/content-analyzer';
import { CodeProcessor } from './core/code-processor';
import { TavilySearcher } from './core/tavily-searcher';

/**
 * Simplified ResearchAgent using modular components
 */
export class ResearchAgent {
  private model: BaseChatModel;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private vectorStore: MemoryVectorStore;
  private tavilySearcher: TavilySearcher;
  private lastQuery: string | null = null;

  constructor() {
    console.log("Initializing ResearchAgent with modular components");
    
    this.model = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.0-flash",
      apiKey: process.env.GOOGLE_API_KEY!,
      temperature: 0.3,
      maxOutputTokens: 8192,
    });

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY!,
      modelName: "text-embedding-004",
    });

    // Initialize vector store
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    
    // Initialize Tavily searcher
    this.tavilySearcher = new TavilySearcher(process.env.TAVILY_API_KEY);
  }

  async research(query: string): Promise<ResearchResult> {
    this.lastQuery = query;
    
    try {
      console.log(`Starting research for: ${query}`);
      console.log('Step 1: Initializing search...');
      
      // Enhanced search with modular Tavily searcher
      let searchDocuments: Document[] = [];
      if (this.tavilySearcher.hasApiKey()) {
        console.log('Step 2: Performing Tavily search...');
        searchDocuments = await this.tavilySearcher.searchWithMultipleQueries(query);
        console.log(`Step 2 complete: Found ${searchDocuments.length} documents`);
      } else {
        console.warn("No Tavily API key available, using fallback documents");
        searchDocuments = [
          new Document({
            pageContent: `Research topic: ${query}. API limitations prevent comprehensive search.`,
            metadata: { source: "Limited search", title: query }
          })
        ];
      }
      
      console.log('Step 3: Processing documents...');
      // Enhanced document processing
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1200,
        chunkOverlap: 300,
        separators: ["\n\n", "\n", ". ", " ", ""]
      });
      
      // Create fresh vector store for each query
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      
      // Process and add documents to vector store with quality filtering
      const qualityDocs = DocumentProcessor.filterQualityDocuments(searchDocuments);
      console.log(`Step 3a: Filtered to ${qualityDocs.length} quality documents`);
      
      const splitDocs = await textSplitter.splitDocuments(qualityDocs);
      console.log(`Step 3b: Split into ${splitDocs.length} chunks`);
      
      await this.vectorStore.addDocuments(splitDocs);
      console.log('Step 3c: Added documents to vector store');
      
      // Get most relevant documents with enhanced retrieval
      const relevantDocs = await DocumentProcessor.getEnhancedRelevantDocs(
        this.vectorStore, 
        query, 
        12
      );
      console.log(`Step 4: Retrieved ${relevantDocs.length} relevant documents`);
      
      console.log('Step 5: Generating summary...');
      // Generate comprehensive summary using content analyzer
      const summary = await ContentAnalyzer.generateEnhancedSummary(
        query, 
        relevantDocs, 
        this.model
      );
      console.log('Step 5 complete: Summary generated');

      console.log('Step 6: Extracting findings...');
      // Extract findings with better structure
      const findings = await ContentAnalyzer.extractEnhancedFindings(
        relevantDocs, 
        query, 
        this.model
      );
      console.log(`Step 6 complete: Extracted ${findings.length} findings`);

      // Extract code examples if programming-related
      let codeExamples: CodeExample[] = [];
      if (SearchUtils.isProgrammingQuery(query)) {
        console.log('Step 7: Programming topic detected, extracting code examples');
        codeExamples = await CodeProcessor.extractEnhancedCodeExamples(
          relevantDocs, 
          query, 
          this.model
        );
        console.log(`Step 7 complete: Extracted ${codeExamples.length} code examples`);
      } else {
        console.log('Step 7: Non-programming topic, skipping code examples');
      }

      console.log('Step 8: Generating contextual questions...');
      // Generate contextual questions
      const suggestedQuestions = await ContentAnalyzer.generateContextualQuestions(
        query, 
        relevantDocs, 
        this.model
      );
      console.log(`Step 8 complete: Generated ${suggestedQuestions.length} questions`);

      console.log('Step 9: Extracting statistics...');
      // Extract statistics with validation
      const statistics = await ContentAnalyzer.extractValidatedStatistics(
        relevantDocs, 
        query, 
        this.model
      );
      console.log(`Step 9 complete: Extracted ${statistics.length} statistics`);

      console.log('Step 10: Building metadata...');
      // Build metadata
      const metadata: ResearchMetadata = {
        sourcesCount: relevantDocs.length,
        confidence: DocumentProcessor.calculateConfidence(relevantDocs, findings.length),
        researchDepth: "Comprehensive",
        lastUpdated: new Date().toISOString(),
        searchQueries: SearchUtils.generateSearchQueries(query).length,
        qualityScore: DocumentProcessor.calculateQualityScore(relevantDocs)
      };
      console.log('Step 10 complete: Metadata built');

      console.log('Step 11: Preparing final results...');
      // Return comprehensive results
      const result: ResearchResult = {
        summary,
        findings: Array.isArray(findings) ? findings : [],
        codeExamples: Array.isArray(codeExamples) ? codeExamples : [],
        suggestedQuestions: Array.isArray(suggestedQuestions) ? suggestedQuestions : [],
        statistics: statistics || [],
        metadata
      };
      
      console.log('Research completed successfully!');
      return result;

    } catch (error) {
      console.error("Research error:", error);
      
      // Return enhanced fallback response
      return this.createEnhancedFallback(query, error instanceof Error ? error : undefined);
    }
  }

  // Optimized quick research for faster results
  async quickResearch(query: string): Promise<ResearchResult> {
    this.lastQuery = query;
    
    try {
      console.log(`Starting quick research for: ${query}`);
      
      // Use quick search method
      const searchDocuments = await this.tavilySearcher.quickSearch(query);
      
      // Simplified document processing for speed
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 200,
      });
      
      // Create fresh vector store
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      
      // Process documents quickly
      const splitDocs = await textSplitter.splitDocuments(searchDocuments);
      await this.vectorStore.addDocuments(splitDocs);
      
      // Get fewer but relevant documents
      const relevantDocs = await this.vectorStore.similaritySearch(query, 6);
      
      // Generate summary and findings quickly
      const summary = await ContentAnalyzer.generateEnhancedSummary(
        query, 
        relevantDocs, 
        this.model
      );
      
      const findings = await ContentAnalyzer.extractEnhancedFindings(
        relevantDocs, 
        query, 
        this.model
      );

      const metadata: ResearchMetadata = {
        sourcesCount: relevantDocs.length,
        confidence: DocumentProcessor.calculateConfidence(relevantDocs, findings.length),
        researchDepth: "Quick",
        lastUpdated: new Date().toISOString(),
        searchQueries: 1,
        qualityScore: DocumentProcessor.calculateQualityScore(relevantDocs)
      };

      return {
        summary,
        findings: Array.isArray(findings) ? findings : [],
        codeExamples: [],
        suggestedQuestions: [],
        statistics: [],
        metadata
      };

    } catch (error) {
      console.error("Quick research error:", error);
      return this.createEnhancedFallback(query, error instanceof Error ? error : undefined);
    }
  }

  // Enhanced fallback creation
  private createEnhancedFallback(query: string, error?: Error): ResearchResult {
    const metadata: ResearchMetadata = {
      sourcesCount: 0,
      confidence: 0.3,
      researchDepth: "Limited",
      lastUpdated: new Date().toISOString(),
      searchQueries: 1,
      qualityScore: 0.2,
      error: true,
      errorMessage: error?.message || 'Unknown research error'
    };

    return {
      summary: `Research analysis for "${query}" encountered technical limitations. ${error?.message || 'Please try again or refine your search terms.'}`,
      findings: ContentAnalyzer.createFallbackFindings(query),
      codeExamples: SearchUtils.isProgrammingQuery(query) ? CodeProcessor.createFallbackCodeExamples(query) : [],
      suggestedQuestions: ContentAnalyzer.createFallbackQuestions(query),
      statistics: [],
      metadata
    };
  }

  // API endpoint handler
  async try(request: Request) {
    try {
      const apiKey = request.headers.get('x-api-key');
      if (!apiKey) {
        return NextResponse.json(
          { message: 'API key is required' },
          { status: 401 }
        );
      }

      const supabase = createRouteHandlerClient({ cookies });
      const { query, mode = 'comprehensive' } = await request.json();
      
      if (!query) {
        return NextResponse.json(
          { message: 'Query is required' },
          { status: 400 }
        );
      }

      // Validate API key and get current usage
      const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('id, usage, monthly_limit, is_monthly_limit')
        .eq('key', apiKey)
        .single();

      if (keyError || !keyData) {
        return NextResponse.json(
          { message: 'Invalid API key' },
          { status: 401 }
        );
      }

      // Check usage limits
      if (keyData.is_monthly_limit && keyData.usage >= keyData.monthly_limit) {
        return NextResponse.json(
          { message: 'Monthly API limit exceeded' },
          { status: 429 }
        );
      }

      // Perform research based on mode
      const searchResults = mode === 'quick' 
        ? await this.quickResearch(query)
        : await this.research(query);

      // Update API usage
      await supabase
        .from('api_keys')
        .update({ 
          usage: (keyData.usage || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', keyData.id);

      return NextResponse.json({ research: searchResults });

    } catch (error) {
      console.error('Research API error:', error);
      return NextResponse.json(
        { message: 'Research failed', error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Streaming research method for real-time updates
  async researchWithStreaming(
    query: string, 
    statusCallback: (status: ResearchStatus) => void
  ): Promise<ResearchResult> {
    this.lastQuery = query;
    
    try {
      statusCallback({
        stage: 'searching',
        message: 'Performing enhanced search...',
        progress: { current: 1, total: 5 }
      });
      
      const result = await this.research(query);
      
      statusCallback({
        stage: 'complete',
        message: 'Enhanced research complete!',
        progress: { current: 5, total: 5 }
      });
      
      return result;
    } catch (error) {
      console.error("Streaming research error:", error);
      statusCallback({
        stage: 'complete',
        message: 'Research encountered an error',
        progress: { current: 5, total: 5 }
      });
      
      return this.createEnhancedFallback(query, error instanceof Error ? error : new Error('Unknown error'));
    }
  }
} 