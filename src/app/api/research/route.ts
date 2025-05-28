import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ResearchAgent, FastResearchAgent } from '@/lib/agents/langchain-agent';
import { AcademicResearchAgent } from '@/lib/agents/academic-research-agent';
import { ResearchStatus } from '@/types/research';

// Import the types from the new modular structure
// import type { 
//   ResearchResult as ModularResearchResult
// } from '@/lib/agents/core/types';

// Define proper interfaces for the data structures
interface Finding {
  title?: string;
  content?: string;
  source?: string;
  relevance?: string;
  type?: string;
  category?: string;
}

interface Statistic {
  metric?: string;
  value?: string;
  context?: string;
  source?: string;
}

interface CodeExample {
  title?: string;
  language?: string;
  code?: string;
  description?: string;
  source?: string;
}

interface ResearchData {
  summary?: string;
  findings?: Finding[];
  statistics?: Statistic[];
  codeExamples?: CodeExample[];
  suggestedQuestions?: string[];
  metadata?: {
    sourcesCount?: number;
    confidence?: number;
    researchDepth?: string;
    lastUpdated?: string;
    searchQueries?: number;
    qualityScore?: number;
  };
}

export async function POST(request: Request) {
  console.log('=== API Route Started ===');

  try {
    // **NEW: API Key Validation and Usage Tracking**
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      console.log('❌ No API key provided');
      return NextResponse.json(
        { message: 'API key is required' },
        { status: 401 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    
    // Validate API key and get current usage
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, usage, monthly_limit, is_monthly_limit, user_id')
      .eq('key', apiKey)
      .single();

    if (keyError || !keyData) {
      console.log('❌ Invalid API key:', keyError?.message);
      return NextResponse.json(
        { message: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check usage limits
    if (keyData.is_monthly_limit && keyData.usage >= keyData.monthly_limit) {
      console.log('❌ Monthly API limit exceeded:', keyData.usage, '>=', keyData.monthly_limit);
      return NextResponse.json(
        { message: 'Monthly API limit exceeded' },
        { status: 429 }
      );
    }

    console.log('✅ API key validated. Current usage:', keyData.usage, '/', keyData.monthly_limit);

    console.log('=== Parsing request body ===');
    const { query, researchType = 'general', mode = 'standard' } = await request.json();
    console.log('Request parsed:', { query, researchType, mode });
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log('Invalid query provided');
      return Response.json({ error: 'Query is required and must be a non-empty string' }, { status: 400 });
    }

    // **NEW: Increment API usage immediately**
    const newUsage = (keyData.usage || 0) + 1;
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ 
        usage: newUsage,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyData.id);

    if (updateError) {
      console.error('⚠️ Failed to update API key usage:', updateError);
      // Continue with request even if usage update fails
    } else {
      console.log('✅ API usage updated:', newUsage, '/', keyData.monthly_limit);
    }

    // Create a readable stream that actually works
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const writeJSON = (data: Record<string, unknown>) => {
          try {
            console.log('Writing JSON:', Object.keys(data));
            const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
              if (value === undefined) return null;
              return value;
            }));
            
            const jsonString = JSON.stringify(sanitizedData);
            controller.enqueue(encoder.encode(jsonString + '\n'));
            console.log('JSON written successfully');
          } catch (e) {
            console.error('Error stringifying JSON:', e);
            controller.enqueue(encoder.encode(JSON.stringify({ error: 'Error formatting response' }) + '\n'));
          }
        };

        const writeStatus = (status: ResearchStatus) => {
          console.log('Writing status:', status.stage, status.message);
          writeJSON({ status });
        };

        try {
          // Send immediate test response
          writeJSON({ 
            test: 'API connection working',
            timestamp: new Date().toISOString()
          });

          // Initialize research agent based on type
          let research: ResearchData | null = null;
          
          // Create a custom callback to stream progress updates
          const statusCallback = (status: ResearchStatus) => {
            console.log('Status callback received:', status);
            writeStatus(status);
          };
          
          console.log('=== Starting research process ===');
          writeStatus({
            stage: 'searching',
            message: 'Initializing research...',
            progress: { current: 0, total: 5 }
          });

          console.log('=== Selecting research agent ===');
          if (researchType === 'academic') {
            console.log('Using AcademicResearchAgent');
            const academicAgent = new AcademicResearchAgent(statusCallback);
            const academicResult = await academicAgent.research(query);
            research = academicResult || null;
          } else {
            if (mode === 'quick') {
              console.log('Using FastResearchAgent for quick mode');
              const fastAgent = new FastResearchAgent();
              const fastResult = await fastAgent.researchWithStreaming(query, statusCallback);
              research = fastResult || null;
            } else {
              console.log('Using ResearchAgent for standard mode');
              const generalAgent = new ResearchAgent();
              const generalResult = await generalAgent.researchWithStreaming(query, statusCallback);
              research = generalResult || null;
            }
          }
          
          console.log('=== Research agent completed ===');
          if (!research) {
            console.error('Research agent returned null');
            throw new Error('Research agent failed to return results');
          }

          console.log('Research completed, processing results...');
          console.log('Research keys:', Object.keys(research));
          
          // Convert modular results to expected format
          const processedResult = {
            summary: research.summary || 'Research completed successfully.',
            findings: (research.findings || []).map((finding: Finding, index: number) => ({
              id: String(finding.title || `finding-${index}`),
              title: String(finding.title || `Finding ${index + 1}`),
              content: String(finding.content || 'No content available'),
              source: String(finding.source || 'Unknown source'),
              relevance: String(finding.relevance || 'Medium'),
              credibility: 0.8,
              type: String(finding.type || 'general'),
              category: String(finding.category || 'Research'),
              publishedDate: '',
              authors: [],
              tags: []
            })),
            keyInsights: (research.findings || []).slice(0, 3).map((finding: Finding, index: number) => ({
              id: `insight-${index}`,
              point: String(finding.title || `Key Point ${index + 1}`),
              explanation: String(finding.content || 'No explanation available'),
              supportingEvidence: [],
              confidence: 0.7,
              category: String(finding.category || 'General')
            })),
            statistics: (research.statistics || []).map((stat: Statistic, index: number) => ({
              id: String(stat.metric || `stat-${index}`),
              metric: String(stat.metric || 'Unknown Metric'),
              value: String(stat.value || 'N/A'),
              context: String(stat.context || 'No context provided'),
              source: String(stat.source || 'Research data'),
              unit: '',
              trend: 'stable',
              lastUpdated: new Date().toISOString()
            })),
            codeExamples: (research.codeExamples || []).map((example: CodeExample, index: number) => ({
              id: String(example.title || `code-${index}`),
              title: String(example.title || `Code Example ${index + 1}`),
              language: String(example.language || 'text'),
              code: String(example.code || '// No code available'),
              description: String(example.description || 'No description available'),
              source: String(example.source || 'Research data'),
              complexity: 'medium',
              tags: [],
              lastUpdated: new Date().toISOString()
            })),
            suggestedQuestions: (research.suggestedQuestions || []).map((question: string, index: number) => ({
              id: `question-${index}`,
              question: String(question),
              category: 'general',
              priority: 0.5
            })),
            metadata: {
              sourcesCount: research.metadata?.sourcesCount || 0,
              confidence: research.metadata?.confidence || 0.5,
              researchDepth: research.metadata?.researchDepth || 'Standard',
              lastUpdated: research.metadata?.lastUpdated || new Date().toISOString(),
              searchQueries: research.metadata?.searchQueries || 1,
              qualityScore: research.metadata?.qualityScore || 0.5,
              researchType: researchType,
              processingTime: 0,
              errorCount: 0
            }
          };

          console.log('Processed result keys:', Object.keys(processedResult));
          console.log('Sending final results...');
          
          // Send the final research results
          writeJSON({ 
            research: processedResult,
            success: true
          });
          
          console.log('Final results sent, sending completion status...');
          writeStatus({
            stage: 'complete',
            message: 'Research completed successfully!',
            progress: { current: 5, total: 5 }
          });
          
          console.log('Closing controller...');
          controller.close();
          console.log('=== API Route Completed Successfully ===');
          
        } catch (error) {
          console.error('=== API Route Error ===', error);
          
          writeStatus({
            stage: 'complete',
            message: 'Research encountered an error',
            progress: { current: 5, total: 5 }
          });
          
          writeJSON({ 
            error: error instanceof Error ? error.message : 'An error occurred during research',
            success: false,
            research: {
              summary: 'Research could not be completed due to an error.',
              findings: [],
              keyInsights: [],
              statistics: [],
              codeExamples: [],
              suggestedQuestions: ['Please try rephrasing your query', 'Check your internet connection', 'Try again in a few moments'],
              metadata: {
                sourcesCount: 0,
                confidence: 0,
                researchDepth: 'Error',
                lastUpdated: new Date().toISOString(),
                error: true,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
              }
            }
          });
          
          console.log('Error response sent, closing controller...');
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
      }
    });

  } catch (parseError) {
    console.error('=== Request Parsing Error ===', parseError);
    return Response.json({ 
      error: 'Failed to parse request',
      details: parseError instanceof Error ? parseError.message : 'Unknown error'
    }, { status: 400 });
  }
}

