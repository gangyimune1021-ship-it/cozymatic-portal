import { useState } from 'react'
import { Toaster } from 'sonner'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import TasksPage from './pages/TasksPage'
import TaskDetailPage from './pages/TaskDetailPage'
import Sidebar from './components/Sidebar'

export type Page =
  | { name: 'products' }
  | { name: 'product-detail'; store: 'hk' | 'au'; handle: string }
  | { name: 'tasks' }
  | { name: 'task-detail'; taskId: string }

export default function App() {
  const [page, setPage] = useState<Page>({ name: 'products' })

  function navigate(p: Page) {
    setPage(p)
    window.scrollTo(0, 0)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Toaster position="top-right" richColors />
      <Sidebar currentPage={page.name} onNavigate={navigate} />
      <main className="flex-1 overflow-y-auto">
        {page.name === 'products' && (
          <ProductsPage onSelectProduct={(store, handle) =>
            navigate({ name: 'product-detail', store, handle })
          } />
        )}
        {page.name === 'product-detail' && (
          <ProductDetailPage
            store={page.store}
            handle={page.handle}
            onBack={() => navigate({ name: 'products' })}
            onTaskCreated={(taskId) => navigate({ name: 'task-detail', taskId })}
          />
        )}
        {page.name === 'tasks' && (
          <TasksPage onSelectTask={(taskId) =>
            navigate({ name: 'task-detail', taskId })
          } />
        )}
        {page.name === 'task-detail' && (
          <TaskDetailPage
            taskId={page.taskId}
            onBack={() => navigate({ name: 'tasks' })}
          />
        )}
      </main>
    </div>
  )
}
