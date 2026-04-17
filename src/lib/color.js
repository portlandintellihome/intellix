const PALETTE = ['#0066cc', '#34c759', '#534AB7', '#ff9500', '#ff3b30']

export function initialsOf(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function colorForInitials(initials) {
  if (!initials) return 'var(--text2)'
  let h = 0
  for (const c of initials) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
