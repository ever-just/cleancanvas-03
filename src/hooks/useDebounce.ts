
import { useState, useEffect } from 'react';

/**
 * A debounce hook that delays updating a value until after a specified delay
 * @param value The value to debounce
 * @param delay The delay in milliseconds (default: 2000ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 2000): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Only set up the timer if the value changes
    if (JSON.stringify(value) !== JSON.stringify(debouncedValue)) {
      const timer = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(timer);
    }
  }, [value, delay, debouncedValue]);

  return debouncedValue;
}
