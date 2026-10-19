'use client'

import { useState } from 'react'
import { Mic, Plus, X, Search, Pencil, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { useLanguage } from '@/context/LanguageContext'
import { useVoiceKeywords, VoiceKeyword } from '@/hooks/useVoiceKeywords'
import { useCategories } from '@/hooks/useCategories'
import type { SettingsTabProps } from './shared'
import styles from './settings.module.css'

const VOICE_TYPE_OPTIONS = [
  { value: 'any', label: 'Any type' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
]

const voiceTypeBadgeVariant = (type?: string) => {
  if (type === 'income') return 'success'
  if (type === 'expense') return 'danger'
  if (type === 'savings') return 'savings'
  return 'default'
}

export default function VoiceTab({ hidden }: SettingsTabProps) {
  const { t } = useLanguage()
  const { keywords: voiceKeywords, addKeyword: addVoiceKeyword, removeKeyword: removeVoiceKeyword } = useVoiceKeywords()
  const { categories } = useCategories()
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [editingVoiceKeyword, setEditingVoiceKeyword] = useState<string | null>(null)
  const [voiceForm, setVoiceForm] = useState({ keyword: '', category: '', type: 'any' })
  const [voiceFormError, setVoiceFormError] = useState('')

  const voiceCategoryOptions = categories.map((c) => ({ value: c.name, label: c.name }))

  const filteredVoiceKeywords = voiceSearch
    ? voiceKeywords.filter(
        (k) =>
          k.keyword.toLowerCase().includes(voiceSearch.toLowerCase()) ||
          k.category.toLowerCase().includes(voiceSearch.toLowerCase())
      )
    : voiceKeywords

  const openAddVoiceModal = () => {
    setEditingVoiceKeyword(null)
    setVoiceForm({ keyword: '', category: '', type: 'any' })
    setVoiceFormError('')
    setVoiceModalOpen(true)
  }

  const openEditVoiceModal = (kw: VoiceKeyword) => {
    setEditingVoiceKeyword(kw.keyword)
    setVoiceForm({ keyword: kw.keyword, category: kw.category, type: kw.type ?? 'any' })
    setVoiceFormError('')
    setVoiceModalOpen(true)
  }

  const closeVoiceModal = () => {
    setVoiceModalOpen(false)
    setVoiceFormError('')
  }

  const handleVoiceSave = () => {
    const trimmed = voiceForm.keyword.trim()
    if (!trimmed) { setVoiceFormError('Enter a keyword phrase'); return }
    if (!voiceForm.category) { setVoiceFormError('Select a category'); return }
    if (editingVoiceKeyword && editingVoiceKeyword !== trimmed.toLowerCase()) {
      removeVoiceKeyword(editingVoiceKeyword)
    }
    addVoiceKeyword(trimmed, voiceForm.category, (voiceForm.type === 'any' ? undefined : voiceForm.type) as 'income' | 'expense' | 'savings' | undefined)
    setVoiceModalOpen(false)
  }

  const handleVoiceDelete = (keyword: string) => {
    if (!window.confirm(`Delete keyword "${keyword}"?`)) return
    removeVoiceKeyword(keyword)
  }

  return (
    <div className={styles.panelBody} hidden={hidden}>
      <div className={styles.fieldGroup}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <p className={styles.groupLabel} style={{ marginBottom: 4 }}>{t('settings.voiceKeywords')}</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {t('settings.voiceMap')}
            </p>
          </div>
          <Button size="sm" onClick={openAddVoiceModal}>
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t('settings.addVoiceKeyword')}</span>
          </Button>
        </div>

        {voiceKeywords.length > 3 && (
          <div className="relative" style={{ marginBottom: 14 }}>
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
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
            />
            {voiceSearch && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setVoiceSearch('')}
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {voiceKeywords.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <Mic className="h-9 w-9 mx-auto opacity-30" style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>No voice keywords yet.</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Add your first keyword to get started.</p>
          </div>
        ) : filteredVoiceKeywords.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              No results for &ldquo;{voiceSearch}&rdquo;
            </p>
            <button
              className="text-xs underline"
              style={{ color: 'var(--color-accent)', marginTop: 4 }}
              onClick={() => setVoiceSearch('')}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
            {filteredVoiceKeywords.map((kw, i) => (
              <div
                key={kw.keyword}
                className="flex items-center gap-3"
                style={{
                  padding: '12px 16px',
                  borderTop: i !== 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {kw.keyword}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>&rarr;</span>
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {kw.category}
                  </span>
                  {kw.type && (
                    <Badge variant={voiceTypeBadgeVariant(kw.type)}>
                      {kw.type.charAt(0).toUpperCase() + kw.type.slice(1)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditVoiceModal(kw)}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-text-secondary)' }}
                    aria-label="Edit keyword"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleVoiceDelete(kw.keyword)}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-expense)' }}
                    aria-label="Delete keyword"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add/edit modal ───────────────────────────────────────────────── */}
      <Modal
        open={voiceModalOpen}
        onClose={closeVoiceModal}
        title={editingVoiceKeyword ? 'Edit Keyword' : 'New Keyword'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Keyword phrase"
            placeholder="e.g. palabok, rice, coffee"
            value={voiceForm.keyword}
            onChange={(e) => { setVoiceForm({ ...voiceForm, keyword: e.target.value }); setVoiceFormError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVoiceSave() } }}
          />
          <Select
            label="Category"
            value={voiceForm.category}
            onValueChange={(v) => { setVoiceForm({ ...voiceForm, category: v }); setVoiceFormError('') }}
            options={voiceCategoryOptions}
            placeholder="Select category"
          />
          <Select
            label="Transaction type (optional)"
            value={voiceForm.type}
            onValueChange={(v) => setVoiceForm({ ...voiceForm, type: v })}
            options={VOICE_TYPE_OPTIONS}
          />
          {voiceFormError && <p className="text-xs text-red-500">{voiceFormError}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={closeVoiceModal}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleVoiceSave}>
              {editingVoiceKeyword ? 'Save Changes' : 'Add Keyword'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
