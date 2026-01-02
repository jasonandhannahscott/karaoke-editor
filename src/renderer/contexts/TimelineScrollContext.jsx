import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store';

const TimelineScrollContext = createContext(null);

export function TimelineScrollProvider({ children }) {
  const scrollContainersRef = useRef(new Map());
  const isScrollingRef = useRef(false);
  const { setTimelineScrollLeft, timelineScrollLeft, zoom, duration, songData } = useStore();
  
  const effectiveDuration = songData?.duration || duration || 0;
  
  // Register a scroll container
  const registerScrollContainer = useCallback((id, element) => {
    if (element) {
      scrollContainersRef.current.set(id, element);
      // Sync initial scroll position
      element.scrollLeft = timelineScrollLeft;
    }
  }, [timelineScrollLeft]);
  
  // Unregister a scroll container
  const unregisterScrollContainer = useCallback((id) => {
    scrollContainersRef.current.delete(id);
  }, []);
  
  // Sync all containers to a given scroll position
  const syncAllContainers = useCallback((scrollLeft, sourceId) => {
    if (isScrollingRef.current) return;
    
    isScrollingRef.current = true;
    
    scrollContainersRef.current.forEach((element, id) => {
      if (id !== sourceId && element) {
        element.scrollLeft = scrollLeft;
      }
    });
    
    // Update store (debounced effect will handle this)
    setTimelineScrollLeft(scrollLeft);
    
    // Reset flag after a short delay to prevent feedback loops
    requestAnimationFrame(() => {
      isScrollingRef.current = false;
    });
  }, [setTimelineScrollLeft]);
  
  // Handle scroll event from any container
  const handleScroll = useCallback((sourceId) => (e) => {
    const scrollLeft = e.target.scrollLeft;
    syncAllContainers(scrollLeft, sourceId);
  }, [syncAllContainers]);
  
  // Calculate total timeline width
  const getTotalWidth = useCallback(() => {
    return effectiveDuration > 0 ? effectiveDuration * zoom : 800;
  }, [effectiveDuration, zoom]);
  
  // Sync scroll when zoom changes
  useEffect(() => {
    const currentScroll = timelineScrollLeft;
    scrollContainersRef.current.forEach((element) => {
      if (element) {
        element.scrollLeft = currentScroll;
      }
    });
  }, [zoom, timelineScrollLeft]);
  
  const value = {
    registerScrollContainer,
    unregisterScrollContainer,
    handleScroll,
    getTotalWidth,
    scrollLeft: timelineScrollLeft
  };
  
  return (
    <TimelineScrollContext.Provider value={value}>
      {children}
    </TimelineScrollContext.Provider>
  );
}

export function useTimelineScroll() {
  const context = useContext(TimelineScrollContext);
  if (!context) {
    throw new Error('useTimelineScroll must be used within a TimelineScrollProvider');
  }
  return context;
}

// Custom hook for registering a scroll container
export function useScrollContainer(id) {
  const { registerScrollContainer, unregisterScrollContainer, handleScroll, getTotalWidth, scrollLeft } = useTimelineScroll();
  const containerRef = useRef(null);
  
  useEffect(() => {
    const element = containerRef.current;
    if (element) {
      registerScrollContainer(id, element);
      
      const scrollHandler = handleScroll(id);
      element.addEventListener('scroll', scrollHandler, { passive: true });
      
      return () => {
        element.removeEventListener('scroll', scrollHandler);
        unregisterScrollContainer(id);
      };
    }
  }, [id, registerScrollContainer, unregisterScrollContainer, handleScroll]);
  
  return {
    containerRef,
    totalWidth: getTotalWidth(),
    scrollLeft
  };
}
