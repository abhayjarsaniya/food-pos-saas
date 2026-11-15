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
      <div className="flex-1 flex flex-col min-w-0 max-w-full pb-32 md:pb-8 overflow-y-auto overflow-x-hidden">
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

        {/* Subtle, non-intrusive background sync indicator */}
        {isOnline && isSyncing && (
          <div className="bg-[#145C43] text-white text-[11px] px-3 py-1.5 flex items-center justify-end gap-2 fixed bottom-20 right-4 md:bottom-4 md:right-6 z-40 rounded-full shadow-lg border border-[#19865D] backdrop-blur-md opacity-95 animate-pulse font-medium">
            <RefreshCw className="w-3 h-3 animate-spin text-white" />
            <span>Syncing in background...</span>
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
