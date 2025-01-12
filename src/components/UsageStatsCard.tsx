'use client';
import { ApiKey } from '@/types/api';

interface UsageStatsCardProps {
  apiKeys: ApiKey[];
}

export function UsageStatsCard({ apiKeys }: UsageStatsCardProps) {
  const totalUsage = apiKeys.reduce((acc, key) => acc + key.usage, 0);
  const usagePercentage = (totalUsage / 1000) * 100;

  return (
    <div className="mb-8 rounded-xl overflow-hidden">
      <div className="p-8 bg-gradient-to-r from-rose-100 via-purple-200 to-blue-200 dark:from-rose-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="text-sm font-medium mb-2">CURRENT PLAN</div>
            <h2 className="text-4xl font-bold">Researcher</h2>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-gray-800/90 rounded-lg text-sm">
            <span>Manage Plan</span>
          </button>
        </div>
        
        <div>
          <div className="text-sm font-medium mb-2">API Limit</div>
          <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 mb-2">
            <div 
              className="bg-black/20 dark:bg-white/20 h-full rounded-full" 
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
          <div className="text-sm">
            {totalUsage} / 1,000 Requests
          </div>
        </div>
      </div>
    </div>
  );
} 