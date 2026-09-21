'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteInquiry } from '@/actions/inquiries'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  inquiryId:  string
  anglerName: string
}

export function DeleteInquiryButton({ inquiryId, anglerName }: Props) {
  const router = useRouter()
  const [open,     setOpen    ] = useState(false)
  const [error,    setError   ] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  function handleDelete() {
    startDelete(async () => {
      setError(null)
      const res = await deleteInquiry(inquiryId)
      if (!res.success) {
        setError(res.error ?? 'Failed to delete')
      } else {
        setOpen(false)
        router.push('/admin/inquiries')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm" className="w-full">
            <Trash2 className="mr-2 size-3.5" />
            Delete inquiry
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete inquiry?</DialogTitle>
          <DialogDescription>
            <strong>{anglerName}</strong> and all associated messages, notes, and data will be permanently deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error != null && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, delete forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
