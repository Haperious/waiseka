'use client'

import { useRef, useState } from 'react'

export default function TestMicPage() {
  const [log, setLog] = useState<string[]>([])
  const recognitionRef = useRef<unknown>(null)

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])
  }

  const handleTest = () => {
    const SpeechRecognition =
      (window as Window & { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      addLog('ERROR: SpeechRecognition not supported in this browser')
      return
    }

    addLog('Creating recognition instance...')
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang = 'en-US'
    recognition.interimResults = false

    recognition.onstart = () => addLog('Started — speak now')
    recognition.onaudiostart = () => addLog('Audio capture started')
    recognition.onsoundstart = () => addLog('Sound detected')
    recognition.onspeechstart = () => addLog('Speech detected')
    recognition.onspeechend = () => addLog('Speech ended')
    recognition.onaudioend = () => addLog('Audio capture ended')
    recognition.onend = () => addLog('Recognition session ended')

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      const confidence = (e.results[0][0].confidence * 100).toFixed(1)
      addLog(`RESULT: "${transcript}" (${confidence}% confidence)`)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      addLog(`ERROR: ${e.error} — ${e.message || 'no message'}`)
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
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Mic Test</h1>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
        Tap the button below. On iOS, the permission prompt must appear — if it does not, go to{' '}
        <strong>Settings → Safari → Microphone</strong> and set it to &ldquo;Allow&rdquo;.
      </p>

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
        Test Microphone
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
