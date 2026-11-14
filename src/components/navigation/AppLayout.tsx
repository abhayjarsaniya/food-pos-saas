import React from 'react';
import { Outlet } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNavBar } from './MobileNavBar';
import { useSync } from '../../contexts/SyncContext';
import { WifiOff, RefreshCw } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, triggerSync } = useSync();

  return (
    <div className="flex min-h-screen bg-white w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full pb-24 md:pb-6 overflow-y-auto overflow-x-hidden">
        {/* Offline Banner alert on mobile & desktop if disconnected */}
        {!isOnline && (
          <div className="bg-amber-500 text-white text-xs font-medium px-4 py-2 flex items-center justify-between sticky top-0 z-30 shadow-xs">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>Offline Mode – Bills are saved safely on your device and will sync automatically.</span>
            </div>
            {pendingCount > 0 && (
              <span className="bg-amber-700/60 px-2 py-0.5 rounded-full text-[11px] font-bold">
                {pendingCount} Pending
              </span>
            )}
          </div>
        )}

        {/* Sync in progress banner */}
        {isOnline && pendingCount > 0 && (
          <div className="bg-emerald-600 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Syncing {pendingCount} offline orders to cloud database...</span>
            </div>
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className="underline text-[11px] hover:opacity-80"
            >
              Sync now
            </button>
          </div>
        )}

        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-8 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Navigation */}
      <MobileNavBar />
    </div>
  );
};
