//import { NextResponse } from 'next/server';
import { ResearchAgent } from '@/lib/agents/langchain-agent';
import { AcademicResearchAgent } from '@/lib/agents/academic-research-agent';
import { ResearchStatus } from '@/types/research';

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const writeStatus = (status: ResearchStatus) => {
    writer.write(encoder.encode(JSON.stringify({ status }) + '\n'));
  };

  try {
    const { query, mode = 'web' } = await request.json();

    // Initialize appropriate agent based on mode
    let agent;
    if (mode === 'academic') {
      writeStatus({
        stage: 'searching',
        message: 'Searching academic papers...'
      });
      agent = new AcademicResearchAgent(writeStatus);
    } else {
      writeStatus({
        stage: 'searching',
        message: 'Searching web sources...'
      });
      agent = new ResearchAgent();
    }

    // Perform research
    const research = await agent.research(query);

    // Send research results
    writer.write(encoder.encode(JSON.stringify({ research }) + '\n'));

    // Send completion status
    writeStatus({
      stage: 'complete',
      message: 'Research complete!'
    });

    writer.close();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Research error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Research failed';
    writer.write(encoder.encode(JSON.stringify({ error: errorMessage }) + '\n'));
    writer.close();
    return new Response(stream.readable, { status: 500 });
  }
} 