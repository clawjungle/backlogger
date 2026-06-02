import { useEffect, useMemo, useState } from 'react'
import { parse } from 'yaml'
import './App.css'

type BacklogItem = {
  id: string
  type: string
  title: string
  priority: number
  status: string
  tags: string[]
  parent?: string
  relates_to?: string[]
  summary?: string
  notes?: string[]
}

type BacklogFile = {
  version: number
  updated_at: string
  items: BacklogItem[]
}

type GroupMode = 'resource' | 'concern' | 'status' | 'priority' | 'ai-theme'

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
    title: Add service workflow beyond callouts
    priority: 1
    status: planned
    tags: [services, workflow, jobs, sessions, callouts]
    summary: Add a broader service model covering jobs, sessions, callouts, sign-off, follow-ups, and service-oriented operational states.
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
  return Array.isArray(parsed?.items) ? parsed.items : []
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
  if (item.priority === 1) score += 2
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

function groupLabel(item: BacklogItem, mode: GroupMode, domain?: DomainFile): string[] {
  const resources = domain?.backlog_tag_mapping?.resources ?? {}
  const concerns = domain?.backlog_tag_mapping?.concerns ?? {}

  if (mode === 'status') return [item.status]
  if (mode === 'priority') return [`P${item.priority}`]
  if (mode === 'ai-theme') return [aiTheme(item)]

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
  const [historyText, setHistoryText] = useState('version: 1\nitems: []\n')
  const [config, setConfig] = useState<ViewerPayload['config']>({})
  const [groupMode, setGroupMode] = useState<GroupMode>('resource')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liveStatus, setLiveStatus] = useState('sample mode')
  const [revision, setRevision] = useState<number | null>(null)

  useEffect(() => {
    const basePath = '/backlog/'

    const loadState = () => {
      fetch(`${basePath}state`)
        .then((res) => res.json())
        .then((payload: ViewerPayload) => {
          setBacklogText(payload.backlogText || SAMPLE_BACKLOG)
          setDomainText(payload.domainText || SAMPLE_DOMAIN)
          setHistoryText(payload.historyText || 'version: 1\nitems: []\n')
          setConfig(payload.config || {})
          setRevision(payload.revision ?? null)
          setLiveStatus('live')
        })
        .catch(() => setLiveStatus('sample mode'))
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

  const grouped = useMemo(() => {
    const map = new Map<string, BacklogItem[]>()
    for (const item of items) {
      for (const label of groupLabel(item, groupMode, domain)) {
        if (!map.has(label)) map.set(label, [])
        map.get(label)!.push(item)
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [items, groupMode, domain])

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null

  const stats = useMemo(() => {
    const total = items.length
    const epics = items.filter((i) => i.type === 'epic').length
    const p1 = items.filter((i) => i.priority === 1).length
    const wideImpact = items.filter((i) => scoreImpact(i) === 'Wide').length
    return { total, epics, p1, wideImpact }
  }, [items])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Backlogger</p>
          <h1>Backlog visualizer</h1>
          <p className="subtle">
            Group by domain, concerns, or ephemeral AI themes, with live file watching from the host project.
          </p>
        </div>
        <div className="stats">
          <div><strong>{stats.total}</strong><span>items</span></div>
          <div><strong>{stats.epics}</strong><span>epics</span></div>
          <div><strong>{stats.p1}</strong><span>p1 items</span></div>
          <div><strong>{stats.wideImpact}</strong><span>wide impact</span></div>
        </div>
      </header>

      <section className="controls">
        <label>
          Group by
          <select value={groupMode} onChange={(e) => setGroupMode(e.target.value as GroupMode)}>
            <option value="resource">Resource</option>
            <option value="concern">Concern</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="ai-theme">AI theme</option>
          </select>
        </label>
        <div className="config-strip">
          <span className="live-state">{liveStatus}</span>
          <span>backlog: {config.backlogPath || 'sample'}</span>
          <span>domain: {config.domainPath || 'sample'}</span>
          <span>history: {config.historyPath || 'sample'}</span>
          <span>rev: {revision ?? 'n/a'}</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="left-column">
          <div className="panel">
            <div className="panel-head">
              <h2>Backlog groups</h2>
              <span>{grouped.length}</span>
            </div>
            <div className="groups">
              {grouped.map(([label, groupItems]) => (
                <div key={label} className="group-card">
                  <div className="group-head">
                    <h3>{label}</h3>
                    <span>{groupItems.length}</span>
                  </div>
                  <ul>
                    {groupItems
                      .slice()
                      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
                      .map((item) => (
                        <li key={`${label}-${item.id}`}>
                          <button type="button" onClick={() => setSelectedId(item.id)}>
                            <span className="item-id">{item.id}</span>
                            <span className="item-title">{item.title}</span>
                            <span className={`pill pill-p${item.priority}`}>P{item.priority}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="main-column">
          <div className="panel detail-panel">
            <div className="panel-head">
              <h2>Item detail</h2>
              {selected && <span>{selected.id}</span>}
            </div>
            {selected ? (
              <div className="detail-body">
                <h3>{selected.title}</h3>
                <div className="meta-row">
                  <span className="pill">{selected.type}</span>
                  <span className={`pill pill-p${selected.priority}`}>priority {selected.priority}</span>
                  <span className="pill">{selected.status}</span>
                  <span className="pill">size {scoreSize(selected)}</span>
                  <span className="pill">impact {scoreImpact(selected)}</span>
                </div>
                {selected.summary && <p className="summary">{selected.summary}</p>}
                <div className="tag-row">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
                {selected.parent && <p><strong>Parent:</strong> {selected.parent}</p>}
                {selected.relates_to?.length ? (
                  <p><strong>Related:</strong> {selected.relates_to.join(', ')}</p>
                ) : null}
              </div>
            ) : (
              <p className="empty">No backlog items loaded yet.</p>
            )}
          </div>

          <div className="panel editors">
            <div>
              <div className="panel-head"><h2>Backlog YAML</h2></div>
              <textarea value={backlogText} onChange={(e) => setBacklogText(e.target.value)} spellCheck={false} />
            </div>
            <div>
              <div className="panel-head"><h2>Domain YAML</h2></div>
              <textarea value={domainText} onChange={(e) => setDomainText(e.target.value)} spellCheck={false} />
            </div>
          </div>
          <div className="panel editors single">
            <div>
              <div className="panel-head"><h2>History YAML</h2></div>
              <textarea value={historyText} onChange={(e) => setHistoryText(e.target.value)} spellCheck={false} />
            </div>
          </div>
        </main>
      </section>
    </div>
  )
}

export default App
