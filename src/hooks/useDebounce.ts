/**
 * useDebounce
 *
 * Generic hook that delays propagating a value until it has stopped changing
 * for `delay` milliseconds. Used to throttle search queries so that
 * useProductFilter is not called on every keystroke.
 *
 * @param value  The reactive value to debounce.
 * @param delay  Milliseconds of inactivity before the debounced value updates.
 * @returns      The debounced value (lags behind `value` by up to `delay` ms).
 */

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
