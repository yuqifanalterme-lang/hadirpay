'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Dialog({
  open,
  onOpenChange,
  label,
  children,
  size = 'md',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  children: React.ReactNode
  size?: 'md' | 'lg' | 'drawer'
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialogRef.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onOpenChange(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onOpenChange(false)
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
      className={
        size === 'drawer'
          ? 'fixed inset-y-0 right-0 m-0 h-dvh max-h-dvh w-full max-w-2xl overflow-y-auto rounded-l-2xl border-y-0 border-r-0 border-l border-border bg-white p-0 text-foreground shadow-lg backdrop:bg-navy/50'
          : `fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-border bg-white p-0 text-foreground shadow-lg backdrop:bg-navy/50 ${
              size === 'lg' ? 'max-w-2xl' : 'max-w-xl'
            }`
      }
    >
      {children}
    </dialog>
  )
}

export function DialogHeader({
  title,
  description,
  onClose,
}: {
  title: string
  description?: string
  onClose: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-heading">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Tutup dialog"
        className="min-h-11 min-w-11 rounded-full"
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse justify-end gap-3 border-t border-border p-5 sm:flex-row sm:p-6">{children}</div>
}
