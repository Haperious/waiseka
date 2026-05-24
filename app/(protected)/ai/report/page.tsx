'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function AiReportPage() {
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ queriesUsed: number; queriesRemaining: number } | null>(null)

  async function generateReport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/report', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate report')
        return
      }
      setReport(data.report)
      setMeta({ queriesUsed: data.queriesUsed, queriesRemaining: data.queriesRemaining })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly Budget Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">AI-generated analysis of your current month</p>
        </div>
        {meta && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            {meta.queriesUsed} / {meta.queriesUsed + meta.queriesRemaining} queries used
          </span>
        )}
      </div>

      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs">
              Generate a personalized monthly budget report with 3 actionable tips based on your spending.
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={generateReport} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : 'Generate Report'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Your Monthly Report</h2>
              <Button variant="outline" onClick={() => setReport(null)} disabled={loading} className="text-xs px-3 py-1.5">
                Regenerate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {report}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
