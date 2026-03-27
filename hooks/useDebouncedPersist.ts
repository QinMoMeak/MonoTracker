import { useEffect, useRef } from 'react';

type IdleCallbackHandle = number;

type PersistOptions<T> = {
  enabled: boolean;
  snapshot: T;
  delay?: number;
  getImageOverrides: () => Record<string, string>;
  persist: (snapshot: T, imageOverrides: Record<string, string>) => Promise<void>;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
};

export const useDebouncedPersist = <T,>({
  enabled,
  snapshot,
  delay = 1600,
  getImageOverrides,
  persist
}: PersistOptions<T>) => {
  const timerRef = useRef<number | null>(null);
  const idleRef = useRef<IdleCallbackHandle | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const cleanup = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const idleWindow = window as IdleWindow;
      if (idleRef.current !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleRef.current);
        idleRef.current = null;
      }
    };

    cleanup();

    timerRef.current = window.setTimeout(() => {
      const run = () => {
        idleRef.current = null;
        void persist(snapshot, getImageOverrides());
      };

      const idleWindow = window as IdleWindow;
      if (idleWindow.requestIdleCallback) {
        idleRef.current = idleWindow.requestIdleCallback(run);
        return;
      }

      timerRef.current = window.setTimeout(run, 0);
    }, delay);

    return cleanup;
  }, [delay, enabled, getImageOverrides, persist, snapshot]);
};
