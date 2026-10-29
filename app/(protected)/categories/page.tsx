'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Segmented from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { useLanguage } from '@/context/LanguageContext'
import { useCategories, type Category } from '@/hooks/useCategories'
import { Skeleton } from '@/components/ui/Skeleton'
import styles from './categories.module.css'

const COLORS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e',
  '#ef4444', '#14b8a6', '#f59e0b', '#06b6d4', '#a855f7',
  '#e11d48', '#0ea5e9', '#6b7280',
]

type CategoryType = Category['type']
type TypeFilter = 'all' | CategoryType

const TYPES: readonly CategoryType[] = ['expense', 'income', 'both']

const TYPE_COLOR: Record<CategoryType, string> = {
  expense: 'var(--color-expense)',
  income:  'var(--color-income)',
  both:    'var(--color-accent)',
}

// Loading placeholder: three groups of pill skeletons with varied widths
const SKELETON_GROUPS = [
  [120, 96, 150, 110, 132, 90, 140, 104],
  [110, 140, 92, 126, 100, 156],
  [130, 100, 118, 144, 96, 112, 160],
]

interface FormState {
  name: string
  type: CategoryType
  color: string
}

const defaultForm = (): FormState => ({ name: '', type: 'expense', color: COLORS[0] })

function Dot({ color, size }: { color: string; size: number }) {
  return <span aria-hidden className={styles.dot} style={{ width: size, height: size, backgroundColor: color }} />
}

