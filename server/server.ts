import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import type { Request, Response } from 'express'
import chokidar from 'chokidar'

const defaultConfigPath = path.join(process.cwd(), 'backlogger.conf.json')
const configPath = process.env.BACKLOGGER_CONFIG_PATH || defaultConfigPath

function readConfig() {
  if (!fs.existsSync(configPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

const config = readConfig()
const baseDir = path.dirname(configPath)
const backlogPath = String(config.backlogPath || path.join(baseDir, 'BACKLOG.yaml'))
const domainPath = String(config.domainPath || path.join(baseDir, 'DOMAIN.yaml'))
const historyPath = String(config.historyPath || path.join(baseDir, 'HISTORY.yaml'))
const basePath = String(config.basePath || '/backlogger/').replace(/\/+$/, '/') + '/'
const port = Number(config.port || 4173)
const title = String(config.title || 'Backlogger')

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
      port,
      configPath,
      title,
    },
  }
}

async function start() {
  const app = express()
  let revision = Date.now()

  app.get('/state', (_req: Request, res: Response) => {
    res.json({
      ...payload(),
      revision,
    })
  })

  const watchTargets = [configPath, backlogPath, domainPath, historyPath].filter(Boolean)
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
    console.log(`Backlogger server running on http://0.0.0.0:${port}${basePath}`)
    console.log(`Config ${configPath}`)
    console.log(`Watching backlog=${backlogPath}`)
    console.log(`Watching domain=${domainPath}`)
    console.log(`Watching history=${historyPath}`)
    console.log(`Title ${title}`)
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
