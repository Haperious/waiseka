'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { VoiceKeyword } from '@/hooks/useVoiceKeywords'
import { useCategories } from '@/hooks/useCategories'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'

interface VoiceKeywordManagerProps {
  keywords: VoiceKeyword[]
  addKeyword: (keyword: string, category: string) => void
  removeKeyword: (keyword: string) => void
}

export default function VoiceKeywordManager({ keywords, addKeyword, removeKeyword }: VoiceKeywordManagerProps) {
  const { categories } = useCategories()
  const [newKeyword, setNewKeyword] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState('')

  const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }))

  const handleAdd = () => {
    const trimmed = newKeyword.trim()
    if (!trimmed) { setError('Enter a keyword'); return }
    if (!newCategory) { setError('Select a category'); return }
    setError('')
    addKeyword(trimmed, newCategory)
    setNewKeyword('')
    setNewCategory('')
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-3">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
        Custom Voice Keywords
      </p>

      {/* Add row */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            placeholder="e.g. palabok"
            value={newKeyword}
            onChange={(e) => { setNewKeyword(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1">
          <Select
            value={newCategory}
            onValueChange={(v) => { setNewCategory(v); setError('') }}
            options={categoryOptions}
            placeholder="Category"
            className="h-8 text-xs"
          />
        </div>
        <Button type="button" size="sm" onClick={handleAdd} className="shrink-0">
          + Add
        </Button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Keyword list */}
      {keywords.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">No custom keywords yet</p>
      ) : (
        <ul className="space-y-1">
          {keywords.map(({ keyword, category }) => (
            <li
              key={keyword}
              className="flex items-center justify-between rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1.5"
            >
              <span className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-medium">{keyword}</span>
                <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
                {category}
              </span>
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="ml-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors focus-visible:outline-none"
                title={`Remove "${keyword}"`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
