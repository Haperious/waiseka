'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function AiRecommendationsPage() {
  const [recommendations, setRecommendations] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queriesUsed, setQueriesUsed] = useState<number | null>(null)

  async function getRecommendations() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/recommendations', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to get recommendations')
        return
      }
      setRecommendations(data.recommendations)
      setQueriesUsed(data.queriesUsed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Savings Recommendations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered tips to increase your savings</p>
        </div>
        {queriesUsed !== null && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            {queriesUsed} queries used this month
          </span>
        )}
      </div>

      {!recommendations ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs">
              Get 3 personalized, actionable ways to increase your savings based on your last 3 months of spending.
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={getRecommendations} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : 'Get Recommendations'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Your Personalized Tips</h2>
              <Button variant="outline" onClick={() => setRecommendations(null)} disabled={loading} className="text-xs px-3 py-1.5">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {recommendations}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
