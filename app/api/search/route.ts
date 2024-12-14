import { AnonRuntime } from "@anon/sdk-typescript";
import { NextResponse } from "next/server";
import type { Page } from 'playwright-core';

const ANON_KEY = process.env.ANON_KEY;
const MAX_RETRIES = 3;
const TIMEOUT = 30000; // 30 seconds

if (!ANON_KEY) {
  throw new Error('ANON_KEY environment variable is not set');
}

const anon = new AnonRuntime({
  apiKey: ANON_KEY,
  environment: 'sandbox'
});

async function createBrowserSession(userId: string, retryCount = 0): Promise<any> {
  try {
    console.log(`Attempt ${retryCount + 1} to create browser session...`);
    
    const response = await Promise.race([
      anon.run({
        appUserId: userId,
        apps: ['instagram'],
        action: async (page: Page) => {
          try {
            // Enable console logging from the browser
            page.on('console', msg => console.log('Browser:', msg.text()));
            
            // Set a shorter navigation timeout
            page.setDefaultNavigationTimeout(TIMEOUT);
            page.setDefaultTimeout(TIMEOUT);
            
            console.log('Starting navigation...');
            
            // Go to Instagram feed directly
            await page.goto('https://www.instagram.com/feed/');
            console.log('Initial navigation complete');

            // Wait for either the feed to load or login page
            try {
              await Promise.race([
                page.waitForSelector('article', { timeout: 5000 }),
                page.waitForSelector('input[name="username"]', { timeout: 5000 })
              ]);
            } catch (e) {
              console.log('Timeout waiting for initial content');
            }

            // Check if we're logged in
            const isLoggedIn = await page.evaluate(() => {
              return !document.querySelector('input[name="username"]');
            });

            if (!isLoggedIn) {
              console.log('Not logged in');
              return {
                posts: [],
                message: 'Please log in to Instagram to view your feed'
              };
            }

            // Wait a bit longer for feed content
            await page.waitForTimeout(3000);

            // Simple post extraction with logging
            const posts = await page.evaluate(() => {
              console.log('Starting post extraction in browser');
              
              const selectors = ['article', 'div[role="feed"] > div', 'main article'];
              let articles = [];
              
              for (const selector of selectors) {
                const found = document.querySelectorAll(selector);
                console.log(`Found ${found.length} elements with selector: ${selector}`);
                articles.push(...Array.from(found));
              }

              articles = [...new Set(articles)];
              console.log(`Found ${articles.length} unique articles`);

              return articles.map(article => {
                const images = article.querySelectorAll('img');
                console.log(`Found ${images.length} images in article`);
                
                let bestImage = null;
                for (const img of images) {
                  const src = img.getAttribute('src') || '';
                  console.log('Found image with src:', src);
                  if (src && !src.includes('profile') && (src.includes('cdninstagram') || src.includes('fbcdn'))) {
                    bestImage = img;
                    console.log('Selected best image:', src);
                    break;
                  }
                }

                const caption = article.textContent;
                const post = {
                  caption: caption?.trim() || '',
                  imageUrl: bestImage?.getAttribute('src') || ''
                };
                console.log('Created post:', post);
                return post;
              });
            });

            const validPosts = posts
              .filter(post => post.imageUrl && post.imageUrl.length > 0)
              .slice(0, 10);

            return {
              posts: validPosts,
              message: `Found ${validPosts.length} posts in your feed`
            };
          } catch (error) {
            console.error('Browser action error:', error);
            throw error;
          }
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser session timeout')), TIMEOUT)
      )
    ]) as { result: any };  // Type assertion to fix the type error

    return response.result;
  } catch (error) {
    console.error(`Browser session attempt ${retryCount + 1} failed:`, error);
    
    if (retryCount < MAX_RETRIES - 1) {
      console.log('Retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return createBrowserSession(userId, retryCount + 1);
    }
    
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { userId, query } = await req.json();
    console.log('Starting request for user:', userId);
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required',
        message: 'Please provide a user ID'
      }, { status: 400 });
    }

    const result = await createBrowserSession(userId);

    if (!result?.posts?.length) {
      console.log('No posts found in result:', result);
      return NextResponse.json({ 
        success: false,
        posts: [],
        message: result?.message || 'No posts found',
        error: 'No posts found in feed'
      });
    }

    console.log(`Returning ${result.posts.length} posts`);
    return NextResponse.json({ 
      success: true, 
      posts: result.posts,
      message: result.message
    });

  } catch (error) {
    console.error('Request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({ 
      success: false, 
      posts: [],
      error: 'Failed to fetch posts',
      message: `There was an error fetching your Instagram feed: ${errorMessage}. Please try again.`
    }, { 
      status: 500 
    });
  }
} 