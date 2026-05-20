import { randomUUID } from 'node:crypto';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createJumpflixMcpServer } from '$lib/server/mcp/catalog-server';

type SessionContext = {
	server: McpServer;
	transport: WebStandardStreamableHTTPServerTransport;
	lastTouchedAt: number;
};

type SessionMode = 'stateful' | 'stateless';

const sessions = new Map<string, SessionContext>();

function resolveSessionMode(): SessionMode {
	const configured = env.JUMPFLIX_MCP_SESSION_MODE?.trim().toLowerCase();
	if (configured === 'stateful' || configured === 'stateless') {
		return configured;
	}

	const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
	return nodeEnv === 'production' ? 'stateless' : 'stateful';
}

function authToken(): string {
	return env.JUMPFLIX_MCP_BEARER_TOKEN?.trim() || env.MCP_BEARER_TOKEN?.trim() || '';
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
	return withCors(
		new Response(JSON.stringify(body), {
			status,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			}
		})
	);
}

function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set(
		'Access-Control-Allow-Headers',
		'authorization, content-type, mcp-session-id, mcp-protocol-version, last-event-id'
	);
	headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
	headers.set('Cache-Control', 'no-store, no-transform');
	headers.set('X-Accel-Buffering', 'no');
	headers.set('Vary', 'authorization, mcp-session-id');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

function ensureAuthorized(request: Request): Response | null {
	const token = authToken();
	if (!token) {
		return jsonResponse(500, {
			error: 'Missing MCP auth token. Configure JUMPFLIX_MCP_BEARER_TOKEN or MCP_BEARER_TOKEN.'
		});
	}

	const authHeader = request.headers.get('authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse(401, { error: 'Unauthorized' });
	}

	if (authHeader.slice(7).trim() !== token) {
		return jsonResponse(401, { error: 'Unauthorized' });
	}

	return null;
}

async function closeSession(sessionId: string): Promise<void> {
	const context = sessions.get(sessionId);
	if (!context) return;
	sessions.delete(sessionId);

	try {
		await context.transport.close();
	} catch {
		// best effort
	}

	try {
		await context.server.close();
	} catch {
		// best effort
	}
}

async function handleStatelessRequest(request: Request, parsedBody?: unknown): Promise<Response> {
	const server = createJumpflixMcpServer();
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined
	});

	await server.connect(transport);
	const response =
		parsedBody === undefined
			? await transport.handleRequest(request)
			: await transport.handleRequest(request, { parsedBody });
	return withCors(response);
}

async function handlePost(request: Request, sessionMode: SessionMode): Promise<Response> {
	const sessionId = request.headers.get('mcp-session-id')?.trim() || null;
	let parsedBody: unknown = undefined;

	try {
		parsedBody = await request.clone().json();
	} catch {
		return jsonResponse(400, { error: 'Invalid JSON body.' });
	}

	if (sessionMode === 'stateless') {
		return handleStatelessRequest(request, parsedBody);
	}

	const initializeRequest = isInitializeRequest(parsedBody);

	if (sessionId && sessions.has(sessionId)) {
		const context = sessions.get(sessionId)!;
		context.lastTouchedAt = Date.now();
		const response = await context.transport.handleRequest(request, { parsedBody });
		return withCors(response);
	}

	if (sessionId && !sessions.has(sessionId) && !initializeRequest) {
		return jsonResponse(404, { error: 'Unknown MCP session.' });
	}

	if (!initializeRequest) {
		return jsonResponse(400, { error: 'No valid session provided and request is not initialize.' });
	}

	const server = createJumpflixMcpServer();
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (newSessionId) => {
			sessions.set(newSessionId, {
				server,
				transport,
				lastTouchedAt: Date.now()
			});
		},
		onsessionclosed: async (closedSessionId) => {
			await closeSession(closedSessionId);
		}
	});

	transport.onclose = () => {
		const activeSessionId = transport.sessionId;
		if (activeSessionId) {
			void closeSession(activeSessionId);
		}
	};

	await server.connect(transport);

	try {
		const response = await transport.handleRequest(request, { parsedBody });
		return withCors(response);
	} catch (error) {
		const activeSessionId = transport.sessionId;
		if (activeSessionId) {
			await closeSession(activeSessionId);
		}
		throw error;
	}
}

async function handleGetOrDelete(request: Request, sessionMode: SessionMode): Promise<Response> {
	if (sessionMode === 'stateless') {
		return handleStatelessRequest(request);
	}

	const sessionId = request.headers.get('mcp-session-id')?.trim() || null;
	if (!sessionId) return jsonResponse(400, { error: 'Missing MCP session id.' });

	const context = sessions.get(sessionId);
	if (!context) return jsonResponse(404, { error: 'Unknown MCP session.' });

	context.lastTouchedAt = Date.now();
	const response = await context.transport.handleRequest(request);
	return withCors(response);
}

const mainHandler: RequestHandler = async ({ request }) => {
	const unauthorized = ensureAuthorized(request);
	if (unauthorized) return unauthorized;

	const sessionMode = resolveSessionMode();

	try {
		if (request.method === 'POST') return await handlePost(request, sessionMode);
		if (request.method === 'GET' || request.method === 'DELETE') {
			return await handleGetOrDelete(request, sessionMode);
		}

		return jsonResponse(405, { error: 'Method not allowed.' });
	} catch (error) {
		console.error('[mcp] request error:', error);
		return jsonResponse(500, { error: 'Internal server error.' });
	}
};

export const POST: RequestHandler = mainHandler;
export const GET: RequestHandler = mainHandler;
export const DELETE: RequestHandler = mainHandler;

export const OPTIONS: RequestHandler = async () => {
	return withCors(new Response(null, { status: 204 }));
};
