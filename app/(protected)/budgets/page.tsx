'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useBudgets, Budget } from '@/hooks/useBudgets'
import { useCurrency } from '@/context/CurrencyContext'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import BudgetForm from './BudgetForm'

function BudgetProgressBar({ spent, limit }: { spent: number; limit: number }) {
  const percent = Math.min((spent / limit) * 100, 100)
  const color = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={cn('h-2 rounded-full transition-all', color)} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <span className={cn({
          'text-red-600 dark:text-red-400 font-medium': percent >= 90,
          'text-yellow-600 dark:text-yellow-400': percent >= 70 && percent < 90,
          'text-green-600 dark:text-green-400': percent < 70,
        })}>
          {Math.round(percent)}% used
        </span>
        {percent >= 90 && <span className="text-red-500 font-medium">Over budget!</span>}
      </div>
    </div>
  )
}

export default function BudgetsPage() {
  const { formatAmount } = useCurrency()
  const { toast } = useToast()
  const { budgets, loading, deleteBudget, refetch } = useBudgets()
  const [addOpen, setAddOpen] = useState(false)
  const [editBudget, setEditBudget] = useState<Budget | null>(null)
  const [deleteBudgetItem, setDeleteBudgetItem] = useState<Budget | null>(null)

  const handleDelete = async () => {
    if (!deleteBudgetItem) return
    try {
      await deleteBudget(deleteBudgetItem._id)
      toast('Budget deleted', 'success')
      setDeleteBudgetItem(null)
    } catch {
      toast('Failed to delete budget', 'error')
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {budgets.length} budget{budgets.length !== 1 ? 's' : ''} active
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Add Budget</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <p className="text-gray-400 text-sm mb-4">No budgets yet. Create one to start tracking!</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => {
            const percent = Math.min((b.spent / b.limit) * 100, 100)
            return (
              <Card key={b._id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: b.color ? `${b.color}20` : '#3b82f620', border: `2px solid ${b.color ?? '#3b82f6'}` }}
                      >
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: b.color ?? '#3b82f6' }} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{b.category}</p>
                        <Badge variant="default" className="text-xs mt-0.5">{b.period}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditBudget(b)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteBudgetItem(b)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <BudgetProgressBar spent={b.spent} limit={b.limit} />

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Spent</p>
                      <p className={cn('text-lg font-bold', percent >= 90 ? 'text-red-600' : 'text-gray-900 dark:text-white')}>
                        {formatAmount(b.spent)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Limit</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{formatAmount(b.limit)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                      <p className={cn('text-lg font-bold', b.limit - b.spent < 0 ? 'text-red-600' : 'text-green-600')}>
                        {formatAmount(Math.max(b.limit - b.spent, 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Create Budget">
        <BudgetForm onSuccess={() => { setAddOpen(false); refetch() }} onCancel={() => setAddOpen(false)} />
      </Modal>

      <Modal open={!!editBudget} onClose={() => setEditBudget(null)} title="Edit Budget">
        {editBudget && (
          <BudgetForm
            budget={editBudget}
            onSuccess={() => { setEditBudget(null); refetch() }}
            onCancel={() => setEditBudget(null)}
          />
        )}
      </Modal>

      <Modal open={!!deleteBudgetItem} onClose={() => setDeleteBudgetItem(null)} title="Delete Budget">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete the &quot;{deleteBudgetItem?.category}&quot; budget?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteBudgetItem(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
