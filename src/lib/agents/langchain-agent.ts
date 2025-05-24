import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { WebBrowser } from "langchain/tools/webbrowser";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Define interfaces for better type safety
interface CodeExample {
  title: string;
  language: string;
  code: string;
  description: string;
  source?: string;
}



interface TavilyResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score?: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

interface ResearchStatus {
  stage: 'searching' | 'downloading' | 'processing' | 'analyzing' | 'complete';
  message: string;
  progress: { current: number; total: number };
}

interface Statistic {
  metric: string;
  value: string;
  context: string;
  source: string;
}

interface Finding {
  title: string;
  content: string;
  source: string;
  relevance: string;
  type: string;
  category?: string;
}

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

export class ResearchAgent {
  private model: BaseChatModel;
  private webBrowser: WebBrowser;
  private tavilyRetriever: TavilySearchAPIRetriever;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private vectorStore: MemoryVectorStore;
  private lastQuery: string | null = null;

  constructor() {
    console.log("Initializing ResearchAgent with Google Generative AI");
    
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
    
    // Initialize web browser
    this.webBrowser = new WebBrowser({
      model: this.model,
      embeddings: this.embeddings
    });
    
    // Initialize Tavily retriever
    this.tavilyRetriever = new TavilySearchAPIRetriever({
      apiKey: process.env.TAVILY_API_KEY,
      k: 10,
      includeRawContent: true,
      includeImages: false,
    });
  }

