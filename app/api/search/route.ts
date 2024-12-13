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
      let browser = null;
      
      try {
        // Set default timeout for all operations
        page.setDefaultTimeout(PAGE_TIMEOUT);
        
        // Navigate to Instagram with better error handling
        console.log('Navigating to Instagram...');
        await page.goto('https://www.instagram.com/', {
          waitUntil: 'networkidle',
          timeout: NAVIGATION_TIMEOUT
        }).catch(async (error) => {
          console.log('Navigation error:', error.message);
          // Try one more time with less strict conditions
          await page.goto('https://www.instagram.com/', {
            waitUntil: 'domcontentloaded',
            timeout: NAVIGATION_TIMEOUT
          });
        });

        // Wait for initial content load with retry
        console.log('Waiting for initial content...');
        await Promise.race([
          page.waitForLoadState('networkidle', { timeout: PAGE_TIMEOUT }),
          new Promise(resolve => setTimeout(resolve, 30000))
        ]);
        
        // Wait for articles with retry logic and better error handling
        console.log('Waiting for feed...');
        let retryCount = 0;
        let articles = null;
        
        while (retryCount < 3 && !articles) {
          try {
            await page.waitForSelector('article', {
              timeout: 20000,
              state: 'visible'
            });

            // Extract feed data with timeout protection and better error handling
            console.log('Extracting feed data...');
            const posts = await page.evaluate(() => {
              const articles = document.querySelectorAll('article');
              if (!articles || articles.length === 0) {
                return [];
              }

              return Array.from(articles).slice(0, 10).map(article => {
                try {
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
                } catch (err) {
                  console.error('Error processing article:', err);
                  return null;
                }
              }).filter(post => post !== null);
            });

            // Validate posts
            if (!Array.isArray(posts)) {
              throw new Error('Invalid posts data structure');
            }

            // Filter out invalid posts
            const validPosts = posts.filter(post => 
              post && post.imageUrl && !post.imageUrl.includes('profile')
            );

            console.log(`Found ${validPosts.length} valid posts`);
            return validPosts;

          } catch (error) {
            console.error(`Attempt ${retryCount + 1} failed:`, error);
            retryCount++;
            if (retryCount === 3) {
              throw new Error('Failed to extract posts after multiple attempts');
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        if (!articles) {
          throw new Error('No articles found on the page');
        }

        // Extract feed data with timeout protection
        console.log('Extracting feed data...');
        const posts = await Promise.race([
          page.evaluate(() => {
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
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Feed extraction timeout')), 30000)
          )
        ]);

        // Filter out invalid posts
        const validPosts = posts.filter(post => 
          post.imageUrl && !post.imageUrl.includes('profile')
        );

        console.log(`Found ${validPosts.length} valid posts`);
        return validPosts;

      } catch (error: unknown) {
        const err = error as Error;
        console.error('Page automation error:', err);
        
        // Check if error is due to browser/page closure
        if (err.message.includes('Target closed') || 
            err.message.includes('browser has been closed') ||
            err.message.includes('Target page, context or browser has been closed')) {
          throw new Error('Browser was closed - will retry');
        }
        
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