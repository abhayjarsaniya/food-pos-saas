import React from 'react';
import { Outlet } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNavBar } from './MobileNavBar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-[#F7F9F7] md:bg-[#F7F9F7] w-full overflow-x-hidden">
      {/* Desktop Fixed Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area - Full width right beside fixed sidebar with md:ml-64 */}
      <div className="flex-1 flex flex-col min-w-0 w-full md:ml-64 pb-24 md:pb-8 overflow-y-auto overflow-x-hidden">
        <main className="flex-1 w-full min-w-0 max-w-none p-3.5 sm:p-5 md:p-6 lg:p-7 xl:p-8 box-border overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Navigation */}
      <MobileNavBar />
    </div>
  );
};
