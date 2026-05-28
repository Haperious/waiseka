'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Tag, Search, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useCategories, type Category } from '@/hooks/useCategories'
import { Skeleton } from '@/components/ui/Skeleton'

const COLORS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e',
  '#ef4444', '#14b8a6', '#f59e0b', '#06b6d4', '#a855f7',
  '#e11d48', '#0ea5e9', '#6b7280',
]

interface FormState {
  name: string
  type: 'income' | 'expense' | 'both'
  color: string
}

const defaultForm = (): FormState => ({ name: '', type: 'expense', color: COLORS[0] })

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-card)',
  borderRadius: 16,
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
}

export default function CategoriesPage() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const { categories, loading, refetch } = useCategories()

  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const TYPE_OPTIONS = [
    { value: 'expense', label: t('common.expense') },
    { value: 'income',  label: t('common.income') },
    { value: 'both',    label: t('cat.both') },
  ]

  const TYPE_LABELS: Record<string, string> = {
    income:  t('common.income'),
    expense: t('common.expense'),
    both:    t('cat.both'),
  }

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
    if (!form.name.trim()) e.name = t('cat.nameRequired')
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

  const filtered = searchQuery
    ? categories.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : categories

  const grouped = {
    expense: filtered.filter((c) => c.type === 'expense'),
    income:  filtered.filter((c) => c.type === 'income'),
    both:    filtered.filter((c) => c.type === 'both'),
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 900,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-playfair), Georgia, serif',
            lineHeight: 1.1,
          }}>
            {t('cat.title')}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {t('cat.subtitle')}
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus style={{ width: 14, height: 14, marginRight: 4 }} />
          <span className="hidden sm:inline">{t('cat.add')}</span>
        </Button>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <Search style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          width: 15, height: 15, color: 'var(--color-text-muted)', pointerEvents: 'none',
        }} />
        <input
          style={{
            width: '100%', height: 42,
            paddingLeft: 38, paddingRight: searchQuery ? 38 : 12,
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-card)',
            color: 'var(--color-text-primary)',
            fontSize: '0.85rem',
            outline: 'none',
            transition: 'border-color 0.15s',
            boxSizing: 'border-box',
          }}
          placeholder={t('cat.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label={t('cat.clearSearch')}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {/* ── Category groups ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={cardStyle}>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
      ) : (
        (['expense', 'income', 'both'] as const).map((type) =>
          grouped[type].length > 0 ? (
            <div key={type} style={cardStyle}>
              {/* Section header */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor:
                    type === 'income'  ? 'var(--color-income)'  :
                    type === 'expense' ? 'var(--color-expense)' :
                    'var(--color-accent)',
                }} />
                <h2 style={{
                  fontSize: '0.78rem', fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {TYPE_LABELS[type]}
                </h2>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  backgroundColor: 'var(--color-elevated)',
                  padding: '1px 7px', borderRadius: 999,
                }}>
                  {grouped[type].length}
                </span>
              </div>

              {/* Category rows */}
              {grouped[type].map((cat, idx) => (
                <div
                  key={cat._id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 20px',
                    borderTop: idx > 0 ? '1px solid var(--color-border)' : 'none',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-elevated)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: cat.color,
                  }} />
                  <Tag style={{ width: 14, height: 14, color: 'var(--color-text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {cat.name}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => openEdit(cat)}
                      aria-label={t('common.edit')}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 30, height: 30, borderRadius: 8,
                        border: 'none', backgroundColor: 'transparent',
                        color: 'var(--color-text-muted)', cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-sage)'
                        e.currentTarget.style.color = 'var(--color-accent)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'var(--color-text-muted)'
                      }}
                    >
                      <Pencil style={{ width: 13, height: 13 }} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deletingId === cat._id}
                      aria-label={t('common.delete')}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 30, height: 30, borderRadius: 8,
                        border: 'none', backgroundColor: 'transparent',
                        color: 'var(--color-text-muted)', cursor: 'pointer',
                        transition: 'all 0.12s',
                        opacity: deletingId === cat._id ? 0.4 : 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-expense-bg)'
                        e.currentTarget.style.color = 'var(--color-expense)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'var(--color-text-muted)'
                      }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null
        )
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!loading && categories.length === 0 && (
        <div style={{
          ...cardStyle,
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            {t('cat.noCategories')}
          </p>
        </div>
      )}

      {/* ── No search results ────────────────────────────────────────────────── */}
      {!loading && categories.length > 0 && filtered.length === 0 && searchQuery && (
        <div style={{
          ...cardStyle,
          padding: '40px 24px',
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
            {t('cat.noResults')} &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            onClick={() => setSearchQuery('')}
            style={{
              fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--color-accent)',
              background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {t('cat.clearSearch')}
          </button>
        </div>
      )}

      {/* ── Add / Edit modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('cat.editTitle') : t('cat.addTitle')}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label={t('cat.name')}
            placeholder="e.g. Groceries"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />
          <Select
            label={t('common.type')}
            value={form.type}
            onValueChange={(v) => setForm({ ...form, type: v as FormState['type'] })}
            options={TYPE_OPTIONS}
          />
          <div>
            <label style={{
              display: 'block', marginBottom: 10,
              fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--color-text-primary)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('cat.color')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    backgroundColor: c,
                    border: 'none', cursor: 'pointer',
                    boxShadow: form.color === c ? `0 0 0 3px var(--color-card), 0 0 0 5px ${c}` : 'none',
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" style={{ flex: 1 }} loading={saving}>
              {editing ? t('cat.update') : t('cat.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
