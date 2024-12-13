import { AnonRuntime } from "@anon/sdk-typescript";
import { NextResponse } from "next/server";
import type { Page } from 'playwright-core';

const ANON_KEY = process.env.ANON_KEY;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const PAGE_TIMEOUT = 60000; // 60 seconds
const NAVIGATION_TIMEOUT = 45000; // 45 seconds

if (!ANON_KEY) {
  throw new Error('ANON_KEY environment variable is not set');
}

// Initialize SDK with required configuration
const anon = new AnonRuntime({
  apiKey: ANON_KEY,
  environment: 'sandbox'
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runWithRetry<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0 && error instanceof Error && 
        (error.name === 'AnonBrowserEnvironmentError' || 
         error.message.includes('fetch failed') ||
         error.message.includes('Browser was closed') ||
         error.message.includes('Target closed') ||
         error.message.includes('browser has been closed'))) {
      console.log(`Retrying operation. Attempts remaining: ${retries - 1}`);
      await delay(RETRY_DELAY);
      return runWithRetry(operation, retries - 1);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { userId, query } = await req.json();
    console.log('Starting Instagram feed extraction for user:', userId);
    console.log('Search query:', query);

    // Define a simple action to test Instagram access
    const action = async (page: Page) => {
      console.log('Debug: Action function started');
      
      try {
        // Navigate to Instagram
        await page.goto('https://www.instagram.com/');
        
        // Simple wait for content
        await page.waitForSelector('article');

        // Extract feed data
        const posts = await page.evaluate(() => {
          const articles = document.querySelectorAll('article');
          return Array.from(articles).slice(0, 10).map(article => {
            // Try to find the main post image
            const mainImage = article.querySelector('div[role="button"] img:not([alt*="profile"])') ||
                            article.querySelector('div > div > img[style*="object-fit"]') ||
                            article.querySelector('div[role="button"] div > img');

            const imgSrc = mainImage?.getAttribute('src') || '';
            
            // Get the caption
            const captionElement = 
              article.querySelector('div > span > div > span') || // Main caption
              article.querySelector('div > span') ||              // Simple caption
              article.querySelector('h1');                        // Alternate caption
            
            const caption = captionElement?.textContent?.trim() || '';
            
            return {
              caption,
              imageUrl: imgSrc
            };
          });
        });

        // Filter out invalid posts
        const validPosts = posts.filter(post => 
          post.imageUrl && !post.imageUrl.includes('profile')
        );

        console.log(`Found ${validPosts.length} valid posts`);
        return validPosts;

      } catch (error) {
        console.error('Page automation error:', error);
        throw error;
      }
    };

    const result = await runWithRetry(async () => {
      const run = await anon.run({
        appUserId: userId,
        apps: ['instagram'],
        action
      });

      return run.result;
    });

    console.log('Debug: Result received:', result);

    return NextResponse.json({ 
      success: true, 
      posts: result,
      query: query || 'Recent Posts'
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });

    return NextResponse.json({ 
      success: false, 
      error: err.message,
      query: '',
      errorDetails: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    }, { 
      status: 500
    });
  }
} 