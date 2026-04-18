import { useState, useRef, useEffect } from 'react'

const GREETING = "Hi — I'm Intellix Assist. I can help with Control4 programming, Composer Pro, proposals, client communication, and anything else your team needs. What can I help you with today?"

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: '50%', background: isUser ? '#1d1d1f' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {isUser ? 'You' : 'AI'}
      </div>
      <div style={{ maxWidth: '75%', background: isUser ? '#1d1d1f' : 'var(--bg2)', border: isUser ? 'none' : '1px solid var(--border2)', borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px', padding: '10px 14px', fontSize: 13, color: isUser ? '#fff' : 'var(--text)', lineHeight: 1.6, fontFamily: 'var(--font)', wordBreak: 'break-word' }}>
        {msg.content}
      </div>
    </div>
  )
}

export default function IntelixAssist() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiConnected, setApiConnected] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || ''
    fetch(`${base}/api/assist/status`)
      .then(r => r.ok ? r.json() : { connected: false })
      .then(d => setApiConnected(Boolean(d.connected)))
      .catch(() => setApiConnected(false))
  }, [])

  const send = async (text) => {
    const content = text || input.trim()
    if (!content || loading) return
    setInput('')

    const nextMessages = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const base = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${base}/api/assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      setMessages(m => [...m, { role: 'assistant', content: data.reply || '' }])
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${err.message}`, error: true }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: GREETING }])
  }

  // Chat layout — iMessage-style:
  //  • Outer: flex column, 100% height, background from theme.
  //  • Header: natural size at the top.
  //  • Messages: flex:1 with overflow-y:auto, min-height:0 so it can shrink
  //    when the keyboard collapses the viewport.
  //  • Input: flex-shrink:0 at the bottom. iOS pushes the whole shell up
  //    naturally when the keyboard opens (helped by interactive-widget=
  //    resizes-content on the viewport meta).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Intellix Assist</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, background: apiConnected ? 'rgba(52,199,89,0.09)' : 'rgba(255,149,0,0.09)', border: '1px solid ' + (apiConnected ? 'rgba(52,199,89,0.2)' : 'rgba(255,149,0,0.2)') }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: apiConnected ? '#34c759' : '#ff9500' }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: apiConnected ? '#248a3d' : '#c93400' }}>{apiConnected ? 'Connected' : 'API key needed'}</span>
          </div>
        </div>
        <button onClick={clearChat} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Clear</button>
      </div>

      {apiConnected === false && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(255,149,0,0.06)', borderBottom: '1px solid rgba(255,149,0,0.15)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c93400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: 11.5, color: '#c93400', fontWeight: 500, flex: 1 }}>ANTHROPIC_API_KEY is not set on the backend.</span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px' }}>
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          {loading && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>AI</div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '4px 12px 12px 12px', padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', animation: `bounce 1s ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, background: 'var(--bg2)', borderTop: '1px solid var(--border2)', padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 6px 6px 14px' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message"
            rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font)', lineHeight: 1.4, maxHeight: 140, padding: '6px 0' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg4)', color: input.trim() && !loading ? '#fff' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background 0.15s' }}
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
