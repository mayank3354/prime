import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { WebBrowser } from "langchain/tools/webbrowser";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
//import { createClient } from "@supabase/supabase-js";
//import axios from 'axios';
//import * as cheerio from 'cheerio';
//import { ChatGroq } from "@langchain/groq";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { MessageContent } from "@langchain/core/messages";

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

// Define interfaces for code examples and extracted blocks
interface CodeExample {
  title: string;
  language: string;
  code: string;
  description: string;
  source?: string;
}

interface CodeBlock {
  language: string;
  code: string;
}

// Add this interface near your other interfaces
interface TextContent {
  text?: string;
  content?: string;
}

// // Add interface for search result structure
// interface SearchResult {
//   title: string;
//   content: string;
//   url: string;
//   snippet?: string;
//   score?: number;
// }

// interface ResearchResponse {
//   summary: string;
//   findings: Array<{
//     title: string;
//     content: string;
//     source: string;
//     relevance: string;
//     type: string;
//   }>;
//   metadata: {
//     sourcesCount: number;
//     confidence: number;
//     researchDepth: string;
//   };
// }

export class ResearchAgent {
  private model: BaseChatModel;
  private webBrowser: WebBrowser;
  private tavilyRetriever: TavilySearchAPIRetriever;
  private embeddings: GoogleGenerativeAIEmbeddings | OllamaEmbeddings;
  private vectorStore: MemoryVectorStore;
  private useOllama: boolean;

