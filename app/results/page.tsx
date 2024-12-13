"use client";

import { useEffect, useState } from 'react';
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';

interface Post {
  caption: string;
  imageUrl: string;
}

interface QueryResponse {
  type: 'direct' | 'analysis';
  response: string;
  posts: Post[];
  toolResults?: any[];
}

export default function Results() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState('Initializing search...');

  useEffect(() => {
    const fetchResults = async () => {
      if (!user) {
        router.push('/');
        return;
      }

      const query = searchParams.get('q') || '';
      setLoadingStatus('Starting search...');

      try {
        setLoadingStatus('Fetching Instagram data...');
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            userId: user.id,
            query: query
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to process query');
        }

        setQueryResponse(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user, router, searchParams]);

  if (!user) return null;

  return (
    <main className="min-h-screen p-8 bg-gradient-to-b from-[#f0f2eb] to-[#e8eae3]">
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

        {/* Query and Response Display */}
        <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Your Query</h2>
            <p className="text-2xl font-bold text-gray-900">
              {searchParams.get('q') || 'Recent Posts'}
            </p>
          </div>

          {queryResponse?.response && (
            <div className="mt-4 p-4 bg-[#f7f8f5] rounded-lg">
              <p className="text-gray-800">{queryResponse.response}</p>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6B8E23]"></div>
            <p className="mt-4 text-gray-600">{loadingStatus}</p>
            <p className="mt-2 text-sm text-gray-500">Please wait while we process your request...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
            {error}
          </div>
        )}

        {queryResponse?.posts && queryResponse.posts.length > 0 && (
          <div className="grid gap-8">
            {queryResponse.posts.map((post, index) => (
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
        )}

        {!loading && (!queryResponse?.posts || queryResponse.posts.length === 0) && !error && (
          <div className="text-center py-12">
            <p className="text-gray-600">No relevant posts found.</p>
          </div>
        )}
      </div>
    </main>
  );
} 