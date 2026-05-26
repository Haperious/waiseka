'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export type SpeechLang = 'fil-PH' | 'en-PH'

// Web Speech API types not included in TypeScript's DOM lib
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionResultEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

interface UseSpeechToTextReturn {
  transcript: string
  isListening: boolean
  isSupported: boolean
  error: string | null
  language: SpeechLang
  setLanguage: (lang: SpeechLang) => void
  startListening: () => void
  stopListening: () => void
  clearTranscript: () => void
  clearError: () => void
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<SpeechLang>('fil-PH')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    setIsSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  const buildRecognition = useCallback((): SpeechRecognitionInstance => {
    const Ctor = (window.SpeechRecognition ?? window.webkitSpeechRecognition)!
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = language

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const result = event.results[event.resultIndex]
      if (result.isFinal) {
        setTranscript(result[0].transcript)
      }
      setIsListening(false)
    }

    recognition.onerror = (event: Event) => {
      const errorCode = (event as Event & { error?: string }).error
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        setError('permission-denied')
      } else {
        setError(errorCode ?? 'unknown')
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    return recognition
  }, [language])

  const startListening = useCallback(() => {
    if (!isSupported) return
    recognitionRef.current?.abort()
    setTranscript('')
    const recognition = buildRecognition()
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isSupported, buildRecognition])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return { transcript, isListening, isSupported, error, language, setLanguage, startListening, stopListening, clearTranscript, clearError }
}
