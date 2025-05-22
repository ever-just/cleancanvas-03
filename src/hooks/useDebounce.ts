
import { useState, useEffect } from 'react';

/**
 * A debounce hook that delays updating a value until after a specified delay
 * @param value The value to debounce
 * @param delay The delay in milliseconds (default: 5000ms - 5 seconds)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 5000): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // For text values, use direct comparison instead of JSON.stringify
    const isEqual = typeof value === 'string' && typeof debouncedValue === 'string'
      ? value === debouncedValue
      : JSON.stringify(value) === JSON.stringify(debouncedValue);

    // Only set up the timer if the value changes
    if (!isEqual) {
      const timer = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(timer);
    }
  }, [value, delay, debouncedValue]);

  return debouncedValue;
}
