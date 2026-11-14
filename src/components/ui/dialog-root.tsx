"use client"

/**
 * `Dialog` and `DialogTrigger` on their own (FA-1.92). A page that only needs the root and the
 * trigger on first paint — the v2 offer's photo cards, whose popup is loaded on demand — imports
 * them from here, so the popup, its backdrop and focus trap in `./dialog` stay out of its
 * first-load JS. `./dialog` re-exports both, so every other caller is unchanged.
 */

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

export { Dialog, DialogTrigger }
