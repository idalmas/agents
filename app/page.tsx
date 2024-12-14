"use client";

import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Home() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [hasConnections, setHasConnections] = useState(false);

  // Check for connections on mount and when user changes
  useEffect(() => {
    if (user) {
      // Check localStorage for Instagram connection
      const isInstagramConnected = localStorage.getItem('instagramConnected') === 'true';
      setHasConnections(isInstagramConnected);
    }
  }, [user]);

  const handleSearch = () => {
    if (!user) {
      // If user is not logged in, show sign in
      document.getElementById('clerk-sign-in')?.click();
    } else if (!hasConnections) {
      // If user is logged in but has no connections, redirect to manage integrations
      router.push('/manage-integrations');
    } else {
      // Get the input value
      const input = document.querySelector('input') as HTMLInputElement;
      const query = input?.value || '';
      // User is logged in and has at least one connection
      router.push(`/results?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-[#f2f4f3]">
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
        <h1 className="mb-2 text-4xl font-bold text-gray-900">Lembas</h1>
        
        <div className="w-full max-w-2xl">
          <div className="relative">
            <input
              type="text"
              placeholder="What would you like to know about your social feeds?"
              className="w-full px-6 py-4 text-lg rounded-full border-2 border-emerald-600 focus:border-emerald-700 focus:outline-none shadow-lg bg-white text-emerald-900 placeholder-gray-500"
            />
            <button 
              onClick={handleSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-emerald-800 text-white rounded-full hover:bg-emerald-900 transition-colors shadow-md"
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