export default function CategoriesPage() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const { categories, loading, refetch } = useCategories()

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const TYPE_LABELS: Record<CategoryType, string> = {
    income:  t('common.income'),
    expense: t('common.expense'),
    both:    t('cat.both'),
  }

  const TYPE_OPTIONS = TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }))

  // Filter counts come from all categories, ignoring the search
  const counts = useMemo(() => {
    const c: Record<CategoryType, number> = { expense: 0, income: 0, both: 0 }
    for (const cat of categories) c[cat.type]++
    return c
  }, [categories])

  // Categories matching the search AND the type filter, grouped by type
  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const g: Record<CategoryType, Category[]> = { expense: [], income: [], both: [] }
    for (const cat of categories) {
      if (typeFilter !== 'all' && cat.type !== typeFilter) continue
      if (q && !cat.name.toLowerCase().includes(q)) continue
      g[cat.type].push(cat)
    }
    return g
  }, [categories, searchQuery, typeFilter])

  const visibleTypes = TYPES.filter((type) => grouped[type].length > 0)
  const selected = selectedId ? visibleTypes.flatMap((type) => grouped[type]).find((c) => c._id === selectedId) ?? null : null

  // The selected category was filtered out or deleted: drop the selection so it
  // doesn't pop back when the filter changes again
  if (selectedId && !selected && !loading) setSelectedId(null)

  // Escape clears the selection (the Modal handles its own Escape)
  useEffect(() => {
    if (!selectedId || modalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, modalOpen])

  const filterOptions = [
    { value: 'all', label: <>{t('common.all')}<span className={styles.countLabel}> · {categories.length}</span></> },
    ...TYPES.map((type) => ({
      value: type,
      color: TYPE_COLOR[type],
      label: <>{TYPE_LABELS[type]}<span className={styles.countLabel}> · {counts[type]}</span></>,
    })),
  ]

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
        setSelectedId((id) => (id === cat._id ? null : id))
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

  const toggleSelect = (id: string) => setSelectedId((cur) => (cur === id ? null : id))
  const clearSelection = () => setSelectedId(null)

  const query = searchQuery.trim()

  return (
    <div className={styles.page}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div style={{ minWidth: 0 }}>
          <h1 className={styles.title}>{t('cat.title')}</h1>
          <p className={styles.subtitle}>{t('cat.subtitle')}</p>
        </div>
        <Button onClick={openAdd} size="sm" className={styles.addButton}>
          <Plus aria-hidden style={{ width: 14, height: 14 }} />
          <span className={styles.addLong}>{t('cat.add')}</span>
          <span className={styles.addShort}>{t('cat.addShort')}</span>
        </Button>
      </div>

      {/* ── Toolbar: type filter + search ────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <Segmented
          options={filterOptions}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as TypeFilter)}
          ariaLabel={t('cat.filterLabel')}
        />
        <div className={styles.search}>
          <Search aria-hidden className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('cat.searchPlaceholder')}
            aria-label={t('cat.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={t('cat.clearSearch')}
              className={styles.searchClear}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Chip card ────────────────────────────────────────────────────────── */}
      <div className={styles.card}>
        {loading ? (
          SKELETON_GROUPS.map((widths, g) => (
            <div key={g} className={styles.group} aria-hidden>
              <Skeleton className="h-3 w-24" />
              <div className={styles.chips}>
                {widths.map((w, i) => <Skeleton key={i} className={styles.skeletonPill} style={{ width: w }} />)}
              </div>
            </div>
          ))
        ) : categories.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('cat.noCategories')}</p>
          </div>
        ) : visibleTypes.length === 0 ? (
          <div className={styles.empty}>
            <p>{t('cat.noResults')} &ldquo;{query}&rdquo;</p>
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className={styles.clearLink}>
                {t('cat.clearSearch')}
              </button>
            )}
          </div>
        ) : (
          <>
            {visibleTypes.map((type) => (
              <section key={type} className={styles.group} aria-labelledby={`cat-group-${type}`}>
                <div className={styles.groupHeading}>
                  <span aria-hidden className={styles.groupDot} style={{ backgroundColor: TYPE_COLOR[type] }} />
                  <h2 id={`cat-group-${type}`} className={styles.groupLabel}>{TYPE_LABELS[type]}</h2>
                  <span className={styles.groupCount}>{grouped[type].length}</span>
                </div>
                <div className={styles.chips}>
                  {grouped[type].map((cat) => (
                    <button
                      key={cat._id}
                      type="button"
                      aria-pressed={cat._id === selectedId}
                      className={styles.chip}
                      onClick={() => toggleSelect(cat._id)}
                    >
                      <Dot color={cat.color} size={9} />
                      <span className={styles.chipName}>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {/* Room so the floating selection bar never covers the last row (desktop) */}
            {selected && <div aria-hidden className={styles.barSpacer} />}
          </>
        )}
      </div>

      {/* ── Selection: floating bar (desktop) / bottom sheet (mobile) ────────── */}
      {selected && (
        <>
          <div role="region" aria-label={selected.name} className={styles.bar}>
            <Dot color={selected.color} size={10} />
            <div className={styles.barInfo}>
              <span className={styles.barName}>{selected.name}</span>
              <span className={styles.barType}>{TYPE_LABELS[selected.type]}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => openEdit(selected)}>
              {t('common.edit')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deletingId === selected._id}
              onClick={() => handleDelete(selected)}
            >
              {t('common.delete')}
            </Button>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={clearSelection}
              className={`${styles.iconButton} ${styles.barClose}`}
            >
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          <div aria-hidden className={styles.backdrop} onClick={clearSelection} />
          <div role="dialog" aria-label={selected.name} className={styles.sheet}>
            <div aria-hidden className={styles.handle} />
            <div className={styles.sheetInfo}>
              {/* ~14% alpha tint of the category colour (category colours are #rrggbb) */}
              <div aria-hidden className={styles.sheetTile} style={{ backgroundColor: `${selected.color}24` }}>
                <Dot color={selected.color} size={14} />
              </div>
              <div className={styles.sheetText}>
                <span className={styles.sheetName}>{selected.name}</span>
                <span className={styles.sheetType}>{TYPE_LABELS[selected.type]}</span>
              </div>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={clearSelection}
                className={`${styles.iconButton} ${styles.sheetClose}`}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className={styles.sheetActions}>
              <Button
                variant="danger"
                className={styles.sheetButton}
                loading={deletingId === selected._id}
                onClick={() => handleDelete(selected)}
              >
                {t('common.delete')}
              </Button>
              <Button
                className={styles.sheetButton}
                onClick={() => {
                  // Close the sheet so it isn't left sitting under the modal
                  clearSelection()
                  openEdit(selected)
                }}
              >
                {t('common.edit')}
              </Button>
            </div>
          </div>
        </>
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
