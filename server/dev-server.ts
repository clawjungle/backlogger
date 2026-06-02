import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import express from 'express'
import type { Request, Response } from 'express'
import chokidar from 'chokidar'

const root = process.cwd()
const distDir = path.join(root, 'dist')
const backlogPath = process.env.BACKLOGGER_BACKLOG_PATH || ''
const domainPath = process.env.BACKLOGGER_DOMAIN_PATH || ''
const historyPath = process.env.BACKLOGGER_HISTORY_PATH || ''
const basePath = (process.env.BACKLOGGER_BASE_PATH || '/backlog/').replace(/\/+$/, '/')
const port = Number(process.env.BACKLOGGER_PORT || 4173)

function readSafe(filePath: string) {
  if (!filePath) return ''
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function payload() {
  return {
    backlogText: readSafe(backlogPath),
    domainText: readSafe(domainPath),
    historyText: readSafe(historyPath),
    config: {
      backlogPath,
      domainPath,
      historyPath,
      basePath,
    },
  }
}

function ensureDist() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Backlogger dist build missing at ${distDir}. Run npm run build first.`)
  }
}

async function start() {
  ensureDist()

  const app = express()
  let revision = Date.now()

  app.get(`${basePath}state`, (_req: Request, res: Response) => {
    res.json({
      ...payload(),
      revision,
    })
  })

  app.use(basePath, express.static(distDir, { index: 'index.html' }))

  app.get(basePath, (_req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  app.get(/^\/backlog\/.*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  const watchTargets = [backlogPath, domainPath, historyPath].filter(Boolean)
  if (watchTargets.length) {
    const watcher = chokidar.watch(watchTargets, { ignoreInitial: true })
    const bump = () => {
      revision = Date.now()
      console.log('Backlogger data changed')
    }
    watcher.on('add', bump)
    watcher.on('change', bump)
    watcher.on('unlink', bump)
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Backlogger hosted server running on http://0.0.0.0:${port}${basePath}`)
    console.log(`Serving static assets from ${distDir}`)
    console.log(`Watching backlog=${backlogPath || '<none>'}`)
    console.log(`Watching domain=${domainPath || '<none>'}`)
    console.log(`Watching history=${historyPath || '<none>'}`)
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
