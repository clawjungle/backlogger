import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const defaultConfigPath = path.join(root, 'backlogger.conf.json')
const defaultBacklogPath = path.join(root, 'BACKLOG.yaml')
const defaultDomainPath = path.join(root, 'DOMAIN.yaml')
const defaultHistoryPath = path.join(root, 'HISTORY.yaml')

function readConfig(configPath: string) {
  if (!fs.existsSync(configPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

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

  const config = readConfig(configPath)
  process.env.BACKLOGGER_BACKLOG_PATH = String(config.backlogPath || defaultBacklogPath)
  process.env.BACKLOGGER_DOMAIN_PATH = String(config.domainPath || defaultDomainPath)
  process.env.BACKLOGGER_HISTORY_PATH = String(config.historyPath || defaultHistoryPath)
  process.env.BACKLOGGER_BASE_PATH = String(config.basePath || '/backlogger/')
  process.env.BACKLOGGER_PORT = String(config.port || 4173)

  await import('../server/dev-server.ts')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
