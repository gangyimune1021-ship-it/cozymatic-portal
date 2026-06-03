/**
 * Shopify API client (browser-side)
 * - Product listing: uses public Storefront JSON API (no auth needed)
 * - Image upload: uses Admin API with stored tokens
 */

export type ShopifyStore = 'hk' | 'au'

const STORES = {
  hk: {
    domain: 'cozymatic.com.hk',
    adminToken: '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',
    label: 'Cozymatic HK',
    flag: '🇭🇰',
  },
  au: {
    domain: 'cozymatic.com.au',
    adminToken: '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',
    label: 'Cozymatic AU',
    flag: '🇦🇺',
  },
}

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  body_html: string
  status: string
  images: Array<{
    id: number
    src: string
    alt: string | null
    position: number
  }>
  variants: Array<{ price: string }>
}

export interface ShopifyProductSummary {
  id: number
  title: string
  handle: string
  price: string
  imageUrl: string
  imageCount: number
  store: ShopifyStore
}

/**
 * Fetch product list using public Storefront JSON API (no auth needed).
 */
export async function fetchProducts(
  store: ShopifyStore,
  page = 1,
  search = ''
): Promise<{ products: ShopifyProductSummary[]; hasMore: boolean }> {
  const { domain } = STORES[store]
  const limit = 24
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
    fields: 'id,title,handle,variants,images',
  })
  if (search) params.set('q', search)

  const url = `https://${domain}/products.json?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`)

  const data = await res.json()
  const products: ShopifyProductSummary[] = (data.products || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    price: p.variants?.[0]?.price || '0',
    imageUrl: p.images?.[0]?.src || '',
    imageCount: p.images?.length || 0,
    store,
  }))

  return { products, hasMore: products.length === limit }
}

/**
 * Fetch full product detail (all images) using public Storefront JSON API.
 */
export async function fetchProductDetail(
  store: ShopifyStore,
  handle: string
): Promise<ShopifyProduct | null> {
  const { domain } = STORES[store]
  const res = await fetch(`https://${domain}/products/${handle}.json`)
  if (!res.ok) return null
  const data = await res.json()
  return data.product || null
}

/**
 * Upload an image URL to a Shopify product's media gallery via Admin API.
 * Uses a CORS proxy since Admin API doesn't allow direct browser calls.
 */
export async function uploadImageToShopify(params: {
  store: ShopifyStore
  productId: number
  imageUrl: string
  altText?: string
}): Promise<{ success: boolean; imageId?: number; error?: string }> {
  const { domain, adminToken } = STORES[params.store]

  // Use allorigins CORS proxy to bypass browser CORS restriction on Admin API
  const adminUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
    `https://${domain}/admin/api/2024-01/products/${params.productId}/images.json`
  )}`

  try {
    const res = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        image: {
          src: params.imageUrl,
          alt: params.altText || '',
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: `Shopify API error ${res.status}: ${err}` }
    }

    const data = await res.json()
    return { success: true, imageId: data.image?.id }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export function getStoreInfo(store: ShopifyStore) {
  return STORES[store]
}
