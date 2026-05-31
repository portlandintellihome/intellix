/* eslint-disable react-refresh/only-export-components */
// This module intentionally exports both a hook (usePullToRefresh) and a
// small companion component (PullIndicator); they're always used together.
import { useRef, useState, useCallback } from 'react'
import * as haptics from './haptics'

// Lightweight pull-to-refresh for a scrollable container. Touch-only by
// default (no-op on desktop pointers so normal scroll/overscroll is
// untouched). Spread `handlers` onto the scroll container and render
// <PullIndicator> as its first child.
//
//   const { handlers, pull, refreshing } = usePullToRefresh(reload)
//   <div {...handlers} style={{ overflowY: 'auto' }}>
//     <PullIndicator pull={pull} refreshing={refreshing} />
//     ...list...
//   </div>
export function usePullToRefresh(onRefresh, { threshold = 80, enabled } = {}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const reached = useRef(false)

  const isTouch = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  const active = enabled ?? isTouch

  const onTouchStart = useCallback((e) => {
    if (!active || refreshing) return
    // Only arm when already scrolled to the very top.
    if (e.currentTarget.scrollTop > 0) { startY.current = null; return }
    startY.current = e.touches[0].clientY
    reached.current = false
  }, [active, refreshing])

  const onTouchMove = useCallback((e) => {
    if (startY.current == null || refreshing) return
    if (e.currentTarget.scrollTop > 0) { startY.current = null; setPull(0); return }
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) { setPull(0); return }
    // Rubber-band resistance, capped a bit past the threshold.
    const dist = Math.min(dy * 0.5, threshold * 1.5)
    setPull(dist)
    if (dist >= threshold && !reached.current) {
      reached.current = true
      haptics.light() // "yes, releasing now will refresh"
    } else if (dist < threshold && reached.current) {
      reached.current = false
    }
  }, [refreshing, threshold])

  const onTouchEnd = useCallback(async () => {
    if (startY.current == null) return
    startY.current = null
    if (reached.current && !refreshing) {
      reached.current = false
      setRefreshing(true)
      setPull(threshold)
      try { await onRefresh?.() } finally { setRefreshing(false); setPull(0) }
    } else {
      reached.current = false
      setPull(0)
    }
  }, [refreshing, threshold, onRefresh])

  const handlers = active ? { onTouchStart, onTouchMove, onTouchEnd } : {}
  return { handlers, pull, refreshing, active }
}

// iOS-style spinner that grows/rotates with the pull and spins while
// refreshing. Renders nothing when idle so it never affects layout.
export function PullIndicator({ pull, refreshing, threshold = 80 }) {
  if (!pull && !refreshing) return null
  const progress = Math.min(pull / threshold, 1)
  return (
    <div style={{
      height: refreshing ? 36 : pull,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', transition: refreshing ? 'height 0.2s ease' : 'none',
      pointerEvents: 'none',
    }}>
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="var(--text3)" strokeWidth="2.5" strokeLinecap="round"
        style={{
          opacity: refreshing ? 1 : progress,
          transform: refreshing ? 'none' : `rotate(${progress * 270}deg)`,
          animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
        }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
