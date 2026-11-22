'use client'

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

export function Tooltip({ children, content }: { children: React.ReactElement; content: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner sideOffset={6} side="top" align="center">
          <TooltipPrimitive.Popup
            className={cn(
              'z-50 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-md',
              'animate-in fade-in-0 zoom-in-95',
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
