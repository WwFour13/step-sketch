import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleLeetCodeSketchApi } from './leetcode-sketch-api.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distPath = path.join(projectRoot, 'dist')
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
])

const sendNotFound = (response) => {
  response.statusCode = 404
  response.end('Not found')
}

const serveStatic = async (request, response) => {
  let requestPath
  try {
    requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    response.statusCode = 400
    response.end('Invalid URL')
    return
  }

  let filePath =
    requestPath === '/'
      ? path.join(distPath, 'index.html')
      : path.resolve(distPath, `.${requestPath}`)
  if (
    !filePath.startsWith(`${distPath}${path.sep}`) &&
    filePath !== path.join(distPath, 'index.html')
  ) {
    sendNotFound(response)
    return
  }

  try {
    const fileInfo = await stat(filePath)
    if (fileInfo.isDirectory()) filePath = path.join(filePath, 'index.html')
    await access(filePath)
  } catch {
    filePath = path.join(distPath, 'index.html')
    try {
      await access(filePath)
    } catch {
      response.statusCode = 503
      response.end('Production build not found. Run npm run build first.')
      return
    }
  }

  response.setHeader(
    'Content-Type',
    contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
  )
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(filePath).pipe(response)
}

const port = Number(process.env.PORT ?? 4173)
const server = createServer(async (request, response) => {
  try {
    if (await handleLeetCodeSketchApi(request, response)) return
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.statusCode = 405
      response.setHeader('Allow', 'GET, HEAD')
      response.end('Method not allowed')
      return
    }
    await serveStatic(request, response)
  } catch (error) {
    console.error('Request failed:', error)
    if (!response.headersSent) {
      response.statusCode = 500
      response.end('Internal server error')
    }
  }
})

server.listen(port, () => {
  console.log(`Step Sketch server listening on http://localhost:${port}`)
})
