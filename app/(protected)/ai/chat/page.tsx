'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useLanguage } from '@/context/LanguageContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AiChatPage() {
  const { t } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [queriesUsed, setQueriesUsed] = useState<number | null>(null)
  const [queriesRemaining, setQueriesRemaining] = useState<number | null>(null)
  const [cap, setCap] = useState(15)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setMessages((prev) => prev.slice(0, -1))
        return
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      setQueriesUsed(data.queriesUsed)
      setQueriesRemaining(data.queriesRemaining)
      if (data.queriesUsed !== null && data.queriesRemaining !== null) {
        setCap(data.queriesUsed + data.queriesRemaining)
      }
    } finally {
      setLoading(false)
    }
  }

  const limitReached = queriesRemaining !== null && queriesRemaining <= 0

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 900,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-playfair), Georgia, serif',
            lineHeight: 1.1,
          }}>
            {t('ai.title')}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {t('ai.subtitle')}
          </p>
        </div>
        {queriesUsed !== null && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 600,
            padding: '4px 12px', borderRadius: 999,
            backgroundColor: 'var(--color-sage)',
            color: 'var(--color-accent)',
            alignSelf: 'flex-start',
            whiteSpace: 'nowrap',
          }}>
            {queriesUsed} / {cap} {t('ai.queriesUsed')}
          </span>
        )}
      </div>

      {/* ── Chat container ───────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--color-card)',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 220px)',
        minHeight: 400,
        overflow: 'hidden',
      }}>
        {/* Messages area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minHeight: 0,
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '40px 24px',
              textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                backgroundColor: 'var(--color-sage)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot style={{ width: 24, height: 24, color: 'var(--color-accent)' }} />
              </div>
              <p style={{
                fontSize: '0.88rem', color: 'var(--color-text-muted)',
                maxWidth: 300, lineHeight: 1.6,
              }}>
                {t('ai.emptyState')}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'var(--color-sage)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot style={{ width: 15, height: 15, color: 'var(--color-accent)' }} />
                </div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                backgroundColor: msg.role === 'user'
                  ? 'var(--color-accent)'
                  : 'var(--color-elevated)',
                color: msg.role === 'user'
                  ? '#fff'
                  : 'var(--color-text-primary)',
              }}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'var(--color-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User style={{ width: 15, height: 15, color: 'var(--color-text-muted)' }} />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start', alignItems: 'flex-end' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                backgroundColor: 'var(--color-sage)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot style={{ width: 15, height: 15, color: 'var(--color-accent)' }} />
              </div>
              <div style={{
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                backgroundColor: 'var(--color-elevated)',
                display: 'flex', gap: 4, alignItems: 'center',
              }}>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="animate-bounce"
                    style={{
                      width: 7, height: 7, borderRadius: '50%',
                      backgroundColor: 'var(--color-text-muted)',
                      display: 'inline-block',
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-card)',
        }}>
          {error && (
            <p style={{
              fontSize: '0.8rem', color: 'var(--color-expense)',
              marginBottom: 8,
            }}>
              {error}
            </p>
          )}
          {limitReached && (
            <p style={{
              fontSize: '0.8rem', color: 'var(--color-warning)',
              marginBottom: 8,
            }}>
              {t('ai.limitReached')}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={input}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) sendMessage()
              }}
              placeholder={limitReached ? t('ai.limitPlaceholder') : t('ai.placeholder')}
              disabled={loading || limitReached}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !input.trim() || limitReached}
              style={{ flexShrink: 0 }}
            >
              <Send style={{ width: 15, height: 15 }} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
