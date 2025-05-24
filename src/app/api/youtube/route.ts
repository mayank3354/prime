import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json(
      { error: "Query is required" },
      { status: 400 }
    );
  }
  
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('YouTube API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch videos' },
      { status: 500 }
    );
  }
} 