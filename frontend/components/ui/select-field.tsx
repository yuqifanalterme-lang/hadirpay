'use client'

import { useId } from 'react'

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  id: externalId,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  required?: boolean
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}) {
  const generatedId = useId()
  const id = externalId ?? generatedId
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-heading">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className="min-h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-heading focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
