import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { LinkError, type LinkErrorKind, type LinkService, type LinkView } from './links.ts';

const STATUS: Record<LinkErrorKind, number> = {
  invalid_url: 400,
  invalid_code: 400,
  invalid_expiry: 400,
  code_taken: 409,
  not_found: 404,
  expired: 410,
};

const MAX_BODY_BYTES = 10_000;

/**
 * Routes:
 *   POST   /links         { url, code?, expiresAt? }  → 201 link
 *   GET    /links/:code                   → 200 link (does not count a click)
 *   DELETE /links/:code                   → 204
 *   GET    /:code                         → 302 to the target URL (counts a click); 410 once expired
 *   GET    /health                        → 200
 */
export function createApp(service: LinkService, baseUrl: string): Server {
  return createServer(async (req, res) => {
    try {
      await route(req, res, service, baseUrl);
    } catch (err) {
      if (err instanceof LinkError) {
        sendJson(res, STATUS[err.kind], { error: err.kind, message: err.message });
      } else if (err instanceof BadRequest) {
        sendJson(res, 400, { error: 'bad_request', message: err.message });
      } else {
        sendJson(res, 500, { error: 'internal', message: 'unexpected error' });
      }
    }
  });
}

async function route(req: IncomingMessage, res: ServerResponse, service: LinkService, baseUrl: string): Promise<void> {
  const path = new URL(req.url ?? '/', baseUrl).pathname;
  const parts = path.split('/').filter(Boolean);
  const method = req.method ?? 'GET';

  if (method === 'GET' && path === '/health') return sendJson(res, 200, { ok: true });

  if (parts[0] === 'links') {
    if (method === 'POST' && parts.length === 1) {
      const body = await readJson(req);
      const link = service.create({
        url: body.url as string,
        code: body.code as string | undefined,
        expiresAt: body.expiresAt,
      });
      return sendJson(res, 201, present(link, baseUrl));
    }
    if (method === 'GET' && parts.length === 2) {
      return sendJson(res, 200, present(service.get(parts[1]!), baseUrl));
    }
    if (method === 'DELETE' && parts.length === 2) {
      service.remove(parts[1]!);
      res.writeHead(204).end();
      return;
    }
  } else if (method === 'GET' && parts.length === 1) {
    res.writeHead(302, { location: service.resolve(parts[0]!) }).end();
    return;
  }

  sendJson(res, 404, { error: 'not_found', message: 'no such route' });
}

function present(link: LinkView, baseUrl: string): LinkView & { shortUrl: string } {
  return { ...link, shortUrl: new URL(link.code, baseUrl).toString() };
}

class BadRequest extends Error {}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BadRequest('request body is too large');
    chunks.push(chunk as Buffer);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadRequest('request body must be JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequest('request body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}
