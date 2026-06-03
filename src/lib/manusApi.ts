/**
 * Manus API client (browser-side)
 * Uses the Manus v2 API to create tasks and poll for results.
 */

const MANUS_API_BASE = 'https://api.manus.ai/v2'
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
    'x-manus-api-key': MANUS_API_KEY,
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

  const res = await fetch(`${MANUS_API_BASE}/task.create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ message: { text: prompt } }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Manus API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  if (!data.ok) throw new Error(data.error?.message || 'Failed to create task')
  return data.task_id || data.id || data.taskId
}

/**
 * Poll a Manus task for its current status and any generated images.
 */
export async function pollManusTask(taskId: string): Promise<ManusTaskResult> {
  const res = await fetch(`${MANUS_API_BASE}/task.listMessages?task_id=${taskId}&order=desc&limit=20`, {
    headers: headers(),
  })

  if (!res.ok) {
    throw new Error(`Poll error ${res.status}`)
  }

  const data = await res.json()
  if (!data.ok) throw new Error(data.error?.message || `Poll error ${res.status}`)

  // Find the latest status_update event
  const messages: Array<Record<string, unknown>> = data.messages || []
  let agentStatus: ManusTaskStatus = 'running'
  let waitingEventId: string | undefined
  let waitingEventType: string | undefined
  let errorMessage: string | undefined

  for (const msg of messages) {
    if (msg.type === 'status_update') {
      const su = msg.status_update as Record<string, unknown>
      agentStatus = (su?.agent_status as ManusTaskStatus) || 'running'
      if (agentStatus === 'waiting') {
        const detail = su?.status_detail as Record<string, unknown>
        waitingEventId = detail?.waiting_for_event_id as string
        waitingEventType = detail?.waiting_for_event_type as string
      }
      if (agentStatus === 'error') {
        errorMessage = su?.error_message as string
      }
      break // desc order, first is latest
    }
  }

  // Extract image URLs from assistant messages and file attachments
  const imageUrls: string[] = []
  for (const msg of messages) {
    // Check content array for image_url items
    const content = (msg.content as Array<Record<string, unknown>>) || []
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === 'image_url') {
          const imgUrl = (item.image_url as Record<string, unknown>)?.url as string
          if (imgUrl && !imageUrls.includes(imgUrl)) imageUrls.push(imgUrl)
        }
      }
    }
    // Check attachments
    const attachments = (msg.attachments as Array<Record<string, unknown>>) || []
    for (const att of attachments) {
      const url = att.url as string || att.file_url as string
      if (url && /\.(jpg|jpeg|png|webp|gif)/i.test(url) && !imageUrls.includes(url)) {
        imageUrls.push(url)
      }
    }
  }

  return {
    taskId,
    agentStatus,
    waitingEventId,
    waitingEventType,
    imageUrls,
    errorMessage,
  }
}

/**
 * Confirm a waiting Manus action (auto-accept non-critical events).
 */
export async function confirmManusAction(taskId: string, eventId: string): Promise<void> {
  await fetch(`${MANUS_API_BASE}/task.confirmAction`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ task_id: taskId, event_id: eventId, input: { accept: true } }),
  })
}
