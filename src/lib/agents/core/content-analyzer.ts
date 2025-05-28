import { Document } from "langchain/document";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Finding, Statistic } from './types';

/**
 * Content analysis utilities for extracting insights from research documents
 */
export class ContentAnalyzer {
  // Enhanced summary generation with timeout protection
  static async generateEnhancedSummary(
    query: string, 
    documents: Document[], 
    model: BaseChatModel
  ): Promise<string> {
    try {
      console.log('Generating enhanced summary...');
      
      // Add timeout protection
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Summary generation timeout')), 8000); // 8 second timeout
      });

      const summaryPromise = this.performSummaryGeneration(query, documents, model);
      
      const result = await Promise.race([summaryPromise, timeoutPromise]);
      console.log('Summary generation completed');
      return result;
    } catch (error) {
      console.error("Error generating enhanced summary:", error);
      return `Research analysis for "${query}" encountered processing issues. The topic appears to be related to ${query} based on available sources.`;
    }
  }

  private static async performSummaryGeneration(
    query: string, 
    documents: Document[], 
    model: BaseChatModel
  ): Promise<string> {
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
      model,
      new StringOutputParser(),
    ]);

    return await summaryChain.invoke({});
  }

  // Enhanced findings extraction with timeout protection
  static async extractEnhancedFindings(
    documents: Document[], 
    query: string, 
    model: BaseChatModel
  ): Promise<Finding[]> {
    try {
      console.log('Extracting enhanced findings...');
      
      // Add timeout protection
      const timeoutPromise = new Promise<Finding[]>((_, reject) => {
        setTimeout(() => reject(new Error('Findings extraction timeout')), 10000); // 10 second timeout
      });

      const findingsPromise = this.performFindingsExtraction(documents, query, model);
      
      const result = await Promise.race([findingsPromise, timeoutPromise]);
      console.log(`Findings extraction completed with ${result.length} findings`);
      return result;
    } catch (error) {
      console.error("Error extracting enhanced findings:", error);
      return this.createFallbackFindings(query);
    }
  }

  private static async performFindingsExtraction(
    documents: Document[], 
    query: string, 
    model: BaseChatModel
  ): Promise<Finding[]> {
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
    
    const response = await model.invoke(findingsPrompt);
    const responseText = typeof response === 'string' ? response : response.content.toString();
    
    return this.parseStructuredFindings(responseText);
  }

  // Parse structured findings
  static parseStructuredFindings(text: string): Finding[] {
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

  // Generate contextual questions
  static async generateContextualQuestions(
    query: string, 
    documents: Document[], 
    model: BaseChatModel
  ): Promise<string[]> {
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
      
      const response = await model.invoke(questionsPrompt);
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
  static async extractValidatedStatistics(
    documents: Document[], 
    query: string, 
    model: BaseChatModel
  ): Promise<Statistic[]> {
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
      
      const response = await model.invoke(statsPrompt);
      const responseText = response.content.toString();
      
      return this.parseStructuredStatistics(responseText);
    } catch (error) {
      console.error("Error extracting validated statistics:", error);
      return [];
    }
  }

  // Parse structured statistics
  static parseStructuredStatistics(text: string): Statistic[] {
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
  static isValidStatistic(value: string): boolean {
    // Check if value contains numbers and reasonable units
    const hasNumber = /\d/.test(value);
    const hasReasonableLength = value.length < 100;
    const notJustText = !/^[a-zA-Z\s]+$/.test(value);
    
    return hasNumber && hasReasonableLength && notJustText;
  }

  // Helper methods for fallbacks
  static createFallbackFindings(query: string): Finding[] {
    return [{
      title: "Research Topic Overview",
      content: `This research focuses on ${query} and related concepts. The analysis covers current developments and key aspects of this topic.`,
      source: "Research analysis",
      relevance: "High",
      type: "Overview",
      category: "General"
    }];
  }

  static createFallbackQuestions(query: string): string[] {
    return [
      `What are the key components of ${query}?`,
      `How can ${query} be implemented effectively?`,
      `What are the best practices for ${query}?`,
      `What are the latest developments in ${query}?`,
      `How does ${query} compare to alternative approaches?`
    ];
  }
} 