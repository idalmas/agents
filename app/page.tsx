"use client";

import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [hasConnections, setHasConnections] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (user) {
      const isInstagramConnected = localStorage.getItem('instagramConnected') === 'true';
      setHasConnections(isInstagramConnected);
    }
  }, [user]);

  const handleSearch = () => {
    if (!user) {
      document.getElementById('clerk-sign-in')?.click();
    } else if (!hasConnections) {
      router.push('/manage-integrations');
    } else {
      router.push(`/results?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gradient-to-b from-[#f0f2eb] to-[#e8eae3]">
      <div className="flex justify-end w-full max-w-3xl gap-4 items-center">
        {user && (
          <>
            <button
              onClick={() => router.push('/manage-integrations')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Settings className="w-5 h-5" />
              Manage Connections
            </button>
            <UserButton afterSignOutUrl="/" />
          </>
        )}
      </div>
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-3xl">
        <h1 className="mb-8 text-4xl font-bold text-gray-900">Lembas</h1>
        
        <div className="w-full max-w-2xl">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="What would you like to know about your social feeds?"
              className="w-full px-6 py-4 text-lg rounded-full border-2 border-gray-200 focus:border-[#6B8E23] focus:outline-none shadow-lg bg-white"
            />
            <button 
              onClick={handleSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-[#6B8E23] text-white rounded-full hover:bg-[#556B2F] transition-colors"
            >
              {!user 
                ? "Sign In" 
                : !hasConnections 
                  ? "Connect Accounts" 
                  : "Search"
              }
            </button>
          </div>
          {!user && (
            <div className="hidden">
              <SignInButton mode="modal" afterSignInUrl="/manage-integrations">
                <button id="clerk-sign-in">Sign In</button>
              </SignInButton>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
