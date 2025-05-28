import { Document } from "langchain/document";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { CodeExample } from './types';
// import { SearchUtils } from './search-utils';

/**
 * Code processing utilities for extracting and generating code examples
 */
export class CodeProcessor {
  // Enhanced code examples extraction with timeout protection
  static async extractEnhancedCodeExamples(
    documents: Document[], 
    query: string, 
    model: BaseChatModel
  ): Promise<CodeExample[]> {
    try {
      console.log('Starting code examples extraction...');
      
      // Add timeout protection
      const timeoutPromise = new Promise<CodeExample[]>((_, reject) => {
        setTimeout(() => reject(new Error('Code extraction timeout')), 10000); // 10 second timeout
      });

      const extractionPromise = this.performCodeExtraction(documents, query, model);
      
      const result = await Promise.race([extractionPromise, timeoutPromise]);
      console.log(`Code extraction completed with ${result.length} examples`);
      return result;
    } catch (error) {
      console.error('Error extracting enhanced code examples:', error);
      return this.createFallbackCodeExamples(query);
    }
  }

  private static async performCodeExtraction(
    documents: Document[], 
    query: string, 
    model: BaseChatModel
  ): Promise<CodeExample[]> {
    // First extract existing code blocks
    const directExamples = this.extractDirectCodeBlocks(documents);
    
    if (directExamples.length >= 2) {
      console.log(`Found ${directExamples.length} direct code examples`);
      return directExamples.slice(0, 3);
    }
    
    // Generate additional examples if needed (with timeout)
    console.log('Generating contextual code examples...');
    const generatedExamples = await this.generateContextualCodeExamples(query, documents, model);
    
    return [...directExamples, ...generatedExamples].slice(0, 3);
  }

  // Extract direct code blocks from documents
  static extractDirectCodeBlocks(documents: Document[]): CodeExample[] {
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
  static isValidCode(code: string, language: string): boolean {
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
  static async generateContextualCodeExamples(
    query: string, 
    documents: Document[], 
    model: BaseChatModel
  ): Promise<CodeExample[]> {
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
      const response = await model.invoke(codePrompt);
      const responseText = response.content.toString();
      
      return this.parseGeneratedCodeExample(responseText, language);
    } catch (error) {
      console.error('Error generating contextual code examples:', error);
      return [];
    }
  }

  // Parse generated code example
  static parseGeneratedCodeExample(text: string, language: string): CodeExample[] {
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

  // Detect programming language from query
  static detectLanguageFromQuery(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('python') || queryLower.includes('django') || queryLower.includes('flask')) {
      return 'python';
    } else if (queryLower.includes('javascript') || queryLower.includes('js') || queryLower.includes('node')) {
      return 'javascript';
    } else if (queryLower.includes('java') || queryLower.includes('spring')) {
      return 'java';
    } else if (queryLower.includes('typescript') || queryLower.includes('ts')) {
      return 'typescript';
    } else if (queryLower.includes('react') || queryLower.includes('vue') || queryLower.includes('angular')) {
      return 'javascript';
    } else {
      return 'python'; // Default
    }
  }

  // Create fallback code examples
  static createFallbackCodeExamples(query: string): CodeExample[] {
    const language = this.detectLanguageFromQuery(query);
    return [{
      title: `Basic ${language} Example`,
      language: language,
      code: this.generateFallbackCode(query, language),
      description: `A simple example demonstrating concepts related to ${query}`,
      source: 'Generated example'
    }];
  }

  // Generate fallback code
  static generateFallbackCode(query: string, language: string): string {
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
} 