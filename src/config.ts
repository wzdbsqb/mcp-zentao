import fs from 'fs';
import os from 'os';
import path from 'path';
import { errorLog } from './utils/logger.js';

const CONFIG_DIR = path.join(os.homedir(), '.zentao');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface ZentaoConfig {
    url: string;
    username: string;
    password: string;
    apiVersion: string;
}

export function saveConfig(config: ZentaoConfig): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadConfigFromEnv(): ZentaoConfig | null {
    const url = process.env.ZENTAO_URL?.trim();
    const username = process.env.ZENTAO_USERNAME?.trim();
    const password = process.env.ZENTAO_PASSWORD?.trim();
    const apiVersion = process.env.ZENTAO_API_VERSION?.trim() || 'v1';

    if (!url || !username || !password) {
        return null;
    }

    return { url, username, password, apiVersion };
}

export function loadConfig(): ZentaoConfig | null {
    try {
        const envConfig = loadConfigFromEnv();
        if (envConfig) {
            return envConfig;
        }

        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    } catch (error) {
        errorLog('读取配置文件失败:', error);
    }

    return null;
}

export function isConfigured(): boolean {
    return Boolean(loadConfigFromEnv()) || fs.existsSync(CONFIG_FILE);
}
