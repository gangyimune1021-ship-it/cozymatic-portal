/**
 * Local state store using localStorage.
 * Since this is a static app with no backend, we persist task state in the browser.
 * This means tasks are per-device, which is acceptable for a small team tool.
 */

export type TaskStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'approved' | 'rejected'

export interface GeneratedImage {
  url: string
  type: 'scene' | 'white'
  index: number
  selected: boolean
}

export interface PortalTask {
  id: string
  store: 'hk' | 'au'
  productId: number
  productTitle: string
  productHandle: string
  productImages: string[]  // original product image URLs
  manusTaskId?: string
  status: TaskStatus
  generatedImages: GeneratedImage[]
  rejectionNote?: string
  createdAt: number
  updatedAt: number
  uploadedImageIds?: number[]
}

const STORAGE_KEY = 'cozymatic_portal_tasks'

export function loadTasks(): PortalTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveTasks(tasks: PortalTask[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

export function createTask(params: Omit<PortalTask, 'id' | 'status' | 'generatedImages' | 'createdAt' | 'updatedAt'>): PortalTask {
  const task: PortalTask = {
    ...params,
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    generatedImages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const tasks = loadTasks()
  tasks.unshift(task)
  saveTasks(tasks)
  return task
}

export function updateTask(id: string, updates: Partial<PortalTask>): PortalTask | null {
  const tasks = loadTasks()
  const idx = tasks.findIndex(t => t.id === id)
  if (idx === -1) return null
  tasks[idx] = { ...tasks[idx], ...updates, updatedAt: Date.now() }
  saveTasks(tasks)
  return tasks[idx]
}

export function getTask(id: string): PortalTask | null {
  return loadTasks().find(t => t.id === id) || null
}

export function deleteTask(id: string): void {
  saveTasks(loadTasks().filter(t => t.id !== id))
}
