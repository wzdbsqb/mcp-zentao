import axios, { AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import { Bug, BugStatus, CreateTaskRequest, Task, TaskStatus, ZentaoConfig } from '../types/zentao.js';
import { debugLog, errorLog } from '../utils/logger.js';

export interface Product {
    id: number;
    name: string;
    code?: string;
    status?: string;
    desc?: string;
}

export interface TaskUpdate {
    consumed?: number;
    left?: number;
    status?: TaskStatus;
    finishedDate?: string;
    comment?: string;
}

export interface BugResolution {
    resolution: 'fixed' | 'notrepro' | 'duplicate' | 'bydesign' | 'willnotfix' | 'tostory' | 'external';
    resolvedBuild?: string;
    duplicateBug?: number;
    comment?: string;
}

type TaskListResponse = { tasks?: Task[] } | Task[];
type BugListResponse = { bugs?: Bug[] } | Bug[];
type ProductListResponse = { products?: Product[] } | Product[];
type TaskDetailResponse = { task?: Task } | Task;
type BugDetailResponse = { bug?: Bug } | Bug;

export class ZentaoAPI {
    private config: ZentaoConfig;
    private client: AxiosInstance;
    private token: string | null = null;

    constructor(config: ZentaoConfig) {
        this.config = config;
        this.client = axios.create({
            baseURL: `${this.config.url.replace(/\/$/, '')}/api.php/${this.config.apiVersion}`,
            timeout: Number(process.env.ZENTAO_HTTP_TIMEOUT || 20000),
        });
    }

    private async getToken(): Promise<string> {
        if (this.token) return this.token;

        const password = createHash('md5').update(this.config.password).digest('hex');
        debugLog('Requesting token from', `${this.config.url}/api.php/${this.config.apiVersion}/tokens`);

        try {
            const response = await this.client.post('/tokens', {
                account: this.config.username,
                password,
            });

            if ((response.status === 200 || response.status === 201) && response.data?.token) {
                this.token = response.data.token;
                return response.data.token;
            }

            throw new Error(`获取 token 失败: ${JSON.stringify(response.data)}`);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const detail = error.response
                    ? `状态码 ${error.response.status}: ${JSON.stringify(error.response.data)}`
                    : error.message;
                throw new Error(`登录失败: ${detail}`);
            }
            throw error;
        }
    }

    private async request<T>(method: string, url: string, params?: unknown, data?: unknown): Promise<T> {
        const token = await this.getToken();

        try {
            const response = await this.client.request<T>({
                method,
                url,
                params,
                data,
                headers: {
                    Token: token,
                    ...(data instanceof URLSearchParams
                        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
                        : {}),
                },
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                errorLog('请求失败:', {
                    method,
                    url,
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message,
                });
                throw new Error(`请求失败: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }

    async getMyTasks(status?: TaskStatus): Promise<Task[]> {
        const response = await this.request<TaskListResponse>('GET', '/tasks', {
            assignedTo: this.config.username,
            status: status || 'all',
        });

        return Array.isArray(response) ? response : response.tasks || [];
    }

    async getTaskDetail(taskId: number): Promise<Task> {
        const response = await this.request<TaskDetailResponse>('GET', `/tasks/${taskId}`);
        return this.unwrapSingle<Task>(response, 'task');
    }

    async getProducts(): Promise<Product[]> {
        const response = await this.request<ProductListResponse>('GET', '/products');
        return Array.isArray(response) ? response : response.products || [];
    }

    async getMyBugs(status?: BugStatus, productId?: number): Promise<Bug[]> {
        let targetProductId = productId;
        if (!targetProductId) {
            const products = await this.getProducts();
            if (products.length === 0) {
                throw new Error('没有可用的产品');
            }
            targetProductId = products[0].id;
        }

        const response = await this.request<BugListResponse>('GET', `/products/${targetProductId}/bugs`);
        const bugs = Array.isArray(response) ? response : response.bugs || [];

        return bugs.filter((bug: any) => {
            const assignee = typeof bug.assignedTo === 'string' ? bug.assignedTo : bug.assignedTo?.account;
            const statusMatched = !status || status === 'all' || bug.status === status;
            const assigneeMatched = !assignee || assignee === this.config.username;
            return statusMatched && assigneeMatched;
        });
    }

    async getBugDetail(bugId: number): Promise<Bug> {
        const response = await this.request<BugDetailResponse>('GET', `/bugs/${bugId}`);
        return this.unwrapSingle<Bug>(response, 'bug');
    }

    async updateTask(taskId: number, update: TaskUpdate): Promise<Task> {
        return await this.request<Task>('PUT', `/tasks/${taskId}`, undefined, {
            ...update,
            assignedTo: this.config.username,
        });
    }

    async finishTask(taskId: number, update: TaskUpdate = {}): Promise<Task> {
        return await this.request<Task>('POST', `/tasks/${taskId}/finish`, undefined, {
            assignedTo: this.config.username,
            ...update,
        });
    }

    async resolveBug(bugId: number, resolution: BugResolution): Promise<Bug> {
        return await this.request<Bug>('POST', `/bugs/${bugId}/resolve`, undefined, {
            assignedTo: this.config.username,
            ...resolution,
        });
    }

    async createTask(task: CreateTaskRequest): Promise<Task> {
        if (!task.execution) {
            throw new Error('创建任务需要指定执行 ID');
        }

        const formData = new URLSearchParams();
        Object.entries(task).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        });

        return await this.request<Task>('POST', `/executions/${task.execution}/tasks`, undefined, formData);
    }

    private unwrapSingle<T>(response: T | Record<string, T | undefined>, key: string): T {
        if (response && typeof response === 'object' && key in response) {
            const wrapped = response as Record<string, T | undefined>;
            if (wrapped[key]) {
                return wrapped[key] as T;
            }
        }

        return response as T;
    }
}