  constructor(config: {
    useOllama?: boolean;
    ollamaModel?: string;
    ollamaBaseUrl?: string;
  } = {}) {
    this.useOllama = config.useOllama ?? false;

    if (this.useOllama) {
      // Initialize Ollama model
      this.model = new ChatOllama({
        baseUrl: config.ollamaBaseUrl || "http://localhost:11434",
        model: config.ollamaModel || "deepseek-coder:latest",
          temperature: 0.3,
        });

      // Initialize Ollama embeddings
      this.embeddings = new OllamaEmbeddings({
        baseUrl: config.ollamaBaseUrl || "http://localhost:11434",
        model: config.ollamaModel || "deepseek-coder:latest",
      });
    } else {
      // Initialize Google model with the correct API version
      this.model = new ChatGoogleGenerativeAI({
        modelName: "gemini-1.5-pro",
        apiKey: process.env.GOOGLE_API_KEY!,
        temperature: 0.3,
        maxOutputTokens: 8192,
      });

      // Also update the embeddings
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY!,
        modelName: "embedding-001",
        
      });
    }

    // Initialize vector store
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    
    // Initialize web browser with appropriate model and embeddings
    this.webBrowser = new WebBrowser({ 
      model: this.model, 
      embeddings: this.embeddings
    });

    // Initialize Tavily
    this.tavilyRetriever = new TavilySearchAPIRetriever({
      apiKey: process.env.TAVILY_API_KEY!,
      k: 8,
      searchDepth: "advanced"
    });
  }

  // Add a method to switch models at runtime
  async switchModel(config: {
    useOllama: boolean;
    ollamaModel?: string;
    ollamaBaseUrl?: string;
  }) {
    if (config.useOllama) {
      this.model = new ChatOllama({
        baseUrl: config.ollamaBaseUrl || "http://localhost:11434",
        model: config.ollamaModel || "deepseek-r1:latest",
        temperature: 0.3,
      });

      this.embeddings = new OllamaEmbeddings({
        baseUrl: config.ollamaBaseUrl || "http://localhost:11434",
        model: config.ollamaModel || "deepseek-r1:latest",
      });
    } else {
      this.model = new ChatGoogleGenerativeAI({
        modelName: "gemini-1.5-pro",
        apiKey: process.env.GOOGLE_API_KEY!,
        temperature: 0.3,
        maxOutputTokens: 8192,
      });

      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY!,
        modelName: "embedding-001",
        
      });
    }

    // Reinitialize vector store with new embeddings
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    
    // Update web browser with new model and embeddings
    this.webBrowser = new WebBrowser({
      model: this.model,
      embeddings: this.embeddings
    });
  }

  async research(query: string) {
    // Declare relevantDocs at the top level of the function so it's available in the catch block
    let relevantDocs: Document[] = [];
    
    try {
      // Get and process documents
      const tavilyDocs = await this.tavilyRetriever.getRelevantDocuments(query);
      console.log(`Found ${tavilyDocs.length} documents from Tavily`);

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      // Create fresh vector store for each query
      this.vectorStore = new MemoryVectorStore(this.embeddings);

      // Process and store documents
      const splitDocs = await textSplitter.splitDocuments(tavilyDocs);
      await this.vectorStore.addDocuments(splitDocs);

      // Process web content
      const topUrls = tavilyDocs
        .map(doc => doc.metadata.source)
        .filter(url => url && url.startsWith('http'))
        .slice(0, 3);

      for (const url of topUrls) {
        try {
          const content = await this.webBrowser.call(url);
          const webDocs = await textSplitter.createDocuments([content]);
          await this.vectorStore.addDocuments(webDocs);
        } catch (error) {
          console.warn(`Failed to process URL: ${url}`, error);
        }
      }

      // Get most relevant content
      relevantDocs = await this.vectorStore.similaritySearch(query, 5);
      console.log('Retrieved most relevant content through RAG');

      // Instead of asking for a complex JSON structure in one go,
      // let's break it down into separate, simpler requests

      // 1. First, get a summary
      const summaryChain = RunnableSequence.from([
        {
          context: () => relevantDocs.map(doc => 
            `Source: ${doc.metadata.source || 'Unknown'}\nContent: ${doc.pageContent.substring(0, 500)}`
          ).join('\n---\n'),
          query: () => query
        },
        ChatPromptTemplate.fromTemplate(`
          You are an expert research analyst. Analyze this topic: {query}
          
          Here is the relevant research data:
          {context}
          
          Write a comprehensive summary of the topic in 2-3 paragraphs.
          Focus on key facts, current developments, and important context.
        `),
        this.model,
        new StringOutputParser(),
      ]);

      // Execute the summary chain and store the result
      const summaryResult = await summaryChain.invoke({});
      console.log("Generated research summary");

      // 2. Get key findings
      const findingsChain = RunnableSequence.from([
        {
          context: () => relevantDocs.map(doc => 
            `Source: ${doc.metadata.source || 'Unknown'}\nContent: ${doc.pageContent.substring(0, 500)}`
          ).join('\n---\n'),
          query: () => query
        },
        ChatPromptTemplate.fromTemplate(`
          You are an expert research analyst. Analyze this topic: {query}
          
          Here is the relevant research data:
          {context}
          
          Extract 3-5 key findings about this topic. For each finding, provide:
          1. A clear title
          2. A detailed explanation (2-3 sentences)
          3. The source URL if available
          
          Format as a simple JSON array like this:
          [
            {{
              "title": "Finding title",
              "content": "Detailed explanation",
              "source": "URL or reference",
              "relevance": "High"
            }}
          ]
        `),
        this.model,
        new StringOutputParser(),
      ]);

      // 3. For programming topics, get code examples
      const isProgrammingTopic = this.isProgrammingQuery(query);
      let codeExamples: CodeExample[] = [];
      
      if (isProgrammingTopic) {
        console.log("Programming topic detected, extracting code examples");
        
        // STEP 1: Direct code extraction from documents
        const documentCodeBlocks: CodeBlock[] = [];
        for (const doc of relevantDocs) {
          const blocks = this.extractCodeBlocks(doc.pageContent);
          if (blocks.length > 0) {
            documentCodeBlocks.push(...blocks);
          }
        }
        
        // STEP 2: Extract code from summary
        const summaryCodeBlocks = this.extractCodeBlocks(summaryResult);
        
        // STEP 3: Combine and format extracted code blocks
        const allExtractedBlocks = [...summaryCodeBlocks, ...documentCodeBlocks];
        
        if (allExtractedBlocks.length > 0) {
          // Convert blocks to examples with proper metadata
          const extractedExamples = allExtractedBlocks.map((block, index) => {
            // Determine source
            const source = index < summaryCodeBlocks.length 
              ? "Research summary" 
              : (relevantDocs[0]?.metadata?.source || "Research data");
            
            return {
              title: `Example ${index + 1}`,
              language: block.language || 'text',
              code: block.code,
              description: `Code example related to ${query}`,
              source
            };
          });
          
          // Add to our collection
          codeExamples = extractedExamples;
          console.log(`Extracted ${codeExamples.length} code examples directly from content`);
        }
        
        // STEP 4: If we need more examples or have none, generate them with the LLM
        if (codeExamples.length < 2) {
          try {
            console.log("Generating additional code examples with LLM");
            
            // Use a template approach instead of JSON to avoid parsing issues
            const codePrompt = `
              You are an expert programmer helping with: ${query}
              
              ${codeExamples.length > 0 
                ? "I need additional code examples beyond what I already have." 
                : "I need practical code examples that demonstrate this concept."}
              
              Please provide ${codeExamples.length > 0 ? "one more" : "two"} well-commented, working code example.
              
              For each example:
              1. Start with "EXAMPLE TITLE: " followed by a descriptive title
              2. Then "LANGUAGE: " followed by the programming language
              3. Then the code block with triple backticks
              4. End with "DESCRIPTION: " followed by an explanation
              
              Example format:
              
              EXAMPLE TITLE: Sorting an Array
              LANGUAGE: javascript
              \`\`\`javascript
              // Function to sort an array using quicksort
              function quickSort(arr) {
                  if (arr.length <= 1) return arr;
                  
                  const pivot = arr[0];
                  const left = [];
                  const right = [];
                  
                  for (let i = 1; i < arr.length; i++) {
                      if (arr[i] < pivot) left.push(arr[i]);
                      else right.push(arr[i]);
                  }
                  
                  return [...quickSort(left), pivot, ...quickSort(right)];
              }
              
              // Example usage
              const unsortedArray = [5, 3, 7, 1, 8, 2];
              console.log(quickSort(unsortedArray)); // [1, 2, 3, 5, 7, 8]
              \`\`\`
              DESCRIPTION: This example demonstrates how to implement a quicksort algorithm in JavaScript, which is an efficient sorting method with O(n log n) average time complexity.
            `;
            
            // Use a direct approach with the model
            const response = await this.model.invoke([
              { role: "system", content: "You are an expert programming assistant that provides clear, working code examples." },
              { role: "user", content: codePrompt }
            ]);
            
            // Extract code examples using regex patterns instead of JSON parsing
            const generatedExamples = this.extractCodeExamplesFromTemplate(response.content);
            
            if (generatedExamples.length > 0) {
              // Add the generated examples to our collection
              codeExamples = [...codeExamples, ...generatedExamples];
              console.log(`Generated ${generatedExamples.length} additional code examples`);
            }
          } catch (e: unknown) {
            const error = e as Error;
            console.warn('Error generating code examples:', error.message);
          }
        }
        
        // STEP 5: If we still don't have examples, use fallbacks
        if (codeExamples.length === 0) {
          console.log("Using fallback code examples");
          codeExamples = this.createFallbackCodeExamples(query);
        }
        
        // STEP 6: Ensure code examples are relevant to the query
        codeExamples = this.ensureCodeRelevance(codeExamples, query);
      }

      // 4. Get suggested questions
      const questionsChain = RunnableSequence.from([
        {
          query: () => query
        },
        ChatPromptTemplate.fromTemplate(`
          Based on this research topic: {query}
          
          Generate 3-5 natural follow-up questions that would help explore:
          - Deeper technical aspects
          - Comparative analysis
          - Future implications
          - Practical applications
          
          Return ONLY a JSON array of strings like this:
          ["Question 1?", "Question 2?", "Question 3?"]
        `),
        this.model,
        new StringOutputParser(),
      ]);

      // Execute all chains in parallel
      const [findingsResult, questionsResult] = await Promise.all([
        findingsChain.invoke({}),
        questionsChain.invoke({})
      ]);

      // Extract JSON from results
      const findings = this.extractJSON(findingsResult) || [];
      const suggestedQuestions = this.extractJSON(questionsResult) || [];

      // Extract statistics from the documents
      let statistics = [];
      // Use our custom statistics extraction directly
      statistics = this.extractStatistics(relevantDocs, query);
      console.log(`Extracted ${statistics.length} statistics from documents`);

      // Combine results into a single response
      return {
        summary: summaryResult,
        findings: Array.isArray(findings) ? findings : [],
        codeExamples: Array.isArray(codeExamples) ? codeExamples : [],
        suggestedQuestions: Array.isArray(suggestedQuestions) ? suggestedQuestions : [],
        statistics: statistics,
        metadata: {
          sourcesCount: relevantDocs.length,
          confidence: 0.9,
          researchDepth: "Comprehensive",
          lastUpdated: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Research error:', error);
      // Now relevantDocs is defined in the catch block
      return this.createEnhancedFallback(query, relevantDocs);
    }
  }

  private createEnhancedFallback(query: string, docs: Document[]): {
    summary: string;
    findings: Array<{
      title: string;
      content: string;
      source: string;
      relevance: string;
    }>;
    codeExamples: CodeExample[];
    suggestedQuestions: string[];
    metadata: {
      sourcesCount: number;
      confidence: number;
      researchDepth: string;
      lastUpdated: string;
    };
  } {
    // Extract useful information from docs
    const sources = docs.map(doc => doc.metadata.source).filter(Boolean);
    const uniqueSources = [...new Set(sources)];
    
    // Check if query is related to programming
    const programmingKeywords = ['code', 'algorithm', 'programming', 'function', 'class', 'javascript', 'python', 'java', 'c++', 'typescript'];
    const isProgrammingQuery = programmingKeywords.some(keyword => query.toLowerCase().includes(keyword));
    
    // Create basic code examples if it's a programming query
    const codeExamples = isProgrammingQuery ? [
      {
        title: "Basic Example",
        language: "python",
        code: "def example():\n    print('Hello World')\n\nexample()",
        description: "A simple example related to the query"
      }
    ] : [];
    
    // Create a basic summary from the documents
    let summaryText = `Research results for "${query}". `;
    
    if (docs.length > 0) {
      // Extract first paragraphs from top documents
      const topContent = docs.slice(0, 3).map(doc => 
        doc.pageContent.split('\n')[0].substring(0, 200)
      ).join(' ');
      
      summaryText += topContent;
    } else {
      summaryText += "Limited information was found on this topic.";
    }
    
    // Create findings from available documents
    const findings = docs.slice(0, 5).map((doc, index) => ({
      title: `Finding ${index + 1}`,
      content: doc.pageContent.substring(0, 300) + "...",
      source: doc.metadata.source || "Unknown source",
      relevance: index < 2 ? "High" : "Medium"
    }));
    
    return {
      summary: summaryText,
      findings: findings.length > 0 ? findings : [
        {
          title: "Basic Information",
          content: `Information about ${query} was processed but could not be properly formatted.`,
          source: "System",
          relevance: "Medium"
        }
      ],
      codeExamples: codeExamples,
      suggestedQuestions: [
        `What are the best practices for ${query}?`,
        `How does ${query} compare to alternatives?`,
        `What are recent developments in ${query}?`
      ],
      metadata: {
        sourcesCount: uniqueSources.length,
        confidence: 0.6,
        researchDepth: docs.length > 5 ? "Moderate" : "Basic",
        lastUpdated: new Date().toISOString()
      }
    };
  }

  private cleanResponse(text: string): string {
    try {
      // Find JSON content
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      
      if (start === -1 || end === 0) {
        throw new Error('No JSON found');
      }
      
      // Extract JSON content and clean it
      let cleaned = text.slice(start, end);

      // Log the initial cleaned content for debugging
      console.log('Initial cleaned content length:', cleaned.length);

      // Try a more aggressive approach to fix JSON
      try {
        // First attempt - try to parse as is
        return JSON.stringify(JSON.parse(cleaned));
      } catch  {
        console.log('Initial parse failed, trying more aggressive cleaning');
        
        // More aggressive cleaning
        cleaned = cleaned
          // Remove any markdown formatting
          .replace(/```json/g, '')
          .replace(/```/g, '')
          // Fix newlines and spaces
          .replace(/\r?\n/g, ' ')
          .replace(/\s+/g, ' ')
          // Fix common JSON syntax issues
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Quote unquoted keys
          .replace(/:\s*'([^']*)'/g, ':"$1"') // Replace single quotes with double quotes
          .replace(/:\s*([a-zA-Z0-9_]+)(\s*[,}])/g, ':"$1"$2') // Quote unquoted values
          .replace(/"\s*\+\s*"/g, '') // Fix concatenated strings
          .replace(/\\"/g, '\\"') // Fix escaped quotes
          .trim();

        try {
          // Second attempt - with aggressive cleaning
          return JSON.stringify(JSON.parse(cleaned));
        } catch  {
          console.log('Second parse failed, using fallback');
          
          // If all else fails, return a valid fallback response
          return JSON.stringify({
            summary: "Research analysis completed with formatting issues",
            findings: [
              {
                title: "Research Results Available",
                content: "The research was completed but there were issues with the formatting. The system has provided this fallback response.",
                source: "System",
                relevance: "High"
              }
            ],
            metadata: {
              sourcesCount: 0,
              confidence: 0.5,
              researchDepth: "basic",
              lastUpdated: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Clean response error:', error);
      // Return a basic valid JSON structure
      return JSON.stringify({
        summary: "Failed to process response",
        findings: [
          {
            title: "Processing Error",
            content: "There was an error processing your research query. Please try again with a more specific query.",
            source: "System",
            relevance: "High"
          }
        ],
        metadata: {
          sourcesCount: 0,
          confidence: 0,
          researchDepth: "minimal",
          lastUpdated: new Date().toISOString()
        }
      });
    }
  }

  private validateResearchResponse(response: unknown): boolean {
    if (!response || typeof response !== 'object') {
      console.warn('Response is not an object');
      return false;
    }
    
    // Type assertion after basic validation
    const typedResponse = response as {
      summary: string;
      findings: Array<{
        title: string;
        content: string;
        source: string;
        relevance: string;
      }>;
      metadata: {
        sourcesCount: number;
        confidence: number;
        researchDepth: string;
      };
      codeExamples?: Array<CodeExample>;
    };
    
    // Continue with existing validation using typedResponse
    if (!typedResponse.summary || !typedResponse.findings || !typedResponse.metadata) {
      console.warn('Missing required top-level fields');
      return false;
    }
    
    // Validate summary
    if (typeof typedResponse.summary !== 'string' || typedResponse.summary.length < 50) {
      console.warn('Invalid summary');
      return false;
    }

    // Validate findings
    if (!Array.isArray(typedResponse.findings) || typedResponse.findings.length === 0) {
      console.warn('Invalid findings array');
      return false;
    }

    // Check at least one finding has proper structure
    const hasValidFinding = typedResponse.findings.some((finding: {
      title: string;
      content: string;
      source: string;
      relevance: string;
    }) => 
      typeof finding.title === 'string' && 
      typeof finding.content === 'string' && 
      typeof finding.source === 'string' &&
      typeof finding.relevance === 'string'
    );

    if (!hasValidFinding) {
      console.warn('No valid findings');
      return false;
    }

    // Validate code examples if present
    if (typedResponse.codeExamples && Array.isArray(typedResponse.codeExamples)) {
      const hasValidCodeExamples = typedResponse.codeExamples.every(example => 
        typeof example.title === 'string' && 
        typeof example.language === 'string' && 
        typeof example.code === 'string' && 
        typeof example.description === 'string'
      );
      
      if (!hasValidCodeExamples) {
        console.warn('Invalid code examples');
        // Don't fail validation for this, just log warning
      }
    }

    // Validate metadata
    if (
      typeof typedResponse.metadata !== 'object' ||
      typeof typedResponse.metadata.sourcesCount !== 'number' ||
      typeof typedResponse.metadata.confidence !== 'number' ||
      typeof typedResponse.metadata.researchDepth !== 'string'
    ) {
      console.warn('Invalid metadata');
      return false;
    }

    return true;
  }

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

      // Perform search
      const searchResults = await this.research(query);

      // First, get relevant images
      const imageSearchResults = await this.research(`${query} relevant images diagrams infographics`);
      
      // Generate research response with a generic, comprehensive prompt
      const response = await this.model.invoke(
        `You are an expert research analyst. Provide a comprehensive analysis about: "${query}"
        
        Based on these search results: ${JSON.stringify(searchResults)}

        Important: Return a SINGLE-LINE JSON string with this structure:
        {
          "summary": {
            "overview": "Start with a comprehensive overview paragraph that introduces the topic and its significance",
            "currentState": "Provide a detailed paragraph about the current state of development, key players, and recent breakthroughs",
            "impact": "Explain the broader impact and implications in a well-structured paragraph",
            "futureOutlook": "Conclude with forward-looking insights and future developments in the field",
            "keyTakeaways": [
              "3-4 bullet points highlighting the most important takeaways",
              "Each point should be concise but informative"
            ]
          },
          "findings": [
            {
              "title": "Key Finding or Topic Area",
              "content": "Detailed explanation with specific facts, figures, and expert insights. Include real data points, research findings, and concrete examples",
              "source": "URL of authoritative source",
              "relevance": "High/Medium/Low",
              "credibility": 0.9,
              "type": "text",
              "category": "Choose relevant category (e.g., Technology, Research, Market Analysis, Scientific Finding, etc.)"
            }
          ],
          "keyInsights": [
            {
              "point": "Significant insight or trend",
              "explanation": "Detailed analysis of importance and implications",
              "supportingEvidence": [
                "Include specific data points",
                "Reference expert opinions",
                "Add relevant statistics",
                "Cite research findings"
              ]
            }
          ],
          "statistics": [
            {
              "value": "Specific numerical data",
              "metric": "What this number measures",
              "context": "Why this statistic is important",
              "source": "Source of the data"
            }
          ],
          "suggestedQuestions": [
            // Include 4-5 specific follow-up questions that would help explore:
            // - Deeper technical aspects
            // - Comparative analysis
            // - Future implications
            // - Practical applications
            // - Related developments
            // Make questions natural and contextual to the research
          ],
          "metadata": {
            "sourcesCount": Number of unique sources used,
            "confidence": Confidence score between 0 and 1,
            "researchDepth": "comprehensive",
            "lastUpdated": "${new Date().toISOString()}"
          }
        }

        Guidelines:
        1. Focus on factual, verifiable information
        2. Include diverse perspectives and sources
        3. Provide specific examples and case studies
        4. Add relevant statistics and data points
        5. Cite authoritative sources
        6. Cover recent developments and future implications
        7. Maintain objectivity in analysis`
      );

      // Clean and parse the response
      let cleanedResponse = response.content as string;
      
      // Remove any markdown code blocks
      if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```json\n|```/g, '');
      }

      // Sanitize the JSON string
      cleanedResponse = sanitizeJsonString(cleanedResponse);

      try {
        // Parse the cleaned response
        const research = JSON.parse(cleanedResponse);

        // Add relevant images
        if (imageSearchResults && Array.isArray(imageSearchResults)) {
          const relevantImages = imageSearchResults
            .filter(item => 
              item.url && 
              (item.url.match(/\.(jpg|jpeg|png|gif)$/i) || 
               item.url.includes('images') ||
               item.url.includes('media'))
            )
            .slice(0, 5)
            .map(item => ({
              type: "image",
              url: item.url,
              caption: sanitizeJsonString(item.title || "Related visual content"),
              source: item.source || item.url
            }));

          research.visualData = research.visualData || [];
          research.visualData.push(...relevantImages);
        }

        // Update API usage
        await supabase
          .from('api_keys')
          .update({ 
            usage: (keyData.usage || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', keyData.id);

        // Then in the sanitization, combine the summary sections
        if (research.summary && typeof research.summary === 'object') {
          research.summary = [
            research.summary.overview,
            research.summary.currentState,
            research.summary.impact,
            research.summary.futureOutlook,
            '',
            'Key Takeaways:',
            ...research.summary.keyTakeaways.map((point: string) => `• ${point}`)
          ].join('\n\n');
        }

        return NextResponse.json({ research });

      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.log('Raw Response:', cleanedResponse);
        
        // Return a more structured error response
        return NextResponse.json({
          message: 'Failed to parse research results',
          error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          rawResponse: cleanedResponse.slice(0, 200) + '...' // First 200 chars for debugging
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Research error:', error);
      return NextResponse.json(
        { message: 'Research failed', error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Improve the extractJSON method to handle malformed JSON
  private extractJSON(text: string): unknown[] {
    try {
      // First try to parse the entire text as JSON
      try {
        return JSON.parse(text) as unknown[];
      } catch {
        // Not valid JSON, continue with extraction
      }

      // Look for JSON array or object patterns
      const jsonRegex = /(\[[\s\S]*\]|\{[\s\S]*\})/g;
      const matches = text.match(jsonRegex);
      
      if (matches && matches.length > 0) {
        // Try each potential JSON match
        for (const match of matches) {
          try {
            // Clean the JSON string before parsing
            const cleanedJson = this.cleanJsonString(match);
            const parsed = JSON.parse(cleanedJson);
            return parsed;
          } catch (e: unknown) {
            const error = e as Error;
            console.log(`Failed to parse potential JSON match: ${error.message}`);
          }
        }
      }
      
      // If we reach here, try to extract JSON between markers
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']') + 1;
      
      if (start !== -1 && end !== -1 && start < end) {
        try {
          const jsonStr = text.substring(start, end);
          const cleanedJson = this.cleanJsonString(jsonStr);
          const parsed = JSON.parse(cleanedJson);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e: unknown) {
          const error = e as Error;
          console.log(`Failed to parse JSON between brackets: ${error.message}`);
        }
      }
      
      // Try with curly braces if brackets didn't work
      const objStart = text.indexOf('{');
      const objEnd = text.lastIndexOf('}') + 1;
      
      if (objStart !== -1 && objEnd !== -1 && objStart < objEnd) {
        try {
          const jsonStr = text.substring(objStart, objEnd);
          const cleanedJson = this.cleanJsonString(jsonStr);
          const parsed = JSON.parse(cleanedJson);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e: unknown) {
          const error = e as Error;
          console.log(`Failed to parse JSON between braces: ${error.message}`);
        }
      }
      
      // If all else fails, return an empty array
      console.log("Could not extract valid JSON, returning empty array");
      return [];
    } catch (error) {
      console.error("Error in extractJSON:", error);
      return [];
    }
  }

  // Improve the cleanJsonString method to handle more edge cases
  private cleanJsonString(str: string): string {
    try {
      // First, check if we're dealing with code blocks inside JSON
      // This is a common issue when the model includes code examples
      str = str.replace(/```[a-z]*\n([\s\S]*?)```/g, function(match, codeContent) {
        // Escape the code content properly for JSON
        return JSON.stringify(codeContent);
      });
      
      // Handle triple quotes in a similar way
      str = str.replace(/'''[a-z]*\n?([\s\S]*?)'''/g, function(match, codeContent) {
        return JSON.stringify(codeContent);
      });
      
      // Remove any trailing commas in arrays or objects
      str = str.replace(/,\s*([\]}])/g, '$1');
      
      // Fix unquoted property names
      str = str.replace(/(\{|\,)\s*([a-zA-Z0-9_]+)\s*\:/g, '$1"$2":');
      
      // Fix single quotes to double quotes, but be careful with already escaped quotes
      str = str.replace(/(\w+)\'(\w+)/g, '$1\\\'$2'); // Escape any apostrophes in words first
      str = str.replace(/'/g, '"');
      
      // Remove any control characters
      str = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      
      // Fix any missing quotes around string values
      str = str.replace(/:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*(,|})/g, ':"$1"$2');
      
      // Fix common issues with code examples in JSON
      str = str.replace(/"code"\s*:\s*"([^"]*?)\\n/g, '"code": "');
      
      // Handle nested quotes in descriptions or other text fields
      str = str.replace(/"([^"]*?)\"([^"]*?)\"([^"]*?)"/g, '"$1\\\"$2\\\"$3"');
      
      // Fix issues with backslashes in code
      str = str.replace(/\\\\/g, '\\\\\\\\');
      
      // Try to validate and fix the JSON structure
      try {
        // If it's valid JSON already, just return it
        JSON.parse(str);
        return str;
      } catch  {
        // If not valid, try more aggressive fixes
        
        // Check for unclosed brackets or braces
        const openBrackets = (str.match(/\[/g) || []).length;
        const closeBrackets = (str.match(/\]/g) || []).length;
        const openBraces = (str.match(/\{/g) || []).length;
        const closeBraces = (str.match(/\}/g) || []).length;
        
        // Add missing closing brackets/braces
        if (openBrackets > closeBrackets) {
          str += ']'.repeat(openBrackets - closeBrackets);
        }
        
        if (openBraces > closeBraces) {
          str += '}'.repeat(openBraces - closeBraces);
        }
        
        // Try to parse again after fixes
        try {
          JSON.parse(str);
          return str;
        } catch  {
          // If still not valid, log the issue and return the best we can
          console.log("Could not fix JSON structure:");
          return str;
        }
      }
    } catch (e) {
      console.error("Error cleaning JSON string:", e);
      return str; // Return original if cleaning fails
    }
  }

  // Helper to check if query is programming-related
  private isProgrammingQuery(query: string): boolean {
    const programmingKeywords = [
      'code', 'algorithm', 'programming', 'function', 'class', 
      'javascript', 'python', 'java', 'c++', 'typescript',
      'implementation', 'coding', 'software', 'developer'
    ];
    return programmingKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
  }

  // Create fallback code examples
  private createFallbackCodeExamples(query: string): CodeExample[] {
    // Determine likely language based on query
    let language = 'python';
    if (query.toLowerCase().includes('javascript') || query.toLowerCase().includes('js')) {
      language = 'javascript';
    } else if (query.toLowerCase().includes('python')) {
      language = 'python';
    }
    
    if (language === 'python') {
      return [{
        title: "Basic Implementation",
        language: "python",
        code: "def example():\n    # This demonstrates the concept\n    print('Implementation example')\n\nexample()",
        description: "A simple Python implementation related to the query"
      }];
    } else {
      return [{
        title: "Basic Implementation",
        language: "javascript",
        code: "function example() {\n    // This demonstrates the concept\n    console.log('Implementation example');\n}\n\nexample();",
        description: "A simple JavaScript implementation related to the query"
      }];
    }
  }

  // Add a method to extract code blocks from text content
  private extractCodeBlocks(text: string): CodeBlock[] {
    if (!text) return [];
    
    const codeBlocks: CodeBlock[] = [];
    
    try {
      // Match code blocks with triple backticks
      const tripleBacktickRegex = /```(?:(\w+)\s*)?\n?([\s\S]*?)```/g;
      let match;
      
      while ((match = tripleBacktickRegex.exec(text)) !== null) {
        const language = match[1]?.trim() || 'text';
        const code = match[2]?.trim();
        if (code && code.length > 0) {
          codeBlocks.push({ language, code });
        }
      }
      
      // Match code blocks with triple quotes
      const tripleQuoteRegex = /'''(?:(\w+)\s*)?\n?([\s\S]*?)'''/g;
      while ((match = tripleQuoteRegex.exec(text)) !== null) {
        const language = match[1]?.trim() || 'text';
        const code = match[2]?.trim();
        if (code && code.length > 0) {
          codeBlocks.push({ language, code });
        }
      }
      
      // Match language-specific patterns
      const languagePatterns = [
        // Python function or class definition
        { regex: /\b(def|class)\s+\w+[\s\(][^{]*?:/g, language: 'python' },
        // JavaScript/TypeScript function or class
        { regex: /\b(function|class|const|let|var)\s+\w+[\s\=\(][^{]*?\{/g, language: 'javascript' },
        // Java/C# class or method
        { regex: /\b(public|private|protected|class)\s+\w+[\s\<\(][^{]*?\{/g, language: 'java' }
      ];
      
      for (const pattern of languagePatterns) {
        const codeRegex = new RegExp(`(${pattern.regex.source}[\\s\\S]{20,500}?)(?=\\n\\n|$)`, 'g');
        while ((match = codeRegex.exec(text)) !== null) {
          const code = match[1]?.trim();
          if (code && code.length > 30 && code.includes('\n')) {
            codeBlocks.push({ language: pattern.language, code });
          }
        }
      }
      
      // Detect language from content if not specified
      return codeBlocks.map(block => {
        if (!block.language || block.language === 'text') {
          block.language = this.detectLanguage(block.code);
        }
        return block;
      });
    } catch (error) {
      console.error("Error extracting code blocks:", error);
      return [];
    }
  }

  // Helper to detect programming language from code content
  private detectLanguage(code: string): string {
    // Simple language detection based on keywords and syntax
    if (code.includes('import numpy') || code.includes('import pandas') || 
        code.includes('def ') || code.includes('print(')) {
      return 'python';
    } else if (code.includes('function') || code.includes('const ') || 
              code.includes('let ') || code.includes('var ') || 
              code.includes('console.log')) {
      return 'javascript';
    } else if (code.includes('public class') || code.includes('System.out.println')) {
      return 'java';
    } else if (code.includes('#include') || code.includes('int main')) {
      return 'cpp';
    } else if (code.includes('<?php')) {
      return 'php';
    } else if (code.includes('<html>') || code.includes('<div>')) {
      return 'html';
    } else if (code.includes('SELECT') && code.includes('FROM')) {
      return 'sql';
    }
    
    return 'text';
  }

  // Enhance the research agent to extract statistics from the research data
  private extractStatistics(docs: Document[], query: string): Array<{
    value: string;
    metric: string;
    context: string;
    source: string;
  }> {
    const statistics = [];
    
    // Regular expressions to find numerical data
    const numberRegex = /\b\d+(\.\d+)?\s*(%|percent|million|billion|trillion|thousand|k|m|b|t)?\b/gi;
    const dateRegex = /\b(19|20)\d{2}\b/g; // Years like 1990, 2023
    
    // Keywords that might indicate important statistics
    const statKeywords = [
      'rate', 'percentage', 'average', 'median', 'total', 'growth', 
      'increase', 'decrease', 'revenue', 'users', 'population', 'market share'
    ];
    
    // Process each document
    for (const doc of docs) {
      const content = doc.pageContent;
      const source = doc.metadata.source || 'Research data';
      
      // Find sentences containing numbers
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      for (const sentence of sentences) {
        // Check if sentence contains numbers
        const hasNumber = numberRegex.test(sentence) || dateRegex.test(sentence);
        
        if (hasNumber) {
          // Reset regex lastIndex
          numberRegex.lastIndex = 0;
          
          // Check if sentence is relevant to the query
          const isRelevant = query.toLowerCase().split(' ').some(word => 
            word.length > 3 && sentence.toLowerCase().includes(word)
          );
          
          // Check if sentence contains statistical keywords
          const hasStatKeyword = statKeywords.some(keyword => 
            sentence.toLowerCase().includes(keyword)
          );
          
          if (isRelevant || hasStatKeyword) {
            // Extract the number
            numberRegex.lastIndex = 0;
            const match = numberRegex.exec(sentence);
            
            if (match) {
              const value = match[0];
              
              // Try to determine what this statistic measures
              const words = sentence.split(' ');
              const valueIndex = words.findIndex(w => w.includes(value));
              
              // Look for context words after the number
              let metric = '';
              if (valueIndex >= 0 && valueIndex < words.length - 1) {
                metric = words.slice(valueIndex + 1, valueIndex + 4).join(' ');
              }
              
              // If no context found after, look before
              if (!metric && valueIndex > 0) {
                metric = words.slice(Math.max(0, valueIndex - 3), valueIndex).join(' ');
              }
              
              statistics.push({
                value,
                metric: metric || 'measurement',
                context: sentence.trim(),
                source
              });
              
              // Limit to 10 statistics
              if (statistics.length >= 10) break;
            }
          }
        }
      }
    }
    
    return statistics;
  }

  // Add a new method to extract code examples directly from the model's response
  private extractCodeExamplesFromResponse(text: string): CodeExample[] {
    try {
      // First try to extract code blocks
      const codeBlocks = this.extractCodeBlocks(text);
      
      if (codeBlocks.length > 0) {
        // Convert code blocks to code examples
        return codeBlocks.map((block, index) => ({
          title: `Example ${index + 1}`,
          language: block.language,
          code: block.code,
          description: `Code example extracted from research data`,
          source: "Research data"
        }));
      }
      
      // If no code blocks found, try to extract from JSON-like structures
      const jsonMatches = text.match(/\{[\s\S]*?\}/g) || [];
      
      for (const match of jsonMatches) {
        try {
          const cleaned = this.cleanJsonString(match);
          const parsed = JSON.parse(cleaned);
          
          if (parsed.code && parsed.language) {
            return [{
              title: parsed.title || "Code Example",
              language: parsed.language,
              code: parsed.code,
              description: parsed.description || "Extracted code example",
              source: parsed.source || "Research data"
            }];
          }
        } catch  {
          // Continue to next match
        }
      }
      
      return [];
    } catch (e) {
      console.error("Error extracting code examples from response:", e);
      return [];
    }
  }

  // Update the method to handle different content types
  private extractCodeExamplesFromTemplate(content: string | MessageContent): CodeExample[] {
    // Convert content to string if it's not already
    const text = typeof content === 'string' 
      ? content 
      : Array.isArray(content) 
        ? content.map(item => {
            if (typeof item === 'string') return item;
            return (item as TextContent).text || (item as TextContent).content || '';
          }).join('\n')
        : ((content as TextContent)?.text || (content as TextContent)?.content || '');
    
    const examples: CodeExample[] = [];
    
    // Pattern to match the template format
    const examplePattern = /EXAMPLE TITLE:\s*(.+?)\s*LANGUAGE:\s*(.+?)\s*```([\s\S]+?)```\s*DESCRIPTION:\s*(.+?)(?=EXAMPLE TITLE:|$)/gi;
    
    let match;
    while ((match = examplePattern.exec(text)) !== null) {
      try {
        const title = match[1]?.trim() || "Code Example";
        const languageDeclaration = match[2]?.trim() || "text";
        const codeBlock = match[3];
        const description = match[4]?.trim() || "Code example";
        
        // Extract the actual code and language
        const codeLines = codeBlock.split('\n');
        let language = languageDeclaration;
        let code = codeBlock;
        
        // If the first line has a language specifier, extract it
        if (codeLines[0].trim().match(/^[a-zA-Z0-9_]+$/)) {
          language = codeLines[0].trim();
          code = codeLines.slice(1).join('\n').trim();
        }
        
        examples.push({
          title,
          language,
          code,
          description,
          source: "Generated example"
        });
      } catch (error) {
        console.warn("Error parsing code example template:", error);
      }
    }
    
    // If the template pattern didn't work, fall back to code block extraction
    if (examples.length === 0) {
      const codeBlocks = this.extractCodeBlocks(text);
      
      if (codeBlocks.length > 0) {
        return codeBlocks.map((block, index) => ({
          title: `Generated Example ${index + 1}`,
          language: block.language,
          code: block.code,
          description: "Generated code example",
          source: "Generated example"
        }));
      }
    }
    
    return examples;
  }

  // Add this method to ensure code examples are relevant to the query
  private ensureCodeRelevance(examples: CodeExample[], query: string): CodeExample[] {
    // Extract key terms from the query
    const queryTerms = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(term => term.length > 3 && !['what', 'how', 'when', 'where', 'which', 'code', 'example'].includes(term));
    
    if (queryTerms.length === 0) {
      return examples; // No meaningful terms to filter by
    }
    
    // Score examples by relevance
    const scoredExamples = examples.map(example => {
      const combinedText = `${example.title} ${example.description} ${example.code}`.toLowerCase();
      
      // Count how many query terms appear in the example
      const matchCount = queryTerms.filter(term => combinedText.includes(term)).length;
      
      // Calculate a relevance score (0-1)
      const relevanceScore = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
      
      return {
        example,
        relevanceScore
      };
    });
    
    // Sort by relevance score
    scoredExamples.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Take the top 3 most relevant examples
    return scoredExamples.slice(0, 3).map(item => item.example);
  }
} 