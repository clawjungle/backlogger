#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const defaultConfigPath = path.join(root, 'backlogger.conf.json')
const defaultBacklogPath = path.join(root, 'BACKLOG.yaml')
const defaultDomainPath = path.join(root, 'DOMAIN.yaml')
const defaultHistoryPath = path.join(root, 'HISTORY.yaml')

function writeInitConfig(configPath: string) {
  const config = {
    backlogPath: defaultBacklogPath,
    domainPath: defaultDomainPath,
    historyPath: defaultHistoryPath,
    basePath: '/backlogger/',
    port: 4173,
  }
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  console.log(`Wrote ${configPath}`)
}

async function main() {
  const [command, configArg] = process.argv.slice(2)
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
