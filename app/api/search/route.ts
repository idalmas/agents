import { AnonRuntime } from "@anon/sdk-typescript";
import { NextResponse } from "next/server";
import type { Page } from 'playwright-core';

const ANON_KEY = process.env.ANON_KEY;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

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
        (error.name === 'AnonBrowserEnvironmentError' || error.message.includes('fetch failed'))) {
      console.log(`Retrying operation. Attempts remaining: ${retries - 1}`);
      await delay(RETRY_DELAY);
      return runWithRetry(operation, retries - 1);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    console.log('Starting Instagram feed extraction for user:', userId);

    // Define a simple action to test Instagram access
    const action = async (page: Page) => {
      console.log('Debug: Action function started');
      
      try {
        // Navigate to Instagram home with less strict waiting conditions
        console.log('Navigating to Instagram...');
        await page.goto('https://www.instagram.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Wait for authentication to complete
        console.log('Waiting for authentication...');
        await page.waitForTimeout(5000);

        // Wait specifically for article elements
        await page.waitForSelector('article', { timeout: 30000 });

        // Extract feed data focusing on photos and captions
        console.log('Extracting feed data...');
        const posts = await page.evaluate(() => {
          const articles = document.querySelectorAll('article');
          return Array.from(articles).slice(0, 10).map(article => {
            // Get the image
            const img = article.querySelector('img[src]');
            const imgSrc = img?.getAttribute('src') || '';
            const altText = img?.getAttribute('alt') || '';
            
            // Get the caption - try different possible selectors
            const captionElement = 
              article.querySelector('div > span > div > span') || // Main caption
              article.querySelector('div > span') ||              // Simple caption
              article.querySelector('h1');                        // Alternate caption
            
            const caption = captionElement?.textContent?.trim() || '';
            
            return {
              caption,
              imageUrl: imgSrc,
              altText: altText
            };
          });
        });

        console.log(`Extracted ${posts.length} posts`);
        
        // Filter out posts without images or captions
        const validPosts = posts.filter(post => 
          post.imageUrl || post.caption
        );
        
        console.log(`Found ${validPosts.length} valid posts`);
        return validPosts;
      } catch (error: unknown) {
        const err = error as Error;
        console.error('Page automation error:', err);
        throw new Error(`Page automation failed: ${err.message}`);
      }
    };

    // Run the action with retries
    console.log('Debug: Initiating run with config:', {
      appUserId: userId,
      apps: ['instagram']
    });

    const result = await runWithRetry(async () => {
      const run = await anon.run({
        appUserId: userId,
        apps: ['instagram'],
        action,
        logger: {
          isEnabled: (name: string, severity: "error" | "verbose" | "info" | "warning") => true,
          log: (name: string, severity: "error" | "verbose" | "info" | "warning", message: string) => {
            console.log(`[${severity}] ${name}: ${message}`);
          }
        }
      });

      console.log('Debug: Run initiated, waiting for result');
      return run.result;
    });

    console.log('Debug: Result received:', result);

    return NextResponse.json({ 
      success: true, 
      posts: result
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