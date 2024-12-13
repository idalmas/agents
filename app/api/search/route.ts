import { AnonRuntime } from "@anon/sdk-typescript";
import { NextResponse } from "next/server";
import type { Page } from 'playwright-core';

const ANON_KEY = process.env.ANON_KEY;

if (!ANON_KEY) {
  throw new Error('ANON_KEY environment variable is not set');
}

const anon = new AnonRuntime({
  apiKey: ANON_KEY,
  environment: 'sandbox'
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    console.log('Starting Instagram feed extraction for user:', userId);

    const result = await anon.run({
      appUserId: userId,
      apps: ['instagram'],
      action: async (page: Page) => {
        console.log('Navigating to Instagram...');
        await page.goto('https://www.instagram.com/');
        
        console.log('Waiting for content to load...');
        let attempts = 0;
        let posts = [];
        
        while (attempts < 5 && posts.length === 0) {
          try {
            posts = await page.evaluate(() => {
              const articles = document.querySelectorAll('article');
              return Array.from(articles).slice(0, 10).map(article => {
                const img = article.querySelector('img[src*="instagram"]');
                const caption = article.querySelector('div > span')?.textContent || '';
                const isVideo = Boolean(
                  article.querySelector('video') ||
                  article.querySelector('[aria-label*="Reel"]') ||
                  article.querySelector('[aria-label*="Clip"]')
                );

                return {
                  imageUrl: img?.getAttribute('src') || '',
                  caption: caption.trim(),
                  isVideo
                };
              });
            });
            
            if (posts.length === 0) {
              console.log(`Attempt ${attempts + 1}: No posts found, waiting 2 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (err) {
            console.log(`Attempt ${attempts + 1} failed, retrying...`);
          }
          attempts++;
        }

        const filteredPosts = posts.filter(post => post.imageUrl && !post.isVideo);
        console.log(`Found ${filteredPosts.length} valid photo posts after ${attempts} attempts`);
        return filteredPosts;
      }
    });

    return NextResponse.json({ 
      success: true, 
      posts: Array.isArray(result) ? result : []
    });

  } catch (error: unknown) {
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { 
      status: 500
    });
  }
} 