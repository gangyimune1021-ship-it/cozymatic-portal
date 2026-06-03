import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, Clock, XCircle, AlertCircle, Hourglass, ThumbsUp } from 'lucide-react'
import { loadTasks, type PortalTask, type TaskStatus } from '../lib/store'
import { cn } from '../lib/utils'

interface Props {
  onSelectTask: (taskId: string) => void
}

const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
]

function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
    pending: { icon: <Clock size={12} />, label: 'Pending', color: 'oklch(0.52 0.01 240)', bg: 'oklch(0.95 0.003 240)' },
    running: { icon: <Loader2 size={12} className="animate-spin" />, label: 'Running', color: 'oklch(0.45 0.15 240)', bg: 'oklch(0.94 0.05 240)' },
    waiting: { icon: <Hourglass size={12} />, label: 'Waiting', color: 'oklch(0.55 0.12 65)', bg: 'oklch(0.97 0.05 80)' },
    completed: { icon: <AlertCircle size={12} />, label: 'Pending Review', color: 'oklch(0.52 0.15 145)', bg: 'oklch(0.95 0.05 145)' },
    approved: { icon: <ThumbsUp size={12} />, label: 'Approved', color: 'oklch(0.45 0.15 145)', bg: 'oklch(0.92 0.08 145)' },
    rejected: { icon: <XCircle size={12} />, label: 'Rejected', color: 'oklch(0.55 0.2 25)', bg: 'oklch(0.97 0.05 25)' },
    failed: { icon: <AlertCircle size={12} />, label: 'Failed', color: 'oklch(0.55 0.2 25)', bg: 'oklch(0.97 0.05 25)' },
  }
  const c = config[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: c.color, background: c.bg }}>
      {c.icon} {c.label}
    </span>
  )
}

export default function TasksPage({ onSelectTask }: Props) {
  const [tasks, setTasks] = useState<PortalTask[]>([])
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

  function refresh() {
    setTasks(loadTasks())
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-fg)' }}>Tasks</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted-fg)' }}>
            Track image generation jobs and review results
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-fg)' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {STATUS_TABS.map(tab => {
          const count = tab.value === 'all' ? tasks.length : tasks.filter(t => t.status === tab.value).length
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === tab.value
                  ? 'text-white'
                  : 'hover:bg-gray-100'
              )}
              style={filter === tab.value
                ? { background: 'var(--color-primary)' }
                : { color: 'var(--color-muted-fg)' }
              }
            >
              {tab.label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-muted-fg)' }}>
            {tasks.length === 0 ? 'No tasks yet. Go to Products to submit a product for generation.' : 'No tasks in this category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskRow key={task.id} task={task} onClick={() => onSelectTask(task.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onClick }: { task: PortalTask; onClick: () => void }) {
  const elapsed = Math.round((Date.now() - task.createdAt) / 60000)
  const timeLabel = elapsed < 60
    ? `${elapsed}m ago`
    : `${Math.round(elapsed / 60)}h ago`

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all hover:shadow-sm hover:-translate-y-px"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--color-muted)' }}>
        {task.productImages[0] ? (
          <img src={task.productImages[0]} alt="" className="w-full h-full object-cover" />
        ) : null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-fg)' }}>{task.productTitle}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-fg)' }}>
          {task.store === 'hk' ? '🇭🇰 HK' : '🇦🇺 AU'} · {timeLabel}
          {task.generatedImages.length > 0 && ` · ${task.generatedImages.length} images`}
        </p>
      </div>

      {/* Status */}
      <StatusBadge status={task.status} />

      {/* Review indicator */}
      {task.status === 'completed' && (
        <span className="text-xs px-2 py-1 rounded-lg font-medium"
          style={{ background: 'oklch(0.95 0.05 145)', color: 'oklch(0.45 0.15 145)' }}>
          Review →
        </span>
      )}
    </button>
  )
}
