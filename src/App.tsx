import { useEffect, useMemo, useState } from 'react'
import { parse } from 'yaml'
import './App.css'

type BacklogItem = {
  id: string
  type: string
  status: string
  tags: string[]
  parent?: string
  relates_to?: string[]
  summary?: string
  description?: string
  notes?: string[]
}

type BacklogFile = {
  version: number
  updated_at: string
  items: BacklogItem[]
}

type GroupMode = 'resource' | 'concern' | 'status' | 'ai-theme' | 'epic'

type DomainFile = {
  backlog_tag_mapping?: {
    resources?: Record<string, string>
    concerns?: Record<string, string>
  }
}

type ViewerPayload = {
  backlogText: string
  domainText: string
  historyText: string
  revision?: number
  config: {
    backlogPath?: string
    domainPath?: string
    historyPath?: string
    basePath?: string
  }
}

const SAMPLE_BACKLOG = `version: 1
updated_at: 2026-06-02
items:
  - id: JC-025
    type: epic
    status: planned
    tags: [services, workflow, jobs, sessions, callouts]
    summary: Broader service workflow.
    description: Add a broader service model covering jobs, sessions, callouts, sign-off, follow-ups, and service-oriented operational states.
`

const SAMPLE_DOMAIN = `version: 1
backlog_tag_mapping:
  resources:
    customers: customers
    services: services
    callouts: callouts
    sessions: remote_assistance
    jobs: jobs
    invoices: invoices
    auth: users
  concerns:
    ux: ux
    workflow: workflow
    search: search
    realtime: realtime
    testing: testing
`

function normalizeItems(input: unknown): BacklogItem[] {
  const parsed = input as BacklogFile
  if (!Array.isArray(parsed?.items)) return []
  return parsed.items.map((item) => ({
    ...item,
    summary: item.summary || item.id,
  }))
}

function scoreSize(item: BacklogItem): 'S' | 'M' | 'L' | 'XL' {
  const tags = new Set(item.tags)
  let score = 0
  if (item.type === 'epic') score += 4
  if (item.type === 'feature') score += 2
  if (item.type === 'bug') score += 1
  if (item.parent) score += 1
  if (item.summary && item.summary.length > 140) score += 1
  if (tags.has('workflow')) score += 1
  if (tags.has('integrations')) score += 2
  if (tags.has('offline')) score += 2
  if (tags.has('realtime')) score += 1
  if (tags.has('testing')) score += 1
  if (tags.has('performance')) score += 1

  if (score <= 2) return 'S'
  if (score <= 4) return 'M'
  if (score <= 6) return 'L'
  return 'XL'
}

function scoreImpact(item: BacklogItem): 'Low' | 'Medium' | 'High' | 'Wide' {
  const tags = new Set(item.tags)
  let score = 0
  if (item.type === 'epic') score += 2
  if (tags.has('services')) score += 2
  if (tags.has('customers')) score += 1
  if (tags.has('callouts')) score += 1
  if (tags.has('invoicing')) score += 2
  if (tags.has('offline')) score += 2
  if (tags.has('realtime')) score += 1
  if (tags.has('integrations')) score += 2
  if (tags.has('performance')) score += 1
  if (tags.has('security')) score += 2

  if (score <= 2) return 'Low'
  if (score <= 4) return 'Medium'
  if (score <= 6) return 'High'
  return 'Wide'
}

