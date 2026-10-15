import type { IncomingMessage, ServerResponse } from 'node:http'

export function handleLeetCodeSketchApi(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean>
