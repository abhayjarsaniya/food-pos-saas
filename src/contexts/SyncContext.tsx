import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncManager } from '../services/offline/syncService';

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<{ synced: number; failed: number }>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((status) => {
      setIsOnline(status.online);
      setPendingCount(status.pendingCount);
    });

    return () => unsubscribe();
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncManager.syncPendingOrders();
      return res;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        triggerSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};