function aiTheme(item: BacklogItem): string {
  const tags = new Set(item.tags)
  if (tags.has('offline') || tags.has('realtime')) return 'sync and state'
  if (tags.has('integrations') || tags.has('automation')) return 'external systems'
  if (tags.has('testing') || tags.has('releases')) return 'quality and delivery'
  if (tags.has('customers') || tags.has('notes')) return 'customer memory'
  if (tags.has('services') || tags.has('callouts') || tags.has('jobs')) return 'service operations'
  if (tags.has('ux') || tags.has('search') || tags.has('navigation')) return 'operator experience'
  return 'miscellaneous'
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function labelsForItem(item: BacklogItem, mode: GroupMode, domain?: DomainFile): string[] {
  const resources = domain?.backlog_tag_mapping?.resources ?? {}
  const concerns = domain?.backlog_tag_mapping?.concerns ?? {}

  if (mode === 'status') return [item.status]
  if (mode === 'ai-theme') return [aiTheme(item)]
  if (mode === 'epic') return [item.type === 'epic' ? 'epics' : 'non-epics']

  if (mode === 'resource') {
    const matched = item.tags.filter((tag) => tag in resources)
    return matched.length ? unique(matched.map((tag) => resources[tag])) : ['unmapped']
  }

  const matched = item.tags.filter((tag) => tag in concerns)
  return matched.length ? unique(matched.map((tag) => concerns[tag])) : ['unmapped']
}

function App() {
  const [backlogText, setBacklogText] = useState(SAMPLE_BACKLOG)
  const [domainText, setDomainText] = useState(SAMPLE_DOMAIN)
  const [, setHistoryText] = useState('version: 1\nitems: []\n')
  const [, setConfig] = useState<ViewerPayload['config']>({})
  const [groupMode, setGroupMode] = useState<GroupMode>('resource')
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [copyStatus, setCopyStatus] = useState('')
  const [liveStatus, setLiveStatus] = useState('sample mode')
  const [revision, setRevision] = useState<number | null>(null)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)

  useEffect(() => {
    const loadState = () => {
      fetch('/state')
        .then((res) => res.json())
        .then((payload: ViewerPayload) => {
          setBacklogText(payload.backlogText || SAMPLE_BACKLOG)
          setDomainText(payload.domainText || SAMPLE_DOMAIN)
          setHistoryText(payload.historyText || 'version: 1\nitems: []\n')
          setConfig(payload.config || {})
          setRevision(payload.revision ?? null)
          setLiveStatus('live')
        })
        .catch(() => setLiveStatus('offline'))
    }

    loadState()
    const interval = window.setInterval(loadState, 1500)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const backlog = useMemo(() => parse(backlogText) as BacklogFile, [backlogText])
  const domain = useMemo(() => parse(domainText) as DomainFile, [domainText])
  const items = useMemo(() => normalizeItems(backlog), [backlog])

  const filterGroups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const label of labelsForItem(item, groupMode, domain)) {
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count }))
  }, [items, groupMode, domain])

  const visibleItems = useMemo(() => {
    if (!selectedFilter) return items
    return items.filter((item) => labelsForItem(item, groupMode, domain).includes(selectedFilter))
  }, [items, selectedFilter, groupMode, domain])

  const activeItem = visibleItems.find((item) => item.id === activeItemId) ?? visibleItems[0] ?? null

  useEffect(() => {
    if (!activeItem && activeItemId) setActiveItemId(null)
  }, [activeItem, activeItemId])

  const selectedItems = useMemo(() => {
    const selectedSet = new Set(selectedItemIds)
    return items.filter((item) => selectedSet.has(item.id))
  }, [items, selectedItemIds])

  const epicCount = useMemo(() => items.filter((item) => item.type === 'epic').length, [items])

  function toggleSelection(itemId: string) {
    setSelectedItemIds((current) => (
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    ))
  }

  function clearAll() {
    setSelectedFilter(null)
    setSelectedItemIds([])
    setActiveItemId(null)
    setCopyStatus('')
  }

  function toggleEpicFilter() {
    setGroupMode('epic')
    setSelectedFilter((current) => current === 'epics' ? null : 'epics')
  }

  async function copySelected() {
    if (!selectedItems.length) {
      setCopyStatus('select some items first')
      return
    }

    const text = selectedItems
      .map((item) => `${item.id}: ${item.summary || item.id}`)
      .join('\n')

    await navigator.clipboard.writeText(text)
    setCopyStatus(`copied ${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'}`)
    window.setTimeout(() => setCopyStatus(''), 2000)
  }

  return (
    <div className="app-shell flat-shell">
      <header className="topbar flat-topbar">
        <div className="topbar-left">
          <h1>Backlogger</h1>
          <label className="toolbar-field">
            <span>Filter lens</span>
            <select value={groupMode} onChange={(e) => {
              setGroupMode(e.target.value as GroupMode)
              setSelectedFilter(null)
            }}>
              <option value="resource">Resource</option>
              <option value="concern">Concern</option>
              <option value="status">Status</option>
              <option value="ai-theme">AI theme</option>
              <option value="epic">Epic</option>
            </select>
          </label>
          <button type="button" className={liveStatus === 'live' ? 'toolbar-chip ok' : 'toolbar-chip'}>
            {liveStatus}
          </button>
          <button type="button" className="toolbar-chip" onClick={() => setSelectedFilter(null)}>
            {visibleItems.length} items
          </button>
          <button type="button" className={groupMode === 'epic' && selectedFilter === 'epics' ? 'toolbar-chip active' : 'toolbar-chip'} onClick={toggleEpicFilter}>
            {epicCount} epics
          </button>
          <button type="button" className="toolbar-chip" onClick={clearAll}>
            Clear all
          </button>
          <button type="button" className="toolbar-chip primary" onClick={() => void copySelected()}>
            Copy selected ({selectedItems.length})
          </button>
          {copyStatus ? <span className="toolbar-note">{copyStatus}</span> : null}
        </div>
        <div className="topbar-right">
          <button type="button" className="toolbar-chip" onClick={() => setFiltersCollapsed((value) => !value)}>
            {filtersCollapsed ? 'Show filters' : 'Hide filters'}
          </button>
          <span className="toolbar-note">rev {revision ?? 'n/a'}</span>
        </div>
      </header>

      <section className={filtersCollapsed ? 'layout layout-collapsed' : 'layout'}>
        {!filtersCollapsed && (
          <aside className="filters-column plain-column">
            <div className="column-head">
              <h2>Filters</h2>
              <span>{filterGroups.length}</span>
            </div>
            <div className="filter-list">
              <button
                type="button"
                className={!selectedFilter ? 'filter-chip active' : 'filter-chip'}
                onClick={() => setSelectedFilter(null)}
              >
                <span>all items</span>
                <span>{items.length}</span>
              </button>
              {filterGroups.map((group) => (
                <button
                  key={group.label}
                  type="button"
                  className={selectedFilter === group.label ? 'filter-chip active' : 'filter-chip'}
                  onClick={() => setSelectedFilter(group.label)}
                >
                  <span>{group.label}</span>
                  <span>{group.count}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        <main className="list-column plain-column">
          <div className="column-head">
            <h2>Backlog</h2>
            <span>{selectedFilter ? `${selectedFilter}` : 'file order'}</span>
          </div>
          <div className="flat-list">
            {visibleItems.map((item, index) => {
              const selectedForCopy = selectedItemIds.includes(item.id)
              const active = activeItem?.id === item.id
              return (
                <div key={item.id} className={active ? 'flat-item active' : 'flat-item'}>
                  <label className="select-box">
                    <input
                      type="checkbox"
                      checked={selectedForCopy}
                      onChange={() => toggleSelection(item.id)}
                    />
                  </label>
                  <button type="button" className="flat-item-button" onClick={() => setActiveItemId(item.id)}>
                    <span className="flat-order">{index + 1}</span>
                    <span className="flat-content">
                      <span className="flat-title">{item.summary || item.id}</span>
                      <span className="flat-meta">{item.id} · {item.type} · {item.status}</span>
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </main>

        <aside className="detail-column plain-column">
          <div className="column-head">
            <h2>Details</h2>
            {activeItem ? <span>{activeItem.id}</span> : <span>none</span>}
          </div>
          {activeItem ? (
            <div className="detail-body">
              <h3>{activeItem.summary || activeItem.id}</h3>
              <div className="meta-row">
                <span className="pill">{activeItem.id}</span>
                <span className="pill">{activeItem.type}</span>
                <span className="pill">{activeItem.status}</span>
                <span className="pill">size {scoreSize(activeItem)}</span>
                <span className="pill">impact {scoreImpact(activeItem)}</span>
              </div>
              {activeItem.description && <p className="description">{activeItem.description}</p>}
              <div className="tag-row">
                {activeItem.tags.map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
              {activeItem.parent && <p><strong>Parent:</strong> {activeItem.parent}</p>}
              {activeItem.relates_to?.length ? (
                <p><strong>Related:</strong> {activeItem.relates_to.join(', ')}</p>
              ) : null}
            </div>
          ) : (
            <p className="empty">No backlog item selected.</p>
          )}
        </aside>
      </section>
    </div>
  )
}

export default App
