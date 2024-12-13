"use client";

import { useEffect, useState } from 'react';
import { useUser } from "@clerk/nextjs";
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';

interface Post {
  caption: string;
  imageUrl: string;
}

export default function Results() {
  const { user } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          body: JSON.stringify({ 
            userId: user.id
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch posts');
        }

        setPosts(data.posts);
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
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Header Display */}
        <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Instagram Feed</h2>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Top Posts
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {posts.length} posts found
            </div>
          </div>
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

        <div className="grid gap-8">
          {posts.map((post, index) => (
            <div 
              key={index}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {post.imageUrl && (
                <div className="relative w-full aspect-[4/5] mb-4 rounded-lg overflow-hidden max-w-2xl mx-auto">
                  <Image
                    src={post.imageUrl}
                    alt={post.caption || 'Instagram post'}
                    fill
                    style={{ objectFit: 'contain' }}
                    className="rounded-lg"
                  />
                </div>
              )}
              {post.caption && (
                <p className="text-gray-700 text-lg">{post.caption}</p>
              )}
            </div>
          ))}
        </div>

        {!loading && posts.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-600">No posts found in your feed.</p>
          </div>
        )}
      </div>
    </main>
  );
} 