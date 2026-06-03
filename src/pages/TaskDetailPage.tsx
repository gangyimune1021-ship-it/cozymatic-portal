import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft, Loader2, RefreshCw, CheckCircle2, XCircle, ZoomIn, X,
  Upload, Check, Minus
} from 'lucide-react'
import { getTask, updateTask, type PortalTask, type GeneratedImage } from '../lib/store'
import { pollManusTask, confirmManusAction } from '../lib/manusApi'
import { uploadImageToShopify, getStoreInfo } from '../lib/shopifyApi'
import { cn } from '../lib/utils'
import { toast } from 'sonner'

interface Props {
  taskId: string
  onBack: () => void
}

export default function TaskDetailPage({ taskId, onBack }: Props) {
  const [task, setTask] = useState<PortalTask | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    const t = getTask(taskId)
    setTask(t)
    return t
  }, [taskId])

  // Poll Manus task status
  const poll = useCallback(async () => {
    const t = getTask(taskId)
    if (!t || !t.manusTaskId) return
    if (!['pending', 'running', 'waiting'].includes(t.status)) return

    try {
      const result = await pollManusTask(t.manusTaskId)

      // Auto-confirm waiting events
      if (result.agentStatus === 'waiting' && result.waitingEventId) {
        await confirmManusAction(t.manusTaskId, result.waitingEventId)
      }

      // Map Manus status to our status
      let newStatus = t.status
      if (result.agentStatus === 'running') newStatus = 'running'
      else if (result.agentStatus === 'waiting') newStatus = 'waiting'
      else if (result.agentStatus === 'stopped') {
        newStatus = result.imageUrls.length > 0 ? 'completed' : 'failed'
      } else if (result.agentStatus === 'error') {
        newStatus = 'failed'
      }

      // Build generated images list
      const generatedImages: GeneratedImage[] = result.imageUrls.map((url, i) => {
        const existing = t.generatedImages.find(g => g.url === url)
        return existing || {
          url,
          type: i < 4 ? 'scene' : 'white',
          index: i,
          selected: true,
        }
      })

      const updated = updateTask(taskId, {
        status: newStatus,
        generatedImages,
      })
      if (updated) setTask(updated)
    } catch (e) {
      console.error('Poll error:', e)
    }
  }, [taskId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const t = getTask(taskId)
    if (!t) return
    if (['pending', 'running', 'waiting'].includes(t.status)) {
      // Start polling
      poll()
      pollingRef.current = setInterval(poll, 10000)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [taskId, poll])

  function toggleImageSelection(url: string) {
    if (!task) return
    const updated = updateTask(taskId, {
      generatedImages: task.generatedImages.map(img =>
        img.url === url ? { ...img, selected: !img.selected } : img
      )
    })
    if (updated) setTask(updated)
  }

  async function handleApprove() {
    if (!task) return
    const selectedImages = task.generatedImages.filter(img => img.selected)
    if (selectedImages.length === 0) {
      toast.error('Please select at least one image to approve')
      return
    }

    setUploading(true)
    const storeInfo = getStoreInfo(task.store)
    let successCount = 0
    let failCount = 0

    for (const img of selectedImages) {
      const result = await uploadImageToShopify({
        store: task.store,
        productId: task.productId,
        imageUrl: img.url,
        altText: task.productTitle,
      })
      if (result.success) successCount++
      else {
        failCount++
        console.error('Upload failed:', result.error)
      }
    }

    setUploading(false)

    if (successCount > 0) {
      const updated = updateTask(taskId, { status: 'approved' })
      if (updated) setTask(updated)
      toast.success(`${successCount} image${successCount > 1 ? 's' : ''} uploaded to ${storeInfo.label} successfully!`)
    }
    if (failCount > 0) {
      toast.error(`${failCount} image${failCount > 1 ? 's' : ''} failed to upload. Check console for details.`)
    }
  }

  function handleReject() {
    const updated = updateTask(taskId, {
      status: 'rejected',
      rejectionNote: rejectionNote.trim() || undefined,
    })
    if (updated) setTask(updated)
    setShowRejectForm(false)
    toast.info('Task rejected.')
  }

  if (!task) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--color-muted-fg)' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <p style={{ color: 'var(--color-destructive)' }}>Task not found.</p>
      </div>
    )
  }

  const storeInfo = getStoreInfo(task.store)
  const isActive = ['pending', 'running', 'waiting'].includes(task.status)
  const isReviewable = task.status === 'completed'
  const selectedCount = task.generatedImages.filter(g => g.selected).length

  return (
    <div className="p-8">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-muted-fg)' }}
      >
        <ArrowLeft size={15} /> Back to Tasks
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--color-accent)', color: 'var(--color-muted-fg)' }}>
              {storeInfo.flag} {storeInfo.label}
            </span>
            <TaskStatusBadge status={task.status} />
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg)' }}>{task.productTitle}</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-fg)' }}>
            Task ID: {task.id} · Created {new Date(task.createdAt).toLocaleString()}
          </p>
        </div>

        {isActive && (
          <button
            onClick={() => { poll(); refresh() }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-fg)' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        )}
      </div>

      {/* Running state */}
      {isActive && (
        <div className="mb-8 p-5 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
          <div className="flex items-center gap-3">
            <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: 'oklch(0.45 0.15 240)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                {task.status === 'waiting' ? 'AI is waiting for confirmation...' : 'AI is generating images...'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-fg)' }}>
                This typically takes 3–8 minutes. The page auto-refreshes every 10 seconds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Failed state */}
      {task.status === 'failed' && (
        <div className="mb-8 p-5 rounded-xl border" style={{ borderColor: 'oklch(0.85 0.08 25)', background: 'oklch(0.99 0.02 25)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-destructive)' }}>Generation failed</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-fg)' }}>
            The Manus task encountered an error. You can go back to the product and try again.
          </p>
        </div>
      )}

      {/* Rejection note */}
      {task.status === 'rejected' && task.rejectionNote && (
        <div className="mb-8 p-4 rounded-xl border" style={{ borderColor: 'oklch(0.88 0.08 65)', background: 'oklch(0.98 0.03 80)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-warning-fg)' }}>Rejection Note</p>
          <p className="text-sm" style={{ color: 'var(--color-fg)' }}>{task.rejectionNote}</p>
        </div>
      )}

      {/* Side-by-side comparison */}
      {(task.generatedImages.length > 0 || task.productImages.length > 0) && (
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-6">
            {/* Original images */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Original Images</h2>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-muted)', color: 'var(--color-muted-fg)' }}>
                  {task.productImages.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {task.productImages.slice(0, 8).map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightbox(url)}
                    className="group relative aspect-square rounded-lg overflow-hidden border"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted)' }}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generated images */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Generated Images</h2>
                {task.generatedImages.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--color-muted)', color: 'var(--color-muted-fg)' }}>
                    {task.generatedImages.length}
                  </span>
                )}
                {isReviewable && task.generatedImages.length > 0 && (
                  <span className="text-xs ml-auto" style={{ color: 'var(--color-muted-fg)' }}>
                    {selectedCount} selected
                  </span>
                )}
              </div>

              {task.generatedImages.length === 0 ? (
                <div className="aspect-square rounded-lg border flex items-center justify-center"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted)' }}>
                  {isActive ? (
                    <div className="text-center">
                      <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: 'var(--color-muted-fg)' }} />
                      <p className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>Generating...</p>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--color-muted-fg)' }}>No images yet</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {task.generatedImages.map((img, i) => (
                    <div
                      key={i}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        isReviewable
                          ? img.selected
                            ? 'border-green-500 cursor-pointer'
                            : 'border-transparent opacity-60 cursor-pointer hover:opacity-80'
                          : 'border-transparent'
                      )}
                      style={!isReviewable ? { borderColor: 'var(--color-border)' } : undefined}
                      onClick={isReviewable ? () => toggleImageSelection(img.url) : undefined}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />

                      {/* Selection overlay */}
                      {isReviewable && (
                        <div className={cn(
                          'absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                          img.selected ? 'bg-green-500' : 'bg-black/40'
                        )}>
                          {img.selected ? <Check size={11} className="text-white" /> : <Minus size={11} className="text-white" />}
                        </div>
                      )}

                      {/* Type label */}
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-xs bg-black/50 text-white">
                        {img.type === 'scene' ? 'Scene' : 'White BG'}
                      </div>

                      {/* Zoom */}
                      <button
                        className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={e => { e.stopPropagation(); setLightbox(img.url) }}
                      >
                        <ZoomIn size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review actions */}
      {isReviewable && task.generatedImages.length > 0 && (
        <div className="p-5 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-fg)' }}>Review Decision</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-muted-fg)' }}>
            Select the images you want to upload (click to toggle), then approve or reject.
            {selectedCount > 0 && ` ${selectedCount} image${selectedCount > 1 ? 's' : ''} selected for upload.`}
          </p>

          {!showRejectForm ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={uploading || selectedCount === 0}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity',
                  (uploading || selectedCount === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                )}
                style={{ background: 'var(--color-success)', color: 'white' }}
              >
                {uploading ? (
                  <><Loader2 size={15} className="animate-spin" /> Uploading to Shopify...</>
                ) : (
                  <><Upload size={15} /> Approve & Upload to Shopify ({selectedCount})</>
                )}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-gray-50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
              >
                <XCircle size={15} /> Reject
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                placeholder="Add a note for rejection (optional)..."
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-muted)',
                  color: 'var(--color-fg)',
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--color-destructive)' }}
                >
                  <XCircle size={14} /> Confirm Rejection
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-fg)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approved state */}
      {task.status === 'approved' && (
        <div className="p-5 rounded-xl border" style={{ borderColor: 'oklch(0.85 0.08 145)', background: 'oklch(0.97 0.03 145)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
            <p className="text-sm font-medium" style={{ color: 'oklch(0.35 0.15 145)' }}>
              Images uploaded to {storeInfo.label} successfully
            </p>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X size={18} />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: 'oklch(0.52 0.01 240)', bg: 'oklch(0.95 0.003 240)' },
    running: { label: 'Running', color: 'oklch(0.45 0.15 240)', bg: 'oklch(0.94 0.05 240)' },
    waiting: { label: 'Waiting', color: 'oklch(0.55 0.12 65)', bg: 'oklch(0.97 0.05 80)' },
    completed: { label: 'Pending Review', color: 'oklch(0.52 0.15 145)', bg: 'oklch(0.95 0.05 145)' },
    approved: { label: 'Approved', color: 'oklch(0.45 0.15 145)', bg: 'oklch(0.92 0.08 145)' },
    rejected: { label: 'Rejected', color: 'oklch(0.55 0.2 25)', bg: 'oklch(0.97 0.05 25)' },
    failed: { label: 'Failed', color: 'oklch(0.55 0.2 25)', bg: 'oklch(0.97 0.05 25)' },
  }
  const c = config[status] || config.pending
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}
