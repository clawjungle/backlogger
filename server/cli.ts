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