// Add OPTIONS handler for CORS if needed
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Add a simple non-streaming endpoint for testing
export async function GET(request: Request) {
  console.log('=== Simple GET Test Route ===');
  
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || 'test query';
  
  try {
    console.log('Processing simple request for:', query);
    
    // Simple test response
    const testResult = {
      summary: `This is a test research summary for "${query}". The research system is working correctly and can process queries successfully.`,
      findings: [
        {
          id: 'test-finding-1',
          title: 'Test Finding 1',
          content: 'This is a test finding to verify the system is working.',
          source: 'Test System',
          relevance: 'High',
          credibility: 0.9,
          type: 'test',
          category: 'Testing',
          publishedDate: '',
          authors: [],
          tags: []
        }
      ],
      keyInsights: [
        {
          id: 'test-insight-1',
          point: 'System is operational',
          explanation: 'The research system is functioning correctly and can return structured data.',
          supportingEvidence: [],
          confidence: 0.9,
          category: 'System Status'
        }
      ],
      statistics: [
        {
          id: 'test-stat-1',
          metric: 'System Status',
          value: '100%',
          context: 'System operational status',
          source: 'Internal monitoring',
          unit: 'percentage',
          trend: 'stable',
          lastUpdated: new Date().toISOString()
        }
      ],
      codeExamples: [],
      suggestedQuestions: [
        {
          id: 'test-question-1',
          question: 'How does the research system work?',
          category: 'general',
          priority: 0.8
        }
      ],
      metadata: {
        sourcesCount: 1,
        confidence: 0.9,
        researchDepth: 'Test',
        lastUpdated: new Date().toISOString(),
        searchQueries: 1,
        qualityScore: 1.0,
        researchType: 'test',
        processingTime: 100,
        errorCount: 0
      }
    };
    
    console.log('Returning test result');
    return Response.json({ 
      research: testResult,
      success: true,
      message: 'Test endpoint working correctly'
    });
    
  } catch (error) {
    console.error('GET endpoint error:', error);
    return Response.json({ 
      error: error instanceof Error ? error.message : 'Test endpoint error',
      success: false
    }, { status: 500 });
  }
}