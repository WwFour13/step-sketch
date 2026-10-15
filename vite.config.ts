import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleLeetCodeSketchApi } from './server/leetcode-sketch-api.mjs'

const leetCodeSketchApi: Plugin = {
  name: 'step-sketch-leetcode-sketch-api',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      void handleLeetCodeSketchApi(request, response).then((handled) => {
        if (!handled) next()
      }, next)
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      void handleLeetCodeSketchApi(request, response).then((handled) => {
        if (!handled) next()
      }, next)
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), leetCodeSketchApi],
})
