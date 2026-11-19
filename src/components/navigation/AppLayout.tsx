import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNavBar } from './MobileNavBar';

const PageLoader: React.FC = () => (
  <div className="flex-1 w-full min-h-[50vh] flex flex-col items-center justify-center p-8">
    <div className="w-8 h-8 border-3 border-[#145C43] border-t-transparent rounded-full animate-spin"></div>
    <span className="mt-3 text-xs font-semibold text-[#68736D]">Loading...</span>
  </div>
);

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-[#F7F9F7] md:bg-[#F7F9F7] w-full overflow-x-hidden">
      {/* Desktop Fixed Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area - Full width right beside fixed sidebar with md:ml-64 */}
      <div className="flex-1 flex flex-col min-w-0 w-full md:ml-64 pb-20 md:pb-6 overflow-y-auto overflow-x-hidden">
        <main className="flex-1 w-full min-w-0 max-w-none p-3.5 sm:p-5 md:p-6 box-border overflow-x-hidden">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile Fixed Navigation */}
      <MobileNavBar />
    </div>
  );
};
