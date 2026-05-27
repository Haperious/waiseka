'use client'

import { useCallback } from 'react'
import { useDropzone, type Accept } from 'react-dropzone'
import { Upload, FileText, Image, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropZoneProps {
  onFile: (file: File) => void
  accept: Accept
  label: string
  description?: string
  locked?: boolean
  disabled?: boolean
}

export default function DropZone({ onFile, accept, label, description, locked, disabled }: DropZoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0])
    },
    [onFile]
  )

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    disabled: disabled || locked,
  })

  const acceptedFile = acceptedFiles[0]
  const isPDF = Object.keys(accept)[0] === 'application/pdf'

  return (
    <div className="relative">
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          isDragActive
            ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
          (disabled || locked) && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} />
        {isPDF ? (
          <FileText className="h-8 w-8 text-gray-400" />
        ) : (
          <Image className="h-8 w-8 text-gray-400" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        {acceptedFile ? (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
            {acceptedFile.name} ({(acceptedFile.size / 1024).toFixed(1)} KB)
          </p>
        ) : (
          <p className="text-xs text-gray-400">
            {isDragActive ? 'Drop here' : 'Drag & drop or click to browse'}
          </p>
        )}
      </div>

      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-gray-900/60 backdrop-blur-[2px]">
          <Lock className="h-5 w-5 text-white" />
          <p className="text-xs font-semibold text-white">Premium only</p>
        </div>
      )}
    </div>
  )
}
