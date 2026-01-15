import { useEffect, useState } from 'react';
import { Activity, TrendingUp, Database } from 'lucide-react';

export const AnalyticsLoadingScreen = () => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing...');

  useEffect(() => {
    // Simulate progressive loading
    const stages = [
      { progress: 20, text: 'Connecting to Monday.com...' },
      { progress: 40, text: 'Fetching policy placements...' },
      { progress: 60, text: 'Processing agent data...' },
      { progress: 80, text: 'Calculating metrics...' },
      { progress: 95, text: 'Almost ready...' }
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage].progress);
        setLoadingText(stages[currentStage].text);
        currentStage++;
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-blue-50/20">
      <div className="text-center max-w-md w-full px-4">
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-blue-100 animate-ping opacity-20"></div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Activity className="h-10 w-10 text-white animate-pulse" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Loading Analytics Dashboard
        </h2>
        
        {/* Dynamic Loading Text */}
        <p className="text-muted-foreground mb-6 h-6 flex items-center justify-center">
          <span className="inline-flex items-center gap-2">
            <Database className="h-4 w-4 animate-pulse" />
            {loadingText}
          </span>
        </p>

        {/* Progress Bar Container */}
        <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
          {/* Animated Progress Bar */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            {/* Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>

        {/* Progress Percentage */}
        <p className="text-sm font-medium text-blue-600 mt-2">
          {progress}%
        </p>

        {/* Loading Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="flex flex-col items-center p-2 rounded-lg bg-blue-50/50">
            <TrendingUp className="h-4 w-4 mb-1 text-blue-500" />
            <span>Closers</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-purple-50/50">
            <Database className="h-4 w-4 mb-1 text-purple-500" />
            <span>Placements</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-green-50/50">
            <Activity className="h-4 w-4 mb-1 text-green-500" />
            <span>Metrics</span>
          </div>
        </div>

        {/* Additional Info */}
        <p className="text-xs text-muted-foreground mt-6 italic">
          Preparing comprehensive analytics for your team...
        </p>
      </div>

      {/* Custom Animation Styles */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};
