'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useCurrency } from '@/context/CurrencyContext'

interface Goal {
  _id: string
  title: string
  targetAmount: number
  savedAmount: number
  deadline?: string
}

export default function AiGoalCheckPage() {
  const { formatAmount } = useCurrency()
  const [goals, setGoals] = useState<Goal[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [feasible, setFeasible] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/goals')
      .then((r) => r.json())
      .then((data) => {
        const activeGoals = (data.goals ?? data ?? []).filter((g: Goal & { status?: string }) => g.status !== 'completed')
        setGoals(activeGoals)
        if (activeGoals.length > 0) setSelectedGoalId(activeGoals[0]._id)
      })
      .catch(() => {})
  }, [])

  async function checkGoal() {
    if (!selectedGoalId) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setFeasible(null)
    try {
      const res = await fetch('/api/ai/goal-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: selectedGoalId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to analyze goal')
        return
      }
      setAnalysis(data.analysis)
      setFeasible(data.feasible)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goal Feasibility Check</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Analyze whether your goals are achievable on time</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 dark:text-white">Select a Goal</h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {goals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No active goals found. Create a goal first.</p>
          ) : (
            <>
              <select
                value={selectedGoalId}
                onChange={(e) => { setSelectedGoalId(e.target.value); setAnalysis(null); setFeasible(null) }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {goals.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.title} — {formatAmount(g.savedAmount)} / {formatAmount(g.targetAmount)}
                    {g.deadline ? ` (due ${new Date(g.deadline).toLocaleDateString()})` : ''}
                  </option>
                ))}
              </select>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button onClick={checkGoal} disabled={loading || !selectedGoalId} className="self-start">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : 'Check Feasibility'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {feasible ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {feasible ? 'Goal appears feasible' : 'Goal may need adjustments'}
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analysis}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
