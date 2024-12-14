"use client";

import { useEffect, useState } from 'react';
import { useUser } from "@clerk/nextjs";
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import Image from 'next/image';

interface Post {
  caption: string;
  imageUrl: string;
}

interface Message {
  type: 'user' | 'assistant';
  content: string;
  posts?: Post[];
}

export default function Results() {
  const { user } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    let isSubscribed = true;
    const controller = new AbortController();

    const fetchPosts = async () => {
      if (!user?.id) {
        router.push('/');
        return;
      }

      // Get query from URL
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q') || '';

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            userId: user.id,
            query
          }),
          signal: controller.signal
        });

        const data = await response.json();
        
        if (!isSubscribed) return;

        console.log('Raw response data:', data); // Debug log

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch posts');
        }

        // Filter out posts with invalid image URLs
        const validPosts = data.posts.filter((post: Post) => 
          post.imageUrl && (post.imageUrl.includes('cdninstagram') || post.imageUrl.includes('fbcdn'))
        );

        console.log('Filtered valid posts:', validPosts); // Debug log

        setPosts(validPosts);
        
        // Add initial query and response to messages
        const initialMessages: Message[] = [
          { type: 'user' as const, content: query || 'Show me my recent posts' },
          { type: 'assistant' as const, content: 'Here are the relevant posts from your Instagram feed:', posts: validPosts }
        ];

        console.log('Setting messages:', initialMessages); // Debug log
        
        setMessages(initialMessages);
      } catch (err: unknown) {
        if (!isSubscribed) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    fetchPosts();

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [user?.id, router]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id) return;

    // Add user message to chat
    const userMessage: Message = { type: 'user', content: newMessage };
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id,
          query: newMessage
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch response');
      }

      // Add assistant response to chat
      const assistantMessage: Message = { 
        type: 'assistant', 
        content: 'Here are the relevant posts for your query:',
        posts: data.posts
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#f2f4f3]">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Messages Container */}
        <div className="space-y-8">
          {messages.map((message, index) => (
            <div key={index} className={`${message.type === 'user' ? 'bg-white' : 'bg-white'} rounded-xl p-6 shadow-sm`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.type === 'user' ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-800 text-white'
                }`}>
                  {message.type === 'user' ? 'U' : 'A'}
                </div>
                <div className="font-medium">
                  {message.type === 'user' ? 'You' : 'Assistant'}
                </div>
              </div>
              
              <p className="text-gray-700 mb-4">{message.content}</p>

              {message.posts && (
                <div className="grid gap-6">
                  {message.posts.map((post, postIndex) => (
                    <div key={postIndex} className="bg-gray-50 rounded-lg p-4">
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
                        <p className="text-gray-700">{post.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-800"></div>
                <p className="text-gray-600">Thinking...</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Container */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask a follow-up question..."
                className="w-full px-6 py-4 text-lg rounded-full border-2 border-emerald-600 focus:border-emerald-700 focus:outline-none shadow-lg bg-white text-emerald-900 placeholder-gray-500 pr-16"
              />
              <button 
                onClick={handleSendMessage}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-emerald-800 text-white rounded-full hover:bg-emerald-900 transition-colors"
              >
                <Send className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Spacer for fixed input */}
        <div className="h-24" />
      </div>
    </main>
  );
} 