'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useCategories, type Category } from '@/hooks/useCategories'
import { Skeleton } from '@/components/ui/Skeleton'

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'both', label: 'Both' },
]

const COLORS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e',
  '#ef4444', '#14b8a6', '#f59e0b', '#06b6d4', '#a855f7',
  '#e11d48', '#0ea5e9', '#6b7280',
]

const TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  both: 'Both',
}

interface FormState {
  name: string
  type: 'income' | 'expense' | 'both'
  color: string
}

const defaultForm = (): FormState => ({ name: '', type: 'expense', color: COLORS[0] })

export default function CategoriesPage() {
  const { toast } = useToast()
  const { categories, loading, refetch } = useCategories()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null)
    setForm(defaultForm())
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setForm({ name: cat.name, type: cat.type, color: cat.color })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)

    try {
      const url = editing ? `/api/categories/${editing._id}` : '/api/categories'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error ?? 'Failed to save category', 'error')
      } else {
        toast(editing ? 'Category updated' : 'Category created', 'success')
        setModalOpen(false)
        refetch()
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"? Existing transactions will keep this category name.`)) return
    setDeletingId(cat._id)
    try {
      const res = await fetch(`/api/categories/${cat._id}`, { method: 'DELETE' })
      if (res.ok) {
        toast('Category deleted', 'success')
        refetch()
      } else {
        const data = await res.json()
        toast(data.error ?? 'Failed to delete', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = {
    expense: categories.filter((c) => c.type === 'expense'),
    income: categories.filter((c) => c.type === 'income'),
    both: categories.filter((c) => c.type === 'both'),
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Categories</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Manage your transaction categories
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Add Category</span>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      ) : (
        (['expense', 'income', 'both'] as const).map((type) =>
          grouped[type].length > 0 ? (
            <Card key={type}>
              <CardHeader>
                <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {TYPE_LABELS[type]}
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                {grouped[type].map((cat) => (
                  <div
                    key={cat._id}
                    className="flex items-center gap-3 px-6 py-3 border-t first:border-t-0"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <Tag className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {cat.name}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-text-secondary)' }}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={deletingId === cat._id}
                        className="p-1.5 rounded-lg hover:opacity-70 transition-opacity disabled:opacity-40"
                        style={{ color: '#ef4444' }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null
        )
      )}

      {!loading && categories.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No categories yet. Add your first one.
            </p>
          </CardContent>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g. Groceries"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />
          <Select
            label="Type"
            value={form.type}
            onValueChange={(v) => setForm({ ...form, type: v as FormState['type'] })}
            options={TYPE_OPTIONS}
          />
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: c,
                    boxShadow: form.color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={saving}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
