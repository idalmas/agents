"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from "next/navigation";

export default function ManageIntegrations() {
  const { user } = useUser();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInstagramConnected, setIsInstagramConnected] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Check URL parameters on mount and after navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    console.log('URL Status:', status); // Debug log

    if (status === 'success') {
      setIsInstagramConnected(true);
      showNotification('Successfully connected to Instagram! 🎉', 'success');
      // Store connection state in localStorage
      localStorage.setItem('instagramConnected', 'true');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (status === 'error') {
      console.error('Connection failed');
      showNotification('Failed to connect to Instagram. Please try again.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load connection state from localStorage on mount
  useEffect(() => {
    const connected = localStorage.getItem('instagramConnected') === 'true';
    setIsInstagramConnected(connected);
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000); // Increased duration to 5 seconds
  };

  const connectToInstagram = async () => {
    if (!user) {
      showNotification('Please sign in first', 'error');
      return;
    }
    
    setIsConnecting(true);

    try {
      const params = new URLSearchParams({
        app: 'instagram',
        appUserId: user.id,
        redirectUrl: `${window.location.origin}/manage-integrations`,
      });
      
      const generateLinkUrl = `https://svc.sandbox.anon.com/link/url?${params.toString()}`;
      
      const response = await fetch(generateLinkUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No URL returned from Anon API');
      }
    } catch (error) {
      console.error('Detailed error:', error);
      showNotification('Failed to connect to Instagram. Please try again.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gradient-to-b from-gray-50 to-white">
      {showToast && (
        <div 
          className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
            toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white transition-all duration-300 transform translate-y-0 opacity-100 flex items-center gap-2`}
        >
          {toastType === 'success' && <CheckCircle className="w-5 h-5" />}
          {toastMessage}
        </div>
      )}
      
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Manage Integrations</h1>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>

        <div className="grid gap-6">
          <div className={`p-6 rounded-xl border ${isInstagramConnected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'} shadow-sm hover:shadow-md transition-all duration-300`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                    Instagram
                    {isInstagramConnected && (
                      <CheckCircle className="w-5 h-5 text-green-500 inline" />
                    )}
                  </h3>
                  <p className="text-gray-600">
                    {isInstagramConnected 
                      ? 'Your Instagram account is connected and ready to use.'
                      : 'Connect your Instagram account to get daily summaries of your feed.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={connectToInstagram}
                disabled={isConnecting || isInstagramConnected}
                className={`px-6 py-2 rounded-full transition-all duration-300 ${
                  isInstagramConnected 
                    ? 'bg-green-100 text-green-700 cursor-default'
                    : isConnecting
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isInstagramConnected 
                  ? 'Connected ✓' 
                  : isConnecting 
                    ? 'Connecting...' 
                    : 'Connect'
                }
              </button>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold mb-2">X (Twitter)</h3>
                <p className="text-gray-600">Connect your X account to stay updated without the scroll.</p>
              </div>
              <button className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
                Connect
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 