import { LayoutGrid, ClipboardList } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Page } from '../App'

interface Props {
  currentPage: string
  onNavigate: (page: Page) => void
}

const nav = [
  { id: 'products', label: 'Products', icon: LayoutGrid },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
]

export default function Sidebar({ currentPage, onNavigate }: Props) {
  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col h-screen"
      style={{ background: 'var(--color-sidebar)', borderRight: '1px solid var(--color-sidebar-border)' }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-fg)' }}>Cozymatic</p>
            <p className="text-xs" style={{ color: 'var(--color-sidebar-muted)' }}>Image Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id || (currentPage === 'product-detail' && id === 'products') || (currentPage === 'task-detail' && id === 'tasks')
          return (
            <button
              key={id}
              onClick={() => onNavigate({ name: id as any })}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                active
                  ? 'bg-white/10 font-medium'
                  : 'hover:bg-white/5'
              )}
              style={{ color: active ? 'var(--color-sidebar-fg)' : 'var(--color-sidebar-muted)' }}
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <p className="text-xs" style={{ color: 'var(--color-sidebar-muted)' }}>
          cozymatic.com.hk<br />cozymatic.com.au
        </p>
      </div>
    </aside>
  )
}
