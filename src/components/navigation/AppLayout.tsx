import React from 'react';
import { Outlet } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNavBar } from './MobileNavBar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-white w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full pb-32 md:pb-8 overflow-y-auto overflow-x-hidden">
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-8 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Navigation */}
      <MobileNavBar />
    </div>
  );
};
