import React from 'react';
import { Outlet } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNavBar } from './MobileNavBar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-[#F7F9F7] md:bg-[#F7F9F7] w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area - Full width right beside sidebar, zero empty gap */}
      <div className="flex-1 flex flex-col min-w-0 w-full pb-24 md:pb-8 overflow-y-auto overflow-x-hidden">
        <main className="flex-1 w-full min-w-0 max-w-none p-3.5 sm:p-5 md:p-6 lg:p-7 xl:p-8 box-border overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Navigation */}
      <MobileNavBar />
    </div>
  );
};
