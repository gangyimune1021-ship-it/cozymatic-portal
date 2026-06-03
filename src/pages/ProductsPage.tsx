import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchProducts, type ShopifyProductSummary, type ShopifyStore } from '../lib/shopifyApi'
import { cn } from '../lib/utils'

interface Props {
  onSelectProduct: (store: ShopifyStore, handle: string) => void
}

export default function ProductsPage({ onSelectProduct }: Props) {
  const [store, setStore] = useState<ShopifyStore>('hk')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState<ShopifyProductSummary[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (s: ShopifyStore, p: number, q: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchProducts(s, p, q)
      setProducts(res.products)
      setHasMore(res.hasMore)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(store, page, search) }, [store, page, search, load])

  function handleStoreSwitch(s: ShopifyStore) {
    setStore(s)
    setPage(1)
    setSearch('')
    setSearchInput('')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg)' }}>Products</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-fg)' }}>
          Browse products and submit them for AI image generation
        </p>
      </div>

      {/* Store toggle + Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
          {(['hk', 'au'] as ShopifyStore[]).map(s => (
            <button
              key={s}
              onClick={() => handleStoreSwitch(s)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                store === s
                  ? 'text-white'
                  : 'hover:bg-gray-50'
              )}
              style={store === s
                ? { background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }
                : { color: 'var(--color-muted-fg)', background: 'var(--color-card)' }
              }
            >
              {s === 'hk' ? '🇭🇰 Hong Kong' : '🇦🇺 Australia'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-sm flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted-fg)' }} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-card)',
                color: 'var(--color-fg)',
              }}
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-sm rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-muted-fg)' }} />
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <p className="text-sm" style={{ color: 'var(--color-destructive)' }}>{error}</p>
          <button onClick={() => load(store, page, search)} className="mt-3 text-sm underline" style={{ color: 'var(--color-muted-fg)' }}>
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-sm" style={{ color: 'var(--color-muted-fg)' }}>No products found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => onSelectProduct(store, product.handle)}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-sm" style={{ color: 'var(--color-muted-fg)' }}>Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ProductCard({ product, onClick }: { product: ShopifyProductSummary; onClick: () => void }) {
  const [imgError, setImgError] = useState(false)

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl overflow-hidden border transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
    >
      <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--color-muted)' }}>
        {product.imageUrl && !imgError ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={24} style={{ color: 'var(--color-muted-fg)' }} />
          </div>
        )}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-medium bg-black/60 text-white">
          {product.imageCount} imgs
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium leading-tight line-clamp-2" style={{ color: 'var(--color-fg)' }}>
          {product.title}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-fg)' }}>
          ${product.price}
        </p>
      </div>
    </button>
  )
}
