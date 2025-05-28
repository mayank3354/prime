import { Document } from "langchain/document";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { RAGResponse } from './academic-types';
import { ResearchStatus, StatusCallback } from '@/types/research';

/**
 * Academic RAG (Retrieval-Augmented Generation) analysis utilities
 */
export class AcademicRAGAnalyzer {
  private statusCallback?: StatusCallback;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback;
  }

  private updateStatus(status: ResearchStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  async performRAGSearch(
    query: string, 
    vectorStore: SupabaseVectorStore, 
    model: ChatGoogleGenerativeAI
  ): Promise<RAGResponse> {
    try {
      this.updateStatus({
        stage: 'analyzing',
        message: 'Performing RAG analysis on research data...',
        progress: { current: 4, total: 5 }
      });

      const relevantDocs = await vectorStore.similaritySearch(query, 10);
      
      if (relevantDocs.length === 0) {
        return this.getFallbackResponse("No relevant documents found in vector store.");
      }

      // Enhanced prompt for better structured output
      const prompt = this.createEnhancedPrompt(query, relevantDocs);
      
      const response = await model.invoke(prompt);
      
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

  private extractCodeExamples(text: string): Array<{
    title: string;
    language: 'python' | 'javascript' | 'typescript' | string;
    code: string;
    description: string;
    source: string;
  }> {
    const codeExamples: Array<{
      title: string;
      language: 'python' | 'javascript' | 'typescript' | string;
      code: string;
      description: string;
      source: string;
    }> = [];
    
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

  /**
   * Generate contextual questions based on analysis
   */
  static generateContextualQuestions(baseQuestions: string[], query: string): string[] {
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

  /**
   * Calculate confidence score based on RAG results
   */
  static calculateConfidenceScore(ragResults: RAGResponse, paperCount: number): number {
    let confidence = 0.5;
    
    // Boost for number of papers
    confidence += Math.min(paperCount * 0.1, 0.3);
    
    // Boost for quality indicators
    if (ragResults.statistics.length > 0) confidence += 0.1;
    if (ragResults.codeExamples.length > 0) confidence += 0.1;
    if (ragResults.analysis.length > 500) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
} 