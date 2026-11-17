'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

const inputClass =
  'min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading placeholder:text-slate-500 transition-shadow duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

export function TextField({
  label,
  id: externalId,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId()
  const id = externalId ?? generatedId
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-heading">
        {label}
      </label>
      <input id={id} className={inputClass} {...props} />
    </div>
  )
}

export function PasswordField({
  label = 'Kata sandi',
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-heading">
        {label}
      </label>
      <div className="relative">
        <input id={id} type={visible ? 'text' : 'password'} className={`${inputClass} pr-14`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-surface hover:text-heading"
        >
          {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          <span className="sr-only">{visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}</span>
        </button>
      </div>
    </div>
  )
}

export const submitClass = buttonVariants({
  variant: 'primary',
  size: 'form',
  className: 'shadow-sm shadow-blue-600/30 transition-colors duration-150 hover:bg-blue-700 disabled:opacity-60',
})
