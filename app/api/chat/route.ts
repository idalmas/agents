import { OpenAI } from 'openai';
import { NextResponse } from "next/server";
import { executeTools, synthesizeResults } from '@/app/lib/tools';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to determine if we need Instagram photos
async function needsInstagramPhotos(query: string): Promise<boolean> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant that determines if a user's query requires looking at Instagram content to answer.
        Return true if the query is about Instagram content, patterns, or analysis.
        Return false if the query can be answered without Instagram data.
        ONLY respond with the word "true" or "false".`
      },
      {
        role: "user",
        content: query
      }
    ],
    temperature: 0,
    max_tokens: 5
  });

  return response.choices[0].message.content?.toLowerCase().includes('true') ?? false;
}

// Function to generate a direct response without Instagram data
async function generateDirectResponse(query: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful AI assistant. Provide clear, concise answers to user queries. Do not use any markdown formatting in your responses - respond in plain text only."
      },
      {
        role: "user",
        content: query
      }
    ],
    temperature: 0.7
  });

  return response.choices[0].message.content || "I couldn't generate a response.";
}

export async function POST(req: Request) {
  try {
    const { query, userId } = await req.json();

    if (!query || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    // First, determine if we need Instagram data
    const requiresInstagram = await needsInstagramPhotos(query);

    if (!requiresInstagram) {
      // If we don't need Instagram data, generate a direct response
      const directResponse = await generateDirectResponse(query);
      return NextResponse.json({
        success: true,
        type: 'direct',
        response: directResponse,
        posts: []
      });
    }

    // Get the base URL from the request
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Fetch Instagram posts
    const searchResponse = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      throw new Error(errorData.error || 'Failed to fetch Instagram posts');
    }

    const searchData = await searchResponse.json();

    // Execute relevant tools and synthesize results
    const toolResults = await executeTools(query, searchData.posts);
    const { summary, relevantPosts } = await synthesizeResults(query, toolResults);

    return NextResponse.json({
      success: true,
      type: 'analysis',
      response: summary,
      posts: relevantPosts
    });

  } catch (error: unknown) {
    console.error('Chat API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, {
      status: 500
    });
  }
} 