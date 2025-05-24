import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ResearchAgent } from '@/lib/agents/langchain-agent';
import { AcademicResearchAgent } from '@/lib/agents/academic-research-agent';
import { ResearchStatus } from '@/types/research';

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper function to write properly formatted JSON lines
  const writeJSON = (data: any) => {
    try {
      // Ensure the data is properly sanitized before stringifying
      const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
        // Handle undefined values
        if (value === undefined) return null;
        return value;
      }));
      
      const jsonString = JSON.stringify(sanitizedData);
      writer.write(encoder.encode(jsonString + '\n'));
    } catch (e) {
      console.error('Error stringifying JSON:', e);
      writer.write(encoder.encode(JSON.stringify({ error: 'Error formatting response' }) + '\n'));
    }
  };

  // Helper function to write status updates
  const writeStatus = (status: ResearchStatus) => {
    writeJSON({ status });
  };

  try {
    const { query, useOllama = false } = await request.json();
    
    // Initialize research agent
    let agent: ResearchAgent;
    
    // Initialize with Google Generative AI
    agent = new ResearchAgent();
    
    // Start streaming the research process
    writeStatus({
      stage: 'searching',
      message: 'Searching for information...'
    });
    
    // Create a custom callback to stream progress updates
    const statusCallback = (status: ResearchStatus) => {
      writeStatus(status);
    };
    
    // Perform the research with streaming updates
    const research = await agent.researchWithStreaming(query, statusCallback);
    
    // Send the final research results
    writeJSON({ 
      research: {
        summary: research.summary,
        findings: Array.isArray(research.findings) ? research.findings : [],
        keyInsights: Array.isArray(research.keyInsights) ? research.keyInsights : [],
        statistics: Array.isArray(research.statistics) ? research.statistics : [],
        codeExamples: Array.isArray(research.codeExamples) ? research.codeExamples : [],
        suggestedQuestions: Array.isArray(research.suggestedQuestions) ? research.suggestedQuestions : [],
        metadata: research.metadata || {}
      }
    });
    
    writer.close();
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (error) {
    console.error('Research error:', error);
    writeJSON({ 
      error: error instanceof Error ? error.message : 'An error occurred during research'
    });
    writer.close();
    return new Response(stream.readable, { status: 500 });
  }
}