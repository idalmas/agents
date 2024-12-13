import { OpenAI } from 'openai';

interface Tool {
  name: string;
  description: string;
  execute: (query: string, posts: any[]) => Promise<{
    result: string;
    relevantPosts: any[];
  }>;
}

interface ToolResult {
  toolName: string;
  result: string;
  relevantPosts: any[];
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to filter posts based on query context
function filterRelevantPosts(query: string, posts: any[]): any[] {
  const queryLower = query.toLowerCase();
  const isFriendRelated = queryLower.includes('friend') || 
                         queryLower.includes('personal') || 
                         queryLower.includes('people i know');

  return posts.filter(post => {
    const caption = (post.caption || '').toLowerCase();
    const isSponsored = caption.includes('#ad') || 
                       caption.includes('#sponsored') || 
                       caption.includes('#partner') ||
                       caption.includes('sponsored post') ||
                       caption.includes('paid partnership');

    // If query is friend-related, exclude sponsored posts
    if (isFriendRelated && isSponsored) {
      return false;
    }

    return true;
  });
}

export const tools: Tool[] = [
  {
    name: "caption_analysis",
    description: "Analyzes captions to identify patterns, themes, and writing style",
    execute: async (query: string, posts: any[]) => {
      const relevantPosts = filterRelevantPosts(query, posts);
      const captions = relevantPosts.map(post => post.caption).filter(Boolean);
      
      if (captions.length === 0) {
        return {
          result: "No relevant non-sponsored captions found for analysis.",
          relevantPosts: []
        };
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Analyze Instagram captions briefly. No markdown. Keep it concise."
          },
          {
            role: "user",
            content: `Query: ${query}\n\nCaptions to analyze:\n${captions.join('\n')}`
          }
        ],
        temperature: 0.7
      });

      return {
        result: response.choices[0].message.content || "No caption analysis available.",
        relevantPosts: relevantPosts
      };
    }
  },
  {
    name: "hashtag_analysis",
    description: "Analyzes hashtags to identify topics and interests",
    execute: async (query: string, posts: any[]) => {
      const relevantPosts = filterRelevantPosts(query, posts);
      const captions = relevantPosts.map(post => post.caption).filter(Boolean);
      const hashtags = captions
        .map(caption => {
          const matches = caption.match(/#[\w]+/g);
          return matches || [];
        })
        .flat()
        .filter(tag => !['#ad', '#sponsored', '#partner'].includes(tag.toLowerCase()));

      if (hashtags.length === 0) {
        return {
          result: "No relevant hashtags found for analysis.",
          relevantPosts: []
        };
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Analyze Instagram hashtags briefly. No markdown. Keep it concise."
          },
          {
            role: "user",
            content: `Query: ${query}\n\nHashtags to analyze:\n${hashtags.join(', ')}`
          }
        ],
        temperature: 0.7
      });

      return {
        result: response.choices[0].message.content || "No hashtag analysis available.",
        relevantPosts: relevantPosts
      };
    }
  },
  {
    name: "image_content",
    description: "Analyzes the content and themes in the images",
    execute: async (query: string, posts: any[]) => {
      const relevantPosts = filterRelevantPosts(query, posts);
      
      if (relevantPosts.length === 0) {
        return {
          result: "No relevant non-sponsored posts found for analysis.",
          relevantPosts: []
        };
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Analyze Instagram images briefly. No markdown. Keep it concise."
          },
          {
            role: "user",
            content: `Query: ${query}\n\nAnalyze these posts:\n${relevantPosts.map((post, i) => 
              `Post ${i + 1}: ${post.caption || 'No caption'}`
            ).join('\n')}`
          }
        ],
        temperature: 0.7
      });

      return {
        result: response.choices[0].message.content || "No image content analysis available.",
        relevantPosts: relevantPosts
      };
    }
  }
];

export async function determineRelevantTools(query: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a tool selector for Instagram analysis. Available tools are:
        ${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}
        
        Return only the names of relevant tools for the query, separated by commas.
        Choose tools that would provide useful insights for the query.`
      },
      {
        role: "user",
        content: query
      }
    ],
    temperature: 0
  });

  const toolList = response.choices[0].message.content || "";
  return toolList.split(',').map(t => t.trim()).filter(t => 
    tools.some(tool => tool.name === t)
  );
}

export async function executeTools(query: string, posts: any[]): Promise<ToolResult[]> {
  const relevantTools = await determineRelevantTools(query);
  
  const results = await Promise.all(
    relevantTools.map(async toolName => {
      const tool = tools.find(t => t.name === toolName);
      if (!tool) return null;
      
      const result = await tool.execute(query, posts);
      return {
        toolName: tool.name,
        result: result.result,
        relevantPosts: result.relevantPosts
      };
    })
  );

  return results.filter((r): r is ToolResult => r !== null);
}

export async function synthesizeResults(query: string, results: ToolResult[]): Promise<{
  summary: string;
  relevantPosts: any[];
}> {
  const allRelevantPosts = new Set(results.flatMap(r => r.relevantPosts));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Provide a brief summary of the analysis. No markdown. Keep it very concise, focusing only on key insights."
      },
      {
        role: "user",
        content: `Query: ${query}\n\nAnalysis Results:\n${results.map(r => 
          `${r.toolName}:\n${r.result}`
        ).join('\n\n')}`
      }
    ],
    temperature: 0.7
  });

  return {
    summary: response.choices[0].message.content || "Could not synthesize results.",
    relevantPosts: Array.from(allRelevantPosts)
  };
} 