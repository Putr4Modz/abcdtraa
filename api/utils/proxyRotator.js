import logger from './logger.js';

export class ProxyRotator {
    constructor(proxyList = []) {
        this.proxies = proxyList.filter(p => p && typeof p === 'string');
        this.currentIndex = 0;
        this.failedProxies = new Set();
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;

        const startIndex = this.currentIndex;
        while (true) {
            const proxy = this.proxies[this.currentIndex];
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

            if (!this.failedProxies.has(proxy)) {
                return proxy;
            }

            if (this.currentIndex === startIndex) {
                logger.warn('All proxies have failed, returning null');
                return null;
            }
        }
    }

    markProxyFailed(proxy) {
        if (proxy) {
            this.failedProxies.add(proxy);
            logger.warn(`Proxy marked as failed: ${proxy}`);
        }
    }

    addProxies(newProxies) {
        this.proxies.push(...newProxies.filter(p => p && !this.proxies.includes(p)));
    }

    getStats() {
        return {
            total: this.proxies.length,
            failed: this.failedProxies.size,
            working: this.proxies.length - this.failedProxies.size
        };
    }
}
