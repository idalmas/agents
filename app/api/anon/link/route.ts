import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const params = new URLSearchParams({
      app: 'instagram',
      appUserId: userId,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/link/callback`,
    });

    const generateLinkUrl = `https://svc.sandbox.anon.com/link/url?${params.toString()}`;

    const response = await fetch(generateLinkUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.ANON_KEY}`,
      },
    });

    const data = await response.json();

    return Response.json({ url: data.url });
  } catch (error) {
    console.error('Error generating link URL:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 