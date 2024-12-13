"use client";

import { useEffect, useState } from 'react';
import { useUser } from "@clerk/nextjs";
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Post {
  username: string;
  likes: string;
  caption: string;
  timestamp: string;
}

export default function Results() {
  const { user } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user) {
        router.push('/');
        return;
      }

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch posts');
        }

        setPosts(data.posts);
        setStreamingUrl(data.liveStreamingUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user, router]);

  if (!user) return null;

  return (
    <main className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Instagram Feed Results</h1>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600">Fetching your Instagram feed...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
            {error}
          </div>
        )}

        {streamingUrl && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Live Preview</h2>
            <iframe
              src={streamingUrl}
              className="w-full h-[400px] border border-gray-200 rounded-lg"
              title="Live Preview"
            />
          </div>
        )}

        <div className="grid gap-6">
          {posts.map((post, index) => (
            <div 
              key={index}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg">{post.username}</h3>
                <span className="text-gray-500 text-sm">
                  {new Date(post.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-600 mb-4">{post.caption}</p>
              <div className="text-sm text-gray-500">
                {post.likes} likes
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
} 