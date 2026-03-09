#!/usr/bin/env node

import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ZentaoAPI } from './api/zentaoApi.js';
import { loadConfig, saveConfig, ZentaoConfig } from './config.js';
import { BugResolution, BugStatus, TaskStatus, TaskUpdate } from './types/zentao.js';
import { debugLog, errorLog } from './utils/logger.js';

const args = process.argv.slice(2);
let configData: { config?: ZentaoConfig } | null = null;

const configIndex = args.indexOf('--config');
if (configIndex !== -1 && configIndex + 1 < args.length) {
    try {
        configData = JSON.parse(args[configIndex + 1]);
        if (configData?.config) {
            saveConfig(configData.config);
        }
    } catch (error) {
        errorLog('配置解析失败:', error);
        process.exit(1);
    }
}

const server = new McpServer({
    name: 'Zentao API',
    version: '1.0.1',
});

let zentaoApi: ZentaoAPI | null = null;

interface UserParams {
    config?: ZentaoConfig;
    name?: string;
    age?: number;
    skills?: string[];
}

export default async function main(params: UserParams) {
    if (params.config) {
        saveConfig(params.config);
    }
}

function getConfigOrThrow(): ZentaoConfig {
    const config = loadConfig();
    if (!config) {
        throw new Error('No configuration found. Please provide Zentao config via env vars or config file.');
    }
    return config;
}

function ensureApi(): ZentaoAPI {
    if (!zentaoApi) {
        zentaoApi = new ZentaoAPI(getConfigOrThrow());
    }
    return zentaoApi;
}

server.tool('initZentao', '初始化禅道连接并加载当前配置。', {}, async () => {
    const config = getConfigOrThrow();
    zentaoApi = new ZentaoAPI(config);
    return {
        content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
    };
});

server.tool('getMyTasks', '获取当前登录用户的任务列表，可按状态筛选。', {
    status: z.enum(['wait', 'doing', 'done', 'all']).optional(),
}, async ({ status }) => {
    const tasks = await ensureApi().getMyTasks(status as TaskStatus);
    return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
});

server.tool('getTaskDetail', '根据任务 ID 获取任务详情。', {
    taskId: z.number(),
}, async ({ taskId }) => {
    const task = await ensureApi().getTaskDetail(taskId);
    return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
});

server.tool('getProducts', '获取当前账号可访问的产品列表。', {}, async () => {
    const products = await ensureApi().getProducts();
    return { content: [{ type: 'text', text: JSON.stringify(products, null, 2) }] };
});

server.tool('getMyBugs', '获取当前登录用户的 Bug 列表，可按状态和产品筛选。', {
    status: z.enum(['active', 'resolved', 'closed', 'all']).optional(),
    productId: z.number().optional(),
}, async ({ status, productId }) => {
    const bugs = await ensureApi().getMyBugs(status as BugStatus, productId);
    return { content: [{ type: 'text', text: JSON.stringify(bugs, null, 2) }] };
});

server.tool('getBugDetail', '根据 Bug ID 获取 Bug 详情。', {
    bugId: z.number(),
}, async ({ bugId }) => {
    const bug = await ensureApi().getBugDetail(bugId);
    return { content: [{ type: 'text', text: JSON.stringify(bug, null, 2) }] };
});

server.tool('updateTask', '更新指定任务的工时、状态或备注信息。', {
    taskId: z.number(),
    update: z.object({
        consumed: z.number().optional(),
        left: z.number().optional(),
        status: z.enum(['wait', 'doing', 'done']).optional(),
        finishedDate: z.string().optional(),
        comment: z.string().optional(),
    }),
}, async ({ taskId, update }) => {
    const task = await ensureApi().updateTask(taskId, update as TaskUpdate);
    return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
});

server.tool('finishTask', '完成指定任务，可附带消耗工时、剩余工时和备注。', {
    taskId: z.number(),
    update: z.object({
        consumed: z.number().optional(),
        left: z.number().optional(),
        comment: z.string().optional(),
    }).optional(),
}, async ({ taskId, update }) => {
    const task = await ensureApi().finishTask(taskId, (update || {}) as TaskUpdate);
    return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
});

server.tool('resolveBug', '解决指定 Bug，可填写解决方案、版本和备注。', {
    bugId: z.number(),
    resolution: z.object({
        resolution: z.enum(['fixed', 'notrepro', 'duplicate', 'bydesign', 'willnotfix', 'tostory', 'external']),
        resolvedBuild: z.string().optional(),
        duplicateBug: z.number().optional(),
        comment: z.string().optional(),
    }),
}, async ({ bugId, resolution }) => {
    const bug = await ensureApi().resolveBug(bugId, resolution as BugResolution);
    return { content: [{ type: 'text', text: JSON.stringify(bug, null, 2) }] };
});

async function startStdioServer(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

async function startSseServer(port: number): Promise<void> {
    const sessions = new Map<string, SSEServerTransport>();

    const httpServer = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);

            if (req.method === 'GET' && url.pathname === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
                return;
            }

            if (req.method === 'GET' && url.pathname === '/sse') {
                const transport = new SSEServerTransport('/message', res);
                sessions.set(transport.sessionId, transport);
                req.on('close', () => sessions.delete(transport.sessionId));
                await server.connect(transport);
                return;
            }

            if (req.method === 'POST' && url.pathname === '/message') {
                const sessionId = url.searchParams.get('sessionId');
                const transport = sessionId ? sessions.get(sessionId) : undefined;

                if (!transport) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Session not found');
                    return;
                }

                await transport.handlePostMessage(req, res);
                return;
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
        } catch (error) {
            errorLog('HTTP MCP server error:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            res.end('Internal server error');
        }
    });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));
    errorLog(`SSE MCP server listening on http://0.0.0.0:${port}/sse`);
}

const transportMode = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();
const port = Number(process.env.MCP_SERVER_PORT || process.env.PORT || 3000);

debugLog('Starting MCP transport', transportMode, 'port', port);

if (transportMode === 'sse' || transportMode === 'http') {
    await startSseServer(port).catch((error) => {
        errorLog('Failed to start SSE server:', error);
        process.exit(1);
    });
} else {
    await startStdioServer().catch((error) => {
        errorLog('Failed to start stdio server:', error);
        process.exit(1);
    });
}
