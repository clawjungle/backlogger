import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = process.env.BACKLOGGER_VITE_BASE || process.env.BACKLOGGER_BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    host: true,
    port: Number(process.env.BACKLOGGER_VITE_PORT || 4174),
    allowedHosts: ['dev.ponelat.com', 'claw.ponelat.com', 'localhost', '127.0.0.1'],
  },
})
