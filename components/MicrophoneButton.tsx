'use client'

import { useState, useEffect } from 'react'
import { Mic, Square, Loader2, Settings } from 'lucide-react'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import { useVoiceKeywords } from '@/hooks/useVoiceKeywords'
import { parseSpeechToTransaction, ParsedTransaction } from '@/lib/parseSpeechToTransaction'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import VoiceKeywordManager from '@/components/VoiceKeywordManager'

interface MicrophoneButtonProps {
  onFill: (data: Partial<{ type: 'income' | 'expense'; amount: number; category: string; description: string }>) => void
}

type UIState = 'idle' | 'listening' | 'processing' | 'preview' | 'error'

export default function MicrophoneButton({ onFill }: MicrophoneButtonProps) {
  const { transcript, isListening, isSupported, language, setLanguage, startListening, stopListening, clearTranscript } =
    useSpeechToText()
  const { keywords, addKeyword, removeKeyword } = useVoiceKeywords()

  const [uiState, setUiState] = useState<UIState>('idle')
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null)
  const [showKeywordManager, setShowKeywordManager] = useState(false)

  // When transcript arrives, parse it
  useEffect(() => {
    if (!transcript) return
    setUiState('processing')
    const result = parseSpeechToTransaction(transcript, keywords)
    if (result.type || result.amount || result.category) {
      setParsed(result)
      setUiState('preview')
    } else {
      setUiState('error')
    }
  }, [transcript]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep uiState in sync with isListening
  useEffect(() => {
    if (isListening) setUiState('listening')
  }, [isListening])

  if (!isSupported) return null

  const isFil = language === 'fil-PH'

  const handleMicClick = () => {
    if (uiState === 'listening') {
      stopListening()
      setUiState('idle')
    } else {
      clearTranscript()
      setParsed(null)
      setUiState('idle')
      startListening()
    }
  }

  const handleConfirm = () => {
    if (!parsed) return
    onFill({
      ...(parsed.type && { type: parsed.type }),
      ...(parsed.amount !== undefined && { amount: parsed.amount }),
      ...(parsed.category && { category: parsed.category }),
      ...(parsed.description && { description: parsed.description }),
    })
    setParsed(null)
    clearTranscript()
    setUiState('idle')
  }

  const handleRetry = () => {
    setParsed(null)
    clearTranscript()
    setUiState('idle')
  }

  const formatSummary = (p: ParsedTransaction) => {
    const parts: string[] = []
    if (p.type) parts.push(p.type === 'expense' ? (isFil ? 'Gastos' : 'Expense') : (isFil ? 'Kita' : 'Income'))
    if (p.amount !== undefined) parts.push(`₱${p.amount.toLocaleString()}`)
    if (p.category) parts.push(isFil ? `sa ${p.category}` : `on ${p.category}`)
    return parts.join(' ')
  }

  return (
    <div className="space-y-2">
      {/* Mic row */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex-1">
          {isFil ? 'Input ng boses' : 'Voice input'}
        </span>

        {/* Language toggle */}
        <button
          type="button"
          onClick={() => setLanguage(isFil ? 'en-PH' : 'fil-PH')}
          className="text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          title={isFil ? 'Switch to English' : 'Palitan ng Filipino'}
        >
          {isFil ? '🇵🇭 FIL' : 'ENG'}
        </button>

        {/* Microphone button */}
        <div className="relative">
          {uiState === 'listening' && (
            <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-60" />
          )}
          <button
            type="button"
            onClick={handleMicClick}
            title={isFil ? 'Mag-record ng boses' : 'Record voice'}
            className={[
              'relative h-9 w-9 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              uiState === 'listening'
                ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
            ].join(' ')}
          >
            {uiState === 'processing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : uiState === 'listening' ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Keyword manager toggle */}
        <button
          type="button"
          onClick={() => setShowKeywordManager((v) => !v)}
          title={isFil ? 'Pamahalaan ang mga keyword' : 'Manage keywords'}
          className={[
            'h-9 w-9 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            showKeywordManager
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
          ].join(' ')}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Keyword manager panel */}
      {showKeywordManager && (
        <VoiceKeywordManager keywords={keywords} addKeyword={addKeyword} removeKeyword={removeKeyword} />
      )}

      {/* Error state */}
      {uiState === 'error' && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
          <p className="text-xs text-red-600 dark:text-red-400">
            {isFil ? 'Hindi ko naintindihan. Subukan ulit.' : "Couldn't understand — please try again."}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-xs text-red-600 dark:text-red-400 underline ml-2"
          >
            {isFil ? 'Ulitin' : 'Retry'}
          </button>
        </div>
      )}

      {/* Confirmation preview */}
      {uiState === 'preview' && parsed && (
        <Card>
          <CardContent className="py-3 px-4 space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {isFil
                ? `Narinig ko: ${formatSummary(parsed)} — Tama ba ito?`
                : `I heard: ${formatSummary(parsed)} — is this correct?`}
            </p>
            {parsed.description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic truncate">&ldquo;{parsed.description}&rdquo;</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" onClick={handleConfirm} className="flex-1">
                {isFil ? 'Oo, I-save' : 'Yes, Save'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleRetry} className="flex-1">
                {isFil ? 'Hindi, Ulitin' : 'No, Retry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
