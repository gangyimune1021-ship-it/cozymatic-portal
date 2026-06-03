/**
 * Manus API client (browser-side)
 * Uses the Manus v2 API to create tasks and poll for results.
 */

const MANUS_API_BASE = 'https://api.manus.im/api/v2'
const MANUS_API_KEY = 'sk-2zOWUnvUvnXYBmIOydc61CyyqXbpykiDx2GzX9-nMOay6IUAFQR6GB3LhjIIOG1Ng3Wjr6G8VbUVaTCKgjyAyLfPmQN_'

export type ManusTaskStatus = 'running' | 'waiting' | 'stopped' | 'error'

export interface ManusTaskResult {
  taskId: string
  agentStatus: ManusTaskStatus
  waitingEventId?: string
  waitingEventType?: string
  imageUrls: string[]
  errorMessage?: string
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MANUS_API_KEY}`,
  }
}

/**
 * Create a Manus task to generate product images.
 * Passes product reference images so the AI can match the actual product.
 */
export async function createImageGenerationTask(params: {
  productTitle: string
  productDescription: string
  store: 'hk' | 'au'
  referenceImageUrls: string[]
}): Promise<string> {
  const storeContext = params.store === 'hk'
    ? 'Hong Kong Discovery Bay home interior, modern Hong Kong apartment aesthetic'
    : 'Australian home interior, bright airy Australian living space, est living aesthetic'

  const refImagesText = params.referenceImageUrls.slice(0, 6).map((url, i) =>
    `Reference image ${i + 1}: ${url}`
  ).join('\n')

  const prompt = `You are a professional product photographer. Generate 8 high-quality product images for an e-commerce furniture product.

PRODUCT: ${params.productTitle}
${params.productDescription ? `DESCRIPTION: ${params.productDescription}` : ''}

REFERENCE IMAGES (you MUST study these carefully to match the exact product appearance):
${refImagesText}

CRITICAL REQUIREMENTS:
- The product in ALL generated images MUST be IDENTICAL to the reference images above
- Match the exact color, material, texture, shape, proportions, and design details
- Do NOT change any aspect of the product's appearance

GENERATE EXACTLY 8 IMAGES:
Images 1-4: Scene/lifestyle photos — place the product in a styled ${storeContext}. Show the product in realistic room settings with complementary furniture and decor. High-end editorial photography style.
Images 5-8: White background product shots — clean white background, professional studio lighting, multiple angles (front, 3/4 view, side, detail close-up).

Save all 8 images with clear filenames: scene_1.jpg, scene_2.jpg, scene_3.jpg, scene_4.jpg, white_1.jpg, white_2.jpg, white_3.jpg, white_4.jpg`

  const res = await fetch(`${MANUS_API_BASE}/tasks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prompt }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Manus API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.task_id || data.id || data.taskId
}

/**
 * Poll a Manus task for its current status and any generated images.
 */
export async function pollManusTask(taskId: string): Promise<ManusTaskResult> {
  const res = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
    headers: headers(),
  })

  if (!res.ok) {
    throw new Error(`Poll error ${res.status}`)
  }

  const data = await res.json()

  // Extract agent status
  const agentStatus: ManusTaskStatus = data.agent_status || data.agentStatus || data.status || 'running'

  // Extract waiting event info
  const waitingEventId = data.waiting_event_id || data.waitingEventId
  const waitingEventType = data.waiting_event_type || data.waitingEventType

  // Extract image URLs from task output/files
  const imageUrls: string[] = []

  // Check various possible locations for image URLs
  const outputs = data.outputs || data.files || data.artifacts || []
  for (const output of outputs) {
    const url = output.url || output.file_url || output.download_url
    if (url && /\.(jpg|jpeg|png|webp|gif)/i.test(url)) {
      imageUrls.push(url)
    }
  }

  // Also check messages for image attachments
  const messages = data.messages || []
  for (const msg of messages) {
    const attachments = msg.attachments || msg.files || []
    for (const att of attachments) {
      const url = att.url || att.file_url
      if (url && /\.(jpg|jpeg|png|webp|gif)/i.test(url)) {
        if (!imageUrls.includes(url)) imageUrls.push(url)
      }
    }
  }

  return {
    taskId,
    agentStatus,
    waitingEventId,
    waitingEventType,
    imageUrls,
    errorMessage: data.error_message || data.errorMessage,
  }
}

/**
 * Confirm a waiting Manus action (auto-accept non-critical events).
 */
export async function confirmManusAction(taskId: string, eventId: string): Promise<void> {
  await fetch(`${MANUS_API_BASE}/tasks/${taskId}/events/${eventId}/confirm`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ accept: true }),
  })
}
