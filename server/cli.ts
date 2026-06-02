#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const defaultConfigPath = path.join(root, 'backlogger.conf.json')
const defaultBacklogPath = path.join(root, 'BACKLOG.yaml')
const defaultDomainPath = path.join(root, 'DOMAIN.yaml')
const defaultHistoryPath = path.join(root, 'HISTORY.yaml')

const SAMPLE_BACKLOG = `\
version: 1
updated_at: ${new Date().toISOString().slice(0, 10)}
items:
  - id: BL-001
    type: feature
    status: planned
    tags: [ui, workflow]
    summary: Example backlog item
    description: Replace this with your real backlog items.
`

const SAMPLE_DOMAIN = `\
version: 1
backlog_tag_mapping:
  resources:
    ui: frontend
    api: backend
  concerns:
    workflow: workflow
    performance: performance
`

function writeIfMissing(filePath: string, content: string) {
  if (fs.existsSync(filePath)) {
    console.log(`Skipped (exists) ${filePath}`)
  } else {
    fs.writeFileSync(filePath, content)
    console.log(`Wrote ${filePath}`)
  }
}

function writeInitConfig(configPath: string) {
  const config = {
    backlogPath: defaultBacklogPath,
    domainPath: defaultDomainPath,
    historyPath: defaultHistoryPath,
    port: 4173,
    basePath: '/',
  }
  writeIfMissing(configPath, `${JSON.stringify(config, null, 2)}\n`)
  writeIfMissing(defaultBacklogPath, SAMPLE_BACKLOG)
  writeIfMissing(defaultDomainPath, SAMPLE_DOMAIN)
}

function printHelp() {
  console.log(`
Usage: backlogger [command] [config]

Commands:
  (none)       Start the server (default)
  init         Create a backlogger.conf.json in the current directory
  help, --help Print this help message

Arguments:
  config       Path to config file (default: ./backlogger.conf.json)

Config file options (JSON):
  backlogPath  Path to BACKLOG.yaml  (default: ./BACKLOG.yaml)
  domainPath   Path to DOMAIN.yaml   (default: ./DOMAIN.yaml)
  historyPath  Path to HISTORY.yaml  (default: ./HISTORY.yaml)
  port         Port to listen on     (default: 4173)
  title        App title             (default: Backlogger)

Examples:
  npx @ponelat/backlogger
  npx @ponelat/backlogger init
  npx @ponelat/backlogger start ./my.conf.json
`.trim())
}

async function main() {
  const [command, configArg] = process.argv.slice(2)

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  const configPath = path.resolve(process.cwd(), configArg || defaultConfigPath)

  if (command === 'init') {
    writeInitConfig(configPath)
    return
  }

  process.env.BACKLOGGER_CONFIG_PATH = configPath
  await import('./server.js')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
