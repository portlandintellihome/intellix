import { useState, useRef, useEffect } from 'react'

const SUGGESTED = [
  { label: 'How do I bind a Lutron RadioRA 3 driver in Composer Pro?', cat: 'Control4' },
  { label: 'What are the steps to connect to Director remotely?', cat: 'Control4' },
  { label: 'How do I set up a Good Morning scene with lighting and thermostat?', cat: 'Control4' },
  { label: 'What is the difference between EA-3 and EA-5?', cat: 'Control4' },
  { label: 'Draft a follow-up email to a client after installation', cat: 'Business' },
  { label: 'What should I include in a scope of work for a full AV job?', cat: 'Business' },
]

const PLACEHOLDER_RESPONSES = {
  default: "Intellix Assist is ready — connect your Anthropic API key in Integrations & APIs to enable AI responses. Once connected, I can help with Control4 programming, Composer Pro, proposals, client communication, and anything else your team needs.",
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: '50%', background: isUser ? '#1d1d1f' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {isUser ? 'You' : 'AI'}
      </div>
      <div style={{ maxWidth: '75%', background: isUser ? '#1d1d1f' : 'var(--bg2)', border: isUser ? 'none' : '1px solid var(--border2)', borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px', padding: '10px 14px', fontSize: 13, color: isUser ? '#fff' : 'var(--text)', lineHeight: 1.6, fontFamily: 'var(--font)' }}>
        {msg.content}
        {msg.typing && <span style={{ display: 'inline-block', animation: 'pulse 1s infinite' }}>▋</span>}
      </div>
    </div>
  )
}

export default function IntelixAssist() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi — I\'m Intellix Assist. I can help with Control4 programming, Composer Pro, proposals, client communication, and anything else your team needs. What can I help you with today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiConnected] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const content = text || input.trim()
    if (!content || loading) return
    setInput('')

    setMessages(m => [...m, { role: 'user', content }])
    setLoading(true)

    await new Promise(r => setTimeout(r, 800))

    setMessages(m => [...m, {
      role: 'assistant',
      content: PLACEHOLDER_RESPONSES.default
    }])
    setLoading(false)
    inputRef.current?.focus()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: 'Hi — I\'m Intellix Assist. I can help with Control4 programming, Composer Pro, proposals, client communication, and anything else your team needs. What can I help you with today?' }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 24px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Intellix Assist</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, background: apiConnected ? 'rgba(52,199,89,0.09)' : 'rgba(255,149,0,0.09)', border: '1px solid ' + (apiConnected ? 'rgba(52,199,89,0.2)' : 'rgba(255,149,0,0.2)') }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: apiConnected ? '#34c759' : '#ff9500' }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: apiConnected ? '#248a3d' : '#c93400' }}>{apiConnected ? 'Connected' : 'API key needed'}</span>
          </div>
        </div>
        <button onClick={clearChat} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Clear chat</button>
      </div>

      {/* API WARNING */}
      {!apiConnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', background: 'rgba(255,149,0,0.06)', borderBottom: '1px solid rgba(255,149,0,0.15)', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c93400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: 11.5, color: '#c93400', fontWeight: 500, flex: 1 }}>Anthropic API key not connected — responses are placeholders. Add your key in <strong>Integrations & APIs</strong> to enable live AI.</span>
        </div>
      )}

      {/* MESSAGES */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {messages.length === 1 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Suggested questions</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SUGGESTED.map((s, i) => (
                  <div key={i} onClick={() => send(s.label)} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.12s' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: s.cat === 'Control4' ? 'var(--accent)' : '#534AB7', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{s.cat}</div>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {/* INPUT */}
      <div style={{ padding: '14px 24px', background: 'var(--bg2)', borderTop: '1px solid var(--border2)', flexShrink: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 8px 8px 14px' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about Control4, Composer Pro, jobs, proposals..."
              rows={1}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: input.trim() && !loading ? '#1d1d1f' : 'var(--bg4)', color: input.trim() && !loading ? '#fff' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'all 0.15s' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>Press Enter to send · Shift + Enter for new line</div>
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