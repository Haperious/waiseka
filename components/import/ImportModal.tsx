'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DropZone from './DropZone'
import ProcessingScreen from './ProcessingScreen'
import ReviewTable from './ReviewTable'
import { useToast } from '@/components/ui/Toast'
import type { ITransaction } from '@/lib/models/Transaction'

type Stage = 'idle' | 'processing' | 'password' | 'review' | 'confirming'
type ProcessStep = 'uploading' | 'extracting' | 'done'

interface ImportUsage {
  count: number | null
  limit: number | null
  resetAt: string | null
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
  isPremium: boolean
}

export default function ImportModal({ open, onClose, onImported, isPremium }: ImportModalProps) {
  const { toast } = useToast()
  const [stage, setStage] = useState<Stage>('idle')
  const [processStep, setProcessStep] = useState<ProcessStep>('uploading')
  const [extracted, setExtracted] = useState<Partial<ITransaction>[]>([])
  const [usage, setUsage] = useState<ImportUsage | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pdfPassword, setPdfPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)

  useEffect(() => {
    if (open) {
      setStage('idle')
      setExtracted([])
      fetchUsage()
    }
  }, [open])

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/import/usage')
      if (res.ok) setUsage(await res.json())
    } catch {
      // non-fatal
    }
  }

  const uploadFile = async (file: File, password?: string) => {
    setStage('processing')
    setProcessStep('uploading')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileType', file.type)
    if (password) formData.append('pdfPassword', password)

    setProcessStep('extracting')

    try {
      const res = await fetch('/api/import/upload', { method: 'POST', body: formData })

      if (res.status === 429) {
        toast('Monthly import limit reached (5/5). Upgrade to Premium for unlimited imports.', 'error')
        setStage('idle')
        return
      }

      if (res.status === 422) {
        const data = await res.json()
        setPendingFile(file)
        setWrongPassword(data.error === 'WRONG_PDF_PASSWORD')
        setStage('password')
        return
      }

      if (!res.ok) {
        const data = await res.json()
        toast(data.error === 'UNSUPPORTED_FILE_TYPE' ? 'Unsupported file type.' : 'Extraction failed.', 'error')
        setStage('idle')
        return
      }

      const { transactions } = await res.json()
      setProcessStep('done')

      if (!transactions || transactions.length === 0) {
        toast('No transactions found in this file.', 'error')
        setStage('idle')
        return
      }

      setExtracted(transactions)
      setStage('review')
    } catch {
      toast('Upload failed. Please try again.', 'error')
      setStage('idle')
    }
  }

  const handleFile = (file: File) => {
    setPdfPassword('')
    setWrongPassword(false)
    uploadFile(file)
  }

  const handlePasswordSubmit = () => {
    if (pendingFile && pdfPassword.trim()) {
      uploadFile(pendingFile, pdfPassword.trim())
    }
  }

  const handleConfirm = async (selected: Partial<ITransaction>[]) => {
    setStage('confirming')

    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: selected }),
      })

      const data = await res.json()
      toast(
        `${data.inserted} transaction${data.inserted !== 1 ? 's' : ''} added${data.skipped > 0 ? `, ${data.skipped} duplicate${data.skipped !== 1 ? 's' : ''} skipped` : ''}.`,
        'success'
      )
      onImported()
      onClose()
    } catch {
      toast('Failed to save transactions.', 'error')
      setStage('review')
    }
  }

  const limitReached = !isPremium && usage?.count != null && usage.count >= (usage.limit ?? 3)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Smart Import"
      description="Upload a bank statement or screenshot to automatically extract transactions."
      className="max-w-2xl"
    >
      {stage === 'idle' && (
        <div className="flex flex-col gap-4">
          {!isPremium && usage?.count != null && (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
              <span>Monthly imports used</span>
              <span className={usage.count >= (usage.limit ?? 3) ? 'font-semibold text-red-500' : 'font-semibold'}>
                {usage.count} / {usage.limit}
              </span>
            </div>
          )}

          {limitReached ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-center">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Monthly limit reached</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Upgrade to Premium for unlimited imports and AI-powered extraction.
              </p>
            </div>
          ) : (
            <DropZone
              onFile={handleFile}
              accept={{ 'application/pdf': ['.pdf'] }}
              label="PDF Statement"
              description="Bank statement in PDF format"
            />
          )}

          {!isPremium && (
            <p className="text-center text-xs text-gray-400">
              Free: up to 5 PDF imports/month.{' '}
              <span className="font-medium text-green-600 dark:text-green-400">
                Upgrade for AI extraction + unlimited imports.
              </span>
            </p>
          )}
        </div>
      )}

      {stage === 'password' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
              {wrongPassword ? 'Incorrect password — try again' : 'This PDF is password protected'}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {wrongPassword
                ? 'The password you entered was incorrect.'
                : 'GCash and some bank PDFs are encrypted. Enter the password to continue (usually your birthday, e.g. 01011990).'}
            </p>
          </div>
          <input
            type="password"
            placeholder="PDF password"
            value={pdfPassword}
            onChange={(e) => setPdfPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 outline-none focus:border-blue-400 dark:focus:border-blue-500"
            autoFocus
          />
          <div className="flex gap-2">
            <Button onClick={() => { setStage('idle'); setPendingFile(null) }} className="flex-1" variant="secondary">
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={!pdfPassword.trim()} className="flex-1">
              Unlock &amp; Extract
            </Button>
          </div>
        </div>
      )}

      {stage === 'processing' && <ProcessingScreen step={processStep} />}

      {(stage === 'review' || stage === 'confirming') && (
        <ReviewTable
          transactions={extracted}
          onConfirm={handleConfirm}
          loading={stage === 'confirming'}
        />
      )}
    </Modal>
  )
}
