'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2, PlusCircle, Calendar, Flag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useGoals, Goal } from '@/hooks/useGoals'
import { useCurrency } from '@/context/CurrencyContext'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import GoalForm from './GoalForm'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  high: 'text-red-600 dark:text-red-400',
}

export default function GoalsPage() {
  const { formatAmount } = useCurrency()
  const { toast } = useToast()
  const { goals, loading, deleteGoal, addFunds, refetch } = useGoals()
  const [addOpen, setAddOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [deleteGoalItem, setDeleteGoalItem] = useState<Goal | null>(null)
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null)
  const [fundsAmount, setFundsAmount] = useState('')
  const [fundsLoading, setFundsLoading] = useState(false)

  const handleDelete = async () => {
    if (!deleteGoalItem) return
    try {
      await deleteGoal(deleteGoalItem._id)
      toast('Goal deleted', 'success')
      setDeleteGoalItem(null)
    } catch {
      toast('Failed to delete goal', 'error')
    }
  }

  const handleAddFunds = async () => {
    if (!addFundsGoal || !fundsAmount || isNaN(Number(fundsAmount))) return
    setFundsLoading(true)
    try {
      await addFunds(addFundsGoal._id, Number(fundsAmount))
      toast(`${formatAmount(Number(fundsAmount))} added to "${addFundsGoal.title}"`, 'success')
      setAddFundsGoal(null)
      setFundsAmount('')
    } catch {
      toast('Failed to add funds', 'error')
    } finally {
      setFundsLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Goals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {goals.filter((g) => g.status === 'active').length} active goal(s)
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">New Goal</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <p className="text-gray-400 text-sm mb-4">No goals yet. Set your first financial goal!</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const progress = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0
            const remaining = goal.targetAmount - goal.savedAmount
            const isCompleted = goal.status === 'completed'

            return (
              <Card key={goal._id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{goal.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant={goal.status as 'active' | 'completed' | 'paused'}>
                          {goal.status}
                        </Badge>
                        <span className={cn('flex items-center gap-1 text-xs font-medium capitalize', PRIORITY_COLORS[goal.priority])}>
                          <Flag className="h-3 w-3" />
                          {goal.priority}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => setEditGoal(goal)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteGoalItem(goal)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Circular-style progress */}
                  <div className="flex items-center justify-center py-2">
                    <div className="relative w-24 h-24">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-gray-200 dark:stroke-gray-700" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          strokeWidth="8"
                          stroke={isCompleted ? '#22c55e' : '#3b82f6'}
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Saved</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatAmount(goal.savedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Target</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatAmount(goal.targetAmount)}</span>
                    </div>
                    {remaining > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Remaining</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{formatAmount(remaining)}</span>
                      </div>
                    )}
                    {goal.deadline && (
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 pt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-xs">{format(new Date(goal.deadline), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  {!isCompleted && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setAddFundsGoal(goal)}
                    >
                      <PlusCircle className="h-4 w-4 mr-1.5" />
                      Add Funds
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Create Goal">
        <GoalForm onSuccess={() => { setAddOpen(false); refetch() }} onCancel={() => setAddOpen(false)} />
      </Modal>

      <Modal open={!!editGoal} onClose={() => setEditGoal(null)} title="Edit Goal">
        {editGoal && (
          <GoalForm
            goal={editGoal}
            onSuccess={() => { setEditGoal(null); refetch() }}
            onCancel={() => setEditGoal(null)}
          />
        )}
      </Modal>

      <Modal open={!!addFundsGoal} onClose={() => setAddFundsGoal(null)} title={`Add Funds to "${addFundsGoal?.title}"`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current: {formatAmount(addFundsGoal?.savedAmount ?? 0)} / {formatAmount(addFundsGoal?.targetAmount ?? 0)}
          </p>
          <Input
            label="Amount to Add"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={fundsAmount}
            onChange={(e) => setFundsAmount(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAddFundsGoal(null)}>Cancel</Button>
            <Button className="flex-1" loading={fundsLoading} onClick={handleAddFunds}>Add Funds</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteGoalItem} onClose={() => setDeleteGoalItem(null)} title="Delete Goal">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Delete &quot;{deleteGoalItem?.title}&quot;? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteGoalItem(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
