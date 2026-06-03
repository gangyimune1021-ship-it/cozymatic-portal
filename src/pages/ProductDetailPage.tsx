import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, Wand2, ZoomIn, X } from 'lucide-react'
import { fetchProductDetail, type ShopifyProduct, type ShopifyStore, getStoreInfo } from '../lib/shopifyApi'
import { createImageGenerationTask } from '../lib/manusApi'
import { createTask } from '../lib/store'
import { cn } from '../lib/utils'
import { toast } from 'sonner'

interface Props {
  store: ShopifyStore
  handle: string
  onBack: () => void
  onTaskCreated: (taskId: string) => void
}

export default function ProductDetailPage({ store, handle, onBack, onTaskCreated }: Props) {
  const [product, setProduct] = useState<ShopifyProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const storeInfo = getStoreInfo(store)

  useEffect(() => {
    fetchProductDetail(store, handle).then(p => {
      setProduct(p)
      setLoading(false)
    })
  }, [store, handle])

  async function handleSubmit() {
    if (!product) return
    setSubmitting(true)
    try {
      const refImageUrls = product.images.slice(0, 8).map(img => img.src)
      const description = product.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || ''

      const manusTaskId = await createImageGenerationTask({
        productTitle: product.title,
        productDescription: description,
        store,
        referenceImageUrls: refImageUrls,
      })

      const task = createTask({
        store,
        productId: product.id,
        productTitle: product.title,
        productHandle: product.handle,
        productImages: refImageUrls,
        manusTaskId,
      })

      toast.success('Image generation task created!')
      onTaskCreated(task.id)
    } catch (e: any) {
      toast.error(`Failed to create task: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-muted-fg)' }} />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: 'var(--color-muted-fg)' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <p style={{ color: 'var(--color-destructive)' }}>Product not found.</p>
      </div>
    )
  }

  const description = product.body_html?.replace(/<[^>]*>/g, '').slice(0, 300) || ''

  return (
    <div className="p-8">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-muted-fg)' }}
      >
        <ArrowLeft size={15} /> Back to Products
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--color-accent)', color: 'var(--color-muted-fg)' }}>
              {storeInfo.flag} {storeInfo.label}
            </span>
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-fg)' }}>{product.title}</h1>
          {description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-fg)' }}>{description}...</p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity flex-shrink-0',
            submitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
          )}
          style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
        >
          {submitting ? (
            <><Loader2 size={15} className="animate-spin" /> Creating Task...</>
          ) : (
            <><Wand2 size={15} /> Generate New Images</>
          )}
        </button>
      </div>

      {/* Image count info */}
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>
          Current Product Images
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--color-muted)', color: 'var(--color-muted-fg)' }}>
          {product.images.length} images
        </span>
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--color-muted-fg)' }}>
        These images will be used as visual reference for AI generation — the AI will study them to match the exact product appearance.
      </p>

      {/* Images grid */}
      {product.images.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-muted-fg)' }}>No images available</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {product.images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setLightbox(img.src)}
              className="group relative aspect-square rounded-xl overflow-hidden border transition-all hover:shadow-md hover:-translate-y-0.5"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-muted)' }}
            >
              <img
                src={img.src}
                alt={img.alt || product.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                <span className="text-white text-xs">{i + 1}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Submit CTA at bottom */}
      {product.images.length > 0 && (
        <div className="mt-8 p-5 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                Ready to generate new images?
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-fg)' }}>
                AI will use all {product.images.length} images above as reference to ensure the generated product matches exactly.
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity flex-shrink-0 ml-4',
                submitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
              )}
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> Creating Task...</>
              ) : (
                <><Wand2 size={15} /> Generate New Images</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
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