  async research(query: string) {
    // Store the query for later use
    this.lastQuery = query;
    
    try {
      // Check if Tavily API key is available
      if (!process.env.TAVILY_API_KEY) {
        console.error("Tavily API key is missing");
        throw new Error("Tavily API key is missing");
      }
      
      // Enhanced search with multiple strategies
      let tavilyDocs: Document[] = [];
      try {
        // Use multiple search queries for better coverage
        const searchQueries = this.generateSearchQueries(query);
        const allResults: TavilyResult[] = [];
        
        for (const searchQuery of searchQueries) {
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`
            },
            body: JSON.stringify({
              query: searchQuery,
              search_depth: "advanced",
              include_raw_content: true,
              include_images: false,
              max_results: 5,
              include_domains: this.getRelevantDomains(query),
              exclude_domains: ["pinterest.com", "instagram.com", "facebook.com"]
            })
          });
          
          if (response.ok) {
            const data: TavilyResponse = await response.json();
            allResults.push(...data.results);
          }
        }
        
        // Remove duplicates and sort by relevance
        const uniqueResults = this.deduplicateResults(allResults);
        const sortedResults = this.rankResults(uniqueResults, query);
        
        // Convert to Documents with enhanced metadata
        tavilyDocs = sortedResults.slice(0, 15).map(result => {
          return new Document({
            pageContent: this.cleanContent(result.raw_content || result.content || ""),
            metadata: { 
              source: result.url,
              title: result.title || "",
              score: result.score || 0,
              domain: this.extractDomain(result.url),
              contentLength: (result.raw_content || result.content || "").length
            }
          });
        });
        
        console.log(`Found ${tavilyDocs.length} high-quality documents from enhanced search`);
      } catch (tavilyError) {
        console.error("Error fetching documents from Tavily:", tavilyError);
        // Create fallback documents
        tavilyDocs = [
          new Document({
            pageContent: `Unable to retrieve comprehensive information for: ${query}. This may be due to API limitations or network issues.`,
            metadata: { source: "Error recovery", title: query }
          })
        ];
      }
      
      // Enhanced document processing
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1200,
        chunkOverlap: 300,
        separators: ["\n\n", "\n", ". ", " ", ""]
      });
      
      // Create fresh vector store for each query
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      
      // Process and add documents to vector store with quality filtering
      const qualityDocs = this.filterQualityDocuments(tavilyDocs);
      const splitDocs = await textSplitter.splitDocuments(qualityDocs);
      await this.vectorStore.addDocuments(splitDocs);
      
      // Get most relevant documents with enhanced retrieval
      const relevantDocs = await this.getEnhancedRelevantDocs(query, 12);
      console.log("Retrieved most relevant content through enhanced RAG");
      
      // Generate comprehensive summary
      const summary = await this.generateEnhancedSummary(query, relevantDocs);

      // Extract findings with better structure
      const findings = await this.extractEnhancedFindings(relevantDocs, query);

      // Extract code examples if programming-related
      let codeExamples: CodeExample[] = [];
      if (this.isProgrammingQuery(query)) {
        console.log('Programming topic detected, extracting code examples');
        codeExamples = await this.extractEnhancedCodeExamples(relevantDocs, query);
      }

      // Generate contextual questions
      const suggestedQuestions = await this.generateContextualQuestions(query, relevantDocs);

      // Extract statistics with validation
      const statistics = await this.extractValidatedStatistics(relevantDocs, query);

      // Return comprehensive results
      return {
        summary: summary,
        findings: Array.isArray(findings) ? findings : [],
        codeExamples: Array.isArray(codeExamples) ? codeExamples : [],
        suggestedQuestions: Array.isArray(suggestedQuestions) ? suggestedQuestions : [],
        statistics: statistics,
        metadata: {
          sourcesCount: relevantDocs.length,
          confidence: this.calculateConfidence(relevantDocs, findings),
          researchDepth: "Comprehensive",
          lastUpdated: new Date().toISOString(),
          searchQueries: this.generateSearchQueries(query).length,
          qualityScore: this.calculateQualityScore(relevantDocs)
        }
      };

    } catch (error) {
      console.error("Research error:", error);
      
      // Return enhanced fallback response
      return this.createEnhancedFallback(query, []);
    }
  }

  // Enhanced search query generation
  private generateSearchQueries(query: string): string[] {
    const baseQuery = query.trim();
    const queries = [baseQuery];
    
    // Add variations for better coverage
    if (this.isProgrammingQuery(query)) {
      queries.push(`${baseQuery} tutorial examples`);
      queries.push(`${baseQuery} best practices guide`);
      queries.push(`${baseQuery} documentation official`);
    } else {
      queries.push(`${baseQuery} latest research 2024`);
      queries.push(`${baseQuery} comprehensive guide`);
      queries.push(`${baseQuery} expert analysis`);
    }
    
    // Add specific domain queries
    if (baseQuery.length > 20) {
      const keywords = this.extractKeywords(baseQuery);
      if (keywords.length > 1) {
        queries.push(keywords.slice(0, 3).join(' '));
      }
    }
    
    return queries.slice(0, 3); // Limit to 3 queries to avoid rate limits
  }

  // Get relevant domains for search
  private getRelevantDomains(query: string): string[] {
    const domains: string[] = [];
    
    if (this.isProgrammingQuery(query)) {
      domains.push("stackoverflow.com", "github.com", "developer.mozilla.org", "docs.python.org");
    }
    
    // Add academic domains for research topics
    if (query.toLowerCase().includes('research') || query.toLowerCase().includes('study')) {
      domains.push("arxiv.org", "scholar.google.com", "researchgate.net");
    }
    
    // Add news domains for current events
    if (query.toLowerCase().includes('news') || query.toLowerCase().includes('2024')) {
      domains.push("reuters.com", "bbc.com", "techcrunch.com");
    }
    
    return domains;
  }

  // Deduplicate search results
  private deduplicateResults(results: TavilyResult[]): TavilyResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.url.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Rank results by relevance
  private rankResults(results: TavilyResult[], query: string): TavilyResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return results
      .map(result => {
        let relevanceScore = result.score || 0;
        
        // Boost score based on title relevance
        const titleLower = result.title.toLowerCase();
        const titleMatches = queryTerms.filter(term => titleLower.includes(term)).length;
        relevanceScore += titleMatches * 0.2;
        
        // Boost score based on content relevance
        const contentLower = (result.content || '').toLowerCase();
        const contentMatches = queryTerms.filter(term => contentLower.includes(term)).length;
        relevanceScore += contentMatches * 0.1;
        
        // Boost authoritative domains
        const domain = this.extractDomain(result.url);
        if (this.isAuthoritativeDomain(domain)) {
          relevanceScore += 0.3;
        }
        
        return { ...result, score: relevanceScore };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // Clean content for better processing
  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()\-"']/g, '')
      .trim();
  }

  // Extract domain from URL
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  // Check if domain is authoritative
  private isAuthoritativeDomain(domain: string): boolean {
    const authoritative = [
      'wikipedia.org', 'github.com', 'stackoverflow.com', 'mozilla.org',
      'python.org', 'nodejs.org', 'reactjs.org', 'angular.io', 'vuejs.org',
      'arxiv.org', 'nature.com', 'science.org', 'ieee.org'
    ];
    return authoritative.some(auth => domain.includes(auth));
  }

  // Filter documents by quality
  private filterQualityDocuments(docs: Document[]): Document[] {
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
  private async getEnhancedRelevantDocs(query: string, k: number): Promise<Document[]> {
    // Get initial results
    const initialDocs = await this.vectorStore.similaritySearch(query, k * 2);
    
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
        if (doc.metadata.source && this.isAuthoritativeDomain(this.extractDomain(doc.metadata.source))) {
          score *= 1.5;
        }
        
        return { doc, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(item => item.doc);
    
    return rankedDocs;
  }

  // Enhanced summary generation
  private async generateEnhancedSummary(query: string, documents: Document[]): Promise<string> {
    const summaryChain = RunnableSequence.from([
      {
        context: () => documents.map(doc => 
          `Source: ${doc.metadata.source || 'Unknown'}\nTitle: ${doc.metadata.title || ''}\nContent: ${doc.pageContent.substring(0, 800)}`
        ).join('\n---\n'),
        query: () => query
      },
      ChatPromptTemplate.fromTemplate(`
        You are an expert research analyst. Provide a comprehensive analysis of: {query}
        
        Research Data:
        {context}
        
        Create a detailed summary that includes:
        1. A clear introduction to the topic
        2. Current state and recent developments
        3. Key challenges and opportunities
        4. Future outlook and implications
        
        Write in a professional, informative tone with specific details and examples.
        Aim for 3-4 well-structured paragraphs.
      `),
      this.model,
      new StringOutputParser(),
    ]);

    try {
      return await summaryChain.invoke({});
    } catch (error) {
      console.error("Error generating enhanced summary:", error);
      return `Research analysis for "${query}" encountered processing issues. The topic appears to be related to ${query} based on available sources.`;
    }
  }

  // Enhanced findings extraction
  private async extractEnhancedFindings(documents: Document[], query: string): Promise<Finding[]> {
    try {
      const findingsPrompt = `
        Analyze the research data about: ${query}
        
        Research Content:
        ${documents.map(doc => `${doc.pageContent.substring(0, 600)}\nSource: ${doc.metadata.source}`).join('\n\n---\n\n')}
        
        Extract 4-6 key findings. For each finding, provide:
        
        FINDING_START
        TITLE: [Clear, specific title]
        CONTENT: [2-3 sentences with specific details, facts, or insights]
        SOURCE: [Source URL or reference]
        CATEGORY: [Technology/Research/Market/Scientific/etc.]
        FINDING_END
        
        Focus on factual, verifiable information with specific details.
      `;
      
      const response = await this.model.invoke(findingsPrompt);
      const responseText = typeof response === 'string' ? response : response.content.toString();
      
      return this.parseStructuredFindings(responseText);
    } catch (error) {
      console.error("Error extracting enhanced findings:", error);
      return this.createFallbackFindings(query);
    }
  }

  // Parse structured findings
  private parseStructuredFindings(text: string): Finding[] {
    const findings: Finding[] = [];
    const findingBlocks = text.split('FINDING_START').slice(1);
    
    for (const block of findingBlocks) {
      const endIndex = block.indexOf('FINDING_END');
      const content = endIndex > -1 ? block.substring(0, endIndex) : block;
      
      const titleMatch = content.match(/TITLE:\s*(.+?)(?=\n|CONTENT:)/s);
      const contentMatch = content.match(/CONTENT:\s*(.+?)(?=\n|SOURCE:)/s);
      const sourceMatch = content.match(/SOURCE:\s*(.+?)(?=\n|CATEGORY:)/s);
      const categoryMatch = content.match(/CATEGORY:\s*(.+?)(?=\n|$)/s);
      
      if (titleMatch && contentMatch) {
        findings.push({
          title: titleMatch[1].trim(),
          content: contentMatch[1].trim(),
          source: sourceMatch?.[1]?.trim() || 'Research data',
          relevance: 'High',
          type: 'Finding',
          category: categoryMatch?.[1]?.trim() || 'General'
        });
      }
    }
    
    return findings;
  }

  // Enhanced code examples extraction
  private async extractEnhancedCodeExamples(documents: Document[], query: string): Promise<CodeExample[]> {
    try {
      // First extract existing code blocks
      const directExamples = this.extractDirectCodeBlocks(documents);
      
      if (directExamples.length >= 2) {
        return directExamples.slice(0, 3);
      }
      
      // Generate additional examples if needed
      const generatedExamples = await this.generateContextualCodeExamples(query, documents);
      
      return [...directExamples, ...generatedExamples].slice(0, 3);
    } catch (error) {
      console.error('Error extracting enhanced code examples:', error);
      return this.createFallbackCodeExamples(query);
    }
  }

  // Extract direct code blocks from documents
  private extractDirectCodeBlocks(documents: Document[]): CodeExample[] {
    const examples: CodeExample[] = [];
    
    for (const doc of documents) {
      const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
      let match;
      
      while ((match = codeBlockRegex.exec(doc.pageContent)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        
        if (code.length > 20 && this.isValidCode(code, language)) {
          examples.push({
            title: `${language.charAt(0).toUpperCase() + language.slice(1)} Example`,
            language: language,
            code: code,
            description: `Code example extracted from source documentation`,
            source: doc.metadata?.source || 'Research data'
          });
        }
      }
    }
    
    return examples;
  }

  // Validate if extracted text is actual code
  private isValidCode(code: string, language: string): boolean {
    // Basic validation for common programming constructs
    const codePatterns = [
      /function\s+\w+/,
      /def\s+\w+/,
      /class\s+\w+/,
      /import\s+\w+/,
      /const\s+\w+/,
      /let\s+\w+/,
      /var\s+\w+/,
      /#include/,
      /public\s+class/
    ];
    
    return codePatterns.some(pattern => pattern.test(code)) || 
           code.includes('{') || 
           code.includes('(') ||
           (language === 'python' && code.includes(':'));
  }

  // Generate contextual code examples
  private async generateContextualCodeExamples(query: string, documents: Document[]): Promise<CodeExample[]> {
    const language = this.detectLanguageFromQuery(query);
    const context = documents.map(doc => doc.pageContent.substring(0, 300)).join('\n');
    
    const codePrompt = `
      Generate a practical ${language} code example for: ${query}
      
      Context from research:
      ${context}
      
      Provide a working code example that demonstrates the concept.
      Include comments explaining key parts.
      Make it practical and educational.
      
      Format:
      TITLE: [Descriptive title]
      LANGUAGE: ${language}
      CODE_START
      [Your code here]
      CODE_END
      DESCRIPTION: [Brief explanation of what the code does]
    `;
    
    try {
      const response = await this.model.invoke(codePrompt);
      const responseText = response.content.toString();
      
      return this.parseGeneratedCodeExample(responseText, language);
    } catch (error) {
      console.error('Error generating contextual code examples:', error);
      return [];
    }
  }

  // Parse generated code example
  private parseGeneratedCodeExample(text: string, language: string): CodeExample[] {
    const titleMatch = text.match(/TITLE:\s*(.+?)(?=\n)/);
    const codeMatch = text.match(/CODE_START\s*([\s\S]*?)\s*CODE_END/);
    const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?=\n|$)/);
    
    if (codeMatch) {
      return [{
        title: titleMatch?.[1]?.trim() || `${language} Example`,
        language: language,
        code: codeMatch[1].trim(),
        description: descMatch?.[1]?.trim() || 'Generated code example',
        source: 'AI-generated'
      }];
    }
    
    return [];
  }

  // Generate contextual questions
  private async generateContextualQuestions(query: string, documents: Document[]): Promise<string[]> {
    try {
      const questionsPrompt = `
        Based on the research about: ${query}
        
        Key topics found:
        ${documents.map(doc => doc.pageContent.substring(0, 200)).join('\n')}
        
        Generate 5 insightful follow-up questions that would help someone:
        1. Understand deeper technical aspects
        2. Explore practical applications
        3. Compare with alternatives
        4. Understand future implications
        5. Learn about best practices
        
        Make questions specific to ${query} and based on the research content.
        
        Format each question on a new line starting with "Q: "
      `;
      
      const response = await this.model.invoke(questionsPrompt);
      const responseText = response.content.toString();
      
      const questions = responseText
        .split('\n')
        .filter(line => line.trim().startsWith('Q: '))
        .map(line => line.replace('Q: ', '').trim())
        .filter(q => q.length > 10)
        .slice(0, 5);
      
      return questions.length > 0 ? questions : this.createFallbackQuestions(query);
    } catch (error) {
      console.error("Error generating contextual questions:", error);
      return this.createFallbackQuestions(query);
    }
  }

  // Extract validated statistics
  private async extractValidatedStatistics(documents: Document[], query: string): Promise<Statistic[]> {
    try {
      const statsPrompt = `
        Extract numerical data and statistics from this research about: ${query}
        
        Content:
        ${documents.map(doc => doc.pageContent.substring(0, 500)).join('\n\n')}
        
        Find 3-5 specific statistics, metrics, or numerical facts.
        
        For each statistic:
        STAT_START
        METRIC: [What is being measured]
        VALUE: [The numerical value with units]
        CONTEXT: [Why this number is significant]
        SOURCE: [Where this data comes from]
        STAT_END
        
        Only include verifiable, specific numbers. Avoid vague estimates.
      `;
      
      const response = await this.model.invoke(statsPrompt);
      const responseText = response.content.toString();
      
      return this.parseStructuredStatistics(responseText);
    } catch (error) {
      console.error("Error extracting validated statistics:", error);
      return [];
    }
  }

  // Parse structured statistics
  private parseStructuredStatistics(text: string): Statistic[] {
    const statistics: Statistic[] = [];
    const statBlocks = text.split('STAT_START').slice(1);
    
    for (const block of statBlocks) {
      const endIndex = block.indexOf('STAT_END');
      const content = endIndex > -1 ? block.substring(0, endIndex) : block;
      
      const metricMatch = content.match(/METRIC:\s*(.+?)(?=\n|VALUE:)/s);
      const valueMatch = content.match(/VALUE:\s*(.+?)(?=\n|CONTEXT:)/s);
      const contextMatch = content.match(/CONTEXT:\s*(.+?)(?=\n|SOURCE:)/s);
      const sourceMatch = content.match(/SOURCE:\s*(.+?)(?=\n|$)/s);
      
      if (metricMatch && valueMatch && this.isValidStatistic(valueMatch[1])) {
        statistics.push({
          metric: metricMatch[1].trim(),
          value: valueMatch[1].trim(),
          context: contextMatch?.[1]?.trim() || 'Statistical data',
          source: sourceMatch?.[1]?.trim() || 'Research data'
        });
      }
    }
    
    return statistics;
  }

  // Validate if a value is a proper statistic
  private isValidStatistic(value: string): boolean {
    // Check if value contains numbers and reasonable units
    const hasNumber = /\d/.test(value);
    const hasReasonableLength = value.length < 100;
    const notJustText = !/^[a-zA-Z\s]+$/.test(value);
    
    return hasNumber && hasReasonableLength && notJustText;
  }

  // Calculate confidence score
  private calculateConfidence(docs: Document[], findings: Finding[]): number {
    let confidence = 0.5; // Base confidence
    
    // Boost for number of sources
    confidence += Math.min(docs.length * 0.05, 0.3);
    
    // Boost for authoritative sources
    const authSources = docs.filter(doc => 
      doc.metadata.source && this.isAuthoritativeDomain(this.extractDomain(doc.metadata.source))
    ).length;
    confidence += authSources * 0.1;
    
    // Boost for number of findings
    confidence += Math.min(findings.length * 0.05, 0.2);
    
    return Math.min(confidence, 1.0);
  }

  // Calculate quality score
  private calculateQualityScore(docs: Document[]): number {
    if (docs.length === 0) return 0;
    
    const avgLength = docs.reduce((sum, doc) => sum + doc.pageContent.length, 0) / docs.length;
    const authoritativeCount = docs.filter(doc => 
      doc.metadata.source && this.isAuthoritativeDomain(this.extractDomain(doc.metadata.source))
    ).length;
    
    let score = 0.5;
    score += Math.min(avgLength / 2000, 0.3); // Content length factor
    score += (authoritativeCount / docs.length) * 0.2; // Authority factor
    
    return Math.min(score, 1.0);
  }

  // Extract keywords from query
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why']);
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5);
  }

  // Helper methods for fallbacks
  private createFallbackFindings(query: string): Finding[] {
    return [{
      title: "Research Topic Overview",
      content: `This research focuses on ${query} and related concepts. The analysis covers current developments and key aspects of this topic.`,
      source: "Research analysis",
      relevance: "High",
      type: "Overview",
      category: "General"
    }];
  }

  private createFallbackCodeExamples(query: string): CodeExample[] {
    const language = this.detectLanguageFromQuery(query);
    return [{
      title: `Basic ${language} Example`,
      language: language,
      code: this.generateFallbackCode(query),
      description: `A simple example demonstrating concepts related to ${query}`,
      source: 'Generated example'
    }];
  }

  private createFallbackQuestions(query: string): string[] {
    return [
      `What are the key components of ${query}?`,
      `How can ${query} be implemented effectively?`,
      `What are the best practices for ${query}?`,
      `What are the latest developments in ${query}?`,
      `How does ${query} compare to alternative approaches?`
    ];
  }

  // ... existing methods (isProgrammingQuery, detectLanguageFromQuery, generateFallbackCode, etc.)
  // Keep all the existing helper methods from the original file

  private isProgrammingQuery(query: string): boolean {
    const programmingKeywords = [
      'code', 'program', 'function', 'algorithm', 'develop', 'software',
      'app', 'application', 'website', 'web', 'javascript', 'python', 'java',
      'c++', 'programming', 'developer', 'development', 'script', 'library',
      'framework', 'api', 'backend', 'frontend', 'fullstack', 'database',
      'sql', 'nosql', 'react', 'angular', 'vue', 'node', 'express', 'django',
      'flask', 'spring', 'boot', 'docker', 'kubernetes', 'devops', 'git',
      'github', 'gitlab', 'bitbucket', 'ci/cd', 'continuous integration',
      'deployment', 'testing', 'unit test', 'integration test', 'e2e test'
    ];
    
    const queryLower = query.toLowerCase();
    return programmingKeywords.some(keyword => queryLower.includes(keyword));
  }

  private detectLanguageFromQuery(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('python') || queryLower.includes('django') || queryLower.includes('flask')) {
      return 'python';
    } else if (queryLower.includes('javascript') || queryLower.includes('js') || queryLower.includes('node')) {
      return 'javascript';
    } else if (queryLower.includes('java') || queryLower.includes('spring')) {
      return 'java';
    } else if (queryLower.includes('typescript') || queryLower.includes('ts')) {
      return 'typescript';
    } else {
      return 'python'; // Default
    }
  }

  private generateFallbackCode(query: string): string {
    const language = this.detectLanguageFromQuery(query);
    
    switch (language) {
      case 'python':
        return `# Example implementation for ${query}
def main():
    """
    A simple example demonstrating ${query}
    """
    print(f"Working with: ${query}")
    
    # Implementation would go here
    result = process_data()
    return result

def process_data():
    """Process data related to the query"""
    return "Example result"

if __name__ == "__main__":
    main()`;
      
      case 'javascript':
        return `// Example implementation for ${query}
function main() {
    /**
     * A simple example demonstrating ${query}
     */
    console.log(\`Working with: ${query}\`);
    
    // Implementation would go here
    const result = processData();
    return result;
}

function processData() {
    // Process data related to the query
    return "Example result";
}

main();`;
      
      default:
        return `// Example code for ${query}
function example() {
    console.log("This demonstrates ${query}");
    return "result";
}`;
    }
  }

  // Enhanced fallback creation
  private createEnhancedFallback(query: string, docs: Document[]) {
    return {
      summary: `Research analysis for "${query}" encountered technical limitations. This topic involves ${query} and related concepts that would benefit from further investigation with more specific search terms.`,
      findings: this.createFallbackFindings(query),
      codeExamples: this.isProgrammingQuery(query) ? this.createFallbackCodeExamples(query) : [],
      suggestedQuestions: this.createFallbackQuestions(query),
      statistics: [],
      metadata: {
        sourcesCount: docs.length,
        confidence: 0.3,
        researchDepth: "Limited",
        lastUpdated: new Date().toISOString(),
        searchQueries: 1,
        qualityScore: 0.2,
        error: true
      }
    };
  }

  // Keep existing API methods (try, researchWithStreaming, etc.) with minimal changes
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
      const { query } = await request.json();
      
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

      // Perform enhanced research
      const searchResults = await this.research(query);

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
      console.error('Research error:', error);
      return NextResponse.json(
        { message: 'Research failed', error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Streaming research method
  async researchWithStreaming(query: string, statusCallback: (status: ResearchStatus) => void) {
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
      
      return this.createEnhancedFallback(query, []);
    }
  }
} 