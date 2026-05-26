'use client'

import { useState } from 'react'
import { Mic, Search, X, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import { useVoiceKeywords, VoiceKeyword } from '@/hooks/useVoiceKeywords'
import { useCategories } from '@/hooks/useCategories'

const TYPE_OPTIONS = [
  { value: 'any', label: 'Any type' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
]

interface EditState {
  keyword: string
  category: string
  type: string
}

export default function VoiceKeywordsPage() {
  const { keywords, addKeyword, removeKeyword } = useVoiceKeywords()
  const { categories } = useCategories()

  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newType, setNewType] = useState('any')
  const [addError, setAddError] = useState('')

  const [editingKeyword, setEditingKeyword] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ keyword: '', category: '', type: 'any' })
  const [editError, setEditError] = useState('')

  const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }))

  const filteredKeywords = searchQuery
    ? keywords.filter(
        (k) =>
          k.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
          k.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : keywords

  const handleAdd = () => {
    const trimmed = newKeyword.trim()
    if (!trimmed) { setAddError('Enter a keyword phrase'); return }
    if (!newCategory) { setAddError('Select a category'); return }
    setAddError('')
    addKeyword(trimmed, newCategory, (newType === 'any' ? undefined : newType) as 'income' | 'expense' | 'savings' | undefined)
    setNewKeyword('')
    setNewCategory('')
    setNewType('any')
    setShowAddForm(false)
  }

  const startEdit = (kw: VoiceKeyword) => {
    setEditingKeyword(kw.keyword)
    setEditState({ keyword: kw.keyword, category: kw.category, type: kw.type ?? 'any' })
    setEditError('')
  }

  const handleEditSave = (originalKeyword: string) => {
    const trimmed = editState.keyword.trim()
    if (!trimmed) { setEditError('Keyword cannot be empty'); return }
    if (!editState.category) { setEditError('Select a category'); return }
    setEditError('')
    removeKeyword(originalKeyword)
    addKeyword(trimmed, editState.category, (editState.type === 'any' ? undefined : editState.type) as 'income' | 'expense' | 'savings' | undefined)
    setEditingKeyword(null)
  }

  const handleDelete = (keyword: string) => {
    if (!window.confirm(`Delete keyword "${keyword}"?`)) return
    removeKeyword(keyword)
  }

  const typeBadgeVariant = (type?: string) => {
    if (type === 'income') return 'success'
    if (type === 'expense') return 'danger'
    if (type === 'savings') return 'savings'
    return 'default'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-elevated)' }}
          >
            <Mic className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Voice Keywords</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Map spoken words to transaction categories
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setShowAddForm((v) => !v); setAddError('') }}>
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Add Keyword</span>
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: 'var(--color-text-muted)' }}
        />
        <input
          className="w-full pl-9 pr-9 h-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}
          placeholder="Search keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setSearchQuery('')}
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>New Keyword</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              label="Keyword phrase"
              placeholder="e.g. palabok, rice, coffee"
              value={newKeyword}
              onChange={(e) => { setNewKeyword(e.target.value); setAddError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            />
            <Select
              label="Category"
              value={newCategory}
              onValueChange={(v) => { setNewCategory(v); setAddError('') }}
              options={categoryOptions}
              placeholder="Select category"
            />
            <Select
              label="Transaction type (optional)"
              value={newType}
              onValueChange={setNewType}
              options={TYPE_OPTIONS}
            />
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAddForm(false); setAddError('') }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAdd}>
                Add Keyword
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyword list */}
      {keywords.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Mic className="h-10 w-10 mx-auto opacity-30" style={{ color: 'var(--color-text-secondary)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No voice keywords yet.</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Add your first keyword to get started.</p>
          </CardContent>
        </Card>
      ) : filteredKeywords.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No results for &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              className="text-xs underline"
              style={{ color: 'var(--color-accent)' }}
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {filteredKeywords.map((kw, i) => (
              <div
                key={kw.keyword}
                className={`px-6 py-4 ${i !== 0 ? 'border-t' : ''}`}
                style={{ borderColor: 'var(--color-border)' }}
              >
                {editingKeyword === kw.keyword ? (
                  <div className="space-y-3">
                    <Input
                      label="Keyword phrase"
                      value={editState.keyword}
                      onChange={(e) => setEditState({ ...editState, keyword: e.target.value })}
                    />
                    <Select
                      label="Category"
                      value={editState.category}
                      onValueChange={(v) => setEditState({ ...editState, category: v })}
                      options={categoryOptions}
                    />
                    <Select
                      label="Transaction type (optional)"
                      value={editState.type}
                      onValueChange={(v) => setEditState({ ...editState, type: v })}
                      options={TYPE_OPTIONS}
                    />
                    {editError && <p className="text-xs text-red-500">{editError}</p>}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingKeyword(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => handleEditSave(kw.keyword)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {kw.keyword}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {kw.category}
                        </span>
                        {kw.type && (
                          <Badge variant={typeBadgeVariant(kw.type)}>
                            {kw.type.charAt(0).toUpperCase() + kw.type.slice(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(kw)}
                        className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-text-secondary)' }}
                        aria-label="Edit keyword"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(kw.keyword)}
                        className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                        style={{ color: '#ef4444' }}
                        aria-label="Delete keyword"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
