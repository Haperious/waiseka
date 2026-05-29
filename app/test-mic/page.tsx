'use client'

import { useState } from 'react'

const LANGS = [
  { code: 'en-US', label: '🇺🇸 en-US' },
  { code: 'en-PH', label: '🇵🇭 en-PH' },
  { code: 'fil-PH', label: '🇵🇭 fil-PH' },
  { code: 'tl-PH', label: '🇵🇭 tl-PH' },
]

export default function TestMicPage() {
  const [lang, setLang] = useState('en-US')
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])
  }

  const handleTest = () => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!Ctor) {
      addLog('ERROR: SpeechRecognition not supported in this browser')
      return
    }

    addLog(`Starting with lang="${lang}"...`)
    const recognition = new Ctor()

    recognition.lang = lang
    recognition.interimResults = false

    recognition.onend = () => addLog('Session ended')

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      const confidence = (e.results[0][0].confidence * 100).toFixed(1)
      addLog(`RESULT: "${transcript}" (${confidence}% confidence)`)
    }

    recognition.onerror = (e) => {
      const err = e as Event & { error?: string; message?: string }
      addLog(`ERROR: ${err.error ?? 'unknown'} — ${err.message ?? 'no message'}`)
    }

    try {
      recognition.start()
      addLog('recognition.start() called')
    } catch (err) {
      addLog(`EXCEPTION: ${err}`)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Mic Language Test</h1>

      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
        Select a language, tap Test, then speak. Check which lang codes work on your device.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: lang === l.code ? '#3b82f6' : '#e2e8f0',
              background: lang === l.code ? '#eff6ff' : '#fff',
              color: lang === l.code ? '#1d4ed8' : '#334155',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleTest}
        style={{
          padding: '14px 28px',
          fontSize: '16px',
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          width: '100%',
          marginBottom: '20px',
        }}
      >
        Test — {lang}
      </button>

      <div style={{ fontSize: '12px', background: '#f1f5f9', borderRadius: '8px', padding: '12px', minHeight: '120px' }}>
        {log.length === 0 ? (
          <span style={{ color: '#94a3b8' }}>Log will appear here...</span>
        ) : (
          log.map((line, i) => (
            <div
              key={i}
              style={{
                marginBottom: '4px',
                color: line.includes('ERROR') || line.includes('EXCEPTION') ? '#dc2626' : line.includes('RESULT') ? '#16a34a' : '#334155',
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => setLog([])}
        style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        Clear log
      </button>
    </div>
  )
}
