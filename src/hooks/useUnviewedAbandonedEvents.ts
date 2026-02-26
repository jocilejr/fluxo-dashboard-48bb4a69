import { useMemo, useEffect, useState } from "react";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

interface AbandonedEvent {
  id: string;
  created_at: string;
}

const VIEWED_ABANDONED_KEY = "viewed_abandoned_events";

export function useUnviewedAbandonedEvents(events: AbandonedEvent[]) {
  const [viewedIds, setViewedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(VIEWED_ABANDONED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Listen for localStorage changes
  useEffect(() => {
    let lastRaw = localStorage.getItem(VIEWED_ABANDONED_KEY);
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem(VIEWED_ABANDONED_KEY);
        if (raw === lastRaw) return; // skip redundant setState
        lastRaw = raw;
        if (raw) {
          setViewedIds(JSON.parse(raw));
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(handleStorageChange, 1000);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Filter events by "today"
  const todayEvents = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    
    return events.filter((e) => {
      const date = new Date(e.created_at);
      return isWithinInterval(date, { start: todayStart, end: todayEnd });
    });
  }, [events]);

  // Calculate unviewed count
  const unviewedCount = useMemo(() => {
    const todayIds = todayEvents.map(e => e.id);
    return todayIds.filter(id => !viewedIds.includes(id)).length;
  }, [todayEvents, viewedIds]);

  return unviewedCount;
}

// Function to mark abandoned events as viewed
export function markAbandonedEventsAsViewed(eventIds: string[]) {
  try {
    const stored = localStorage.getItem(VIEWED_ABANDONED_KEY);
    const current = stored ? JSON.parse(stored) : [];
    const updated = [...new Set([...current, ...eventIds])];
    localStorage.setItem(VIEWED_ABANDONED_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
