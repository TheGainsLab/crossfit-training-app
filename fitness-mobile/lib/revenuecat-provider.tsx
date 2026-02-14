import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

interface RevenueCatState {
  isInitialized: boolean;
  initError: string | null;
  retryInit: () => void;
}

const RevenueCatContext = createContext<RevenueCatState>({
  isInitialized: false,
  initError: null,
  retryInit: () => {},
});

export function useRevenueCat() {
  return useContext(RevenueCatContext);
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const retryCount = useRef(0);

  const initializeRevenueCat = useCallback(async () => {
    try {
      setInitError(null);

      if (Platform.OS === 'ios') {
        await Purchases.configure({
          apiKey: 'appl_umJNBJEnUpZyeMlXteBXflPGrXB',
        });
      } else if (Platform.OS === 'android') {
        await Purchases.configure({
          apiKey: 'goog_RijRQlrMpQARWJGCdKKWulDNfOj',
        });
      }

      setIsInitialized(true);
      retryCount.current = 0;
    } catch (err: any) {
      const message = err?.message || 'Failed to initialize purchases';
      console.error('RevenueCat init failed:', message);
      setInitError(message);
    }
  }, []);

  // Auto-retry with backoff on failure
  useEffect(() => {
    if (initError && retryCount.current < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount.current] || 8000;
      retryCount.current += 1;
      const timer = setTimeout(initializeRevenueCat, delay);
      return () => clearTimeout(timer);
    }
  }, [initError, initializeRevenueCat]);

  // Manual retry (resets counter)
  const retryInit = useCallback(() => {
    retryCount.current = 0;
    initializeRevenueCat();
  }, [initializeRevenueCat]);

  // Initial attempt
  useEffect(() => {
    initializeRevenueCat();
  }, [initializeRevenueCat]);

  return (
    <RevenueCatContext.Provider value={{ isInitialized, initError, retryInit }}>
      {children}
    </RevenueCatContext.Provider>
  );
}
