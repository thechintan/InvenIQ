import { useState, useEffect } from 'react';

/**
 * A hook that syncs state with sessionStorage for persistent filtering.
 * @param {string} key - Unique key for sessionStorage
 * @param {object} initialValue - The initial filter object
 */
export default function usePersistentFilters(key, initialValue) {
  const [filters, setFilters] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Error reading sessionStorage for', key, err);
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(filters));
    } catch (err) {
      console.error('Error setting sessionStorage for', key, err);
    }
  }, [key, filters]);

  return [filters, setFilters];
}
