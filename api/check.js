import { BulkChecker } from './utils/queueManager.js';
import logger from './utils/logger.js';

// In-memory store (gunakan Redis untuk production)
const processes = new Map();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const { requestId } = req.query;
            if (!requestId) {
                return res.status(400).json({ error: 'requestId required' });
            }
            const process = processes.get(requestId);
            if (!process) {
                return res.status(404).json({ error: 'Process not found' });
            }
            return res.status(200).json({
                completed: process.completed,
                results: process.results,
                total: process.total,
                processed: process.results.length,
                error: process.error
            });
        }

        if (req.method === 'DELETE') {
            const { requestId } = req.query;
            if (requestId && processes.has(requestId)) {
                const process = processes.get(requestId);
                process.stop = true;
                processes.delete(requestId);
            }
            return res.status(200).json({ message: 'Stopped' });
        }

        if (req.method === 'POST') {
            const { combolist, delay, threads, proxies } = req.body;

            if (!combolist) {
                return res.status(400).json({ error: 'combolist is required' });
            }

            const accounts = combolist.split('\n')
                .map(line => line.trim())
                .filter(line => line.includes(':'))
                .map(line => {
                    const [email, password] = line.split(':');
                    return { email: email.trim(), password: password.trim() };
                });

            if (accounts.length === 0) {
                return res.status(400).json({ error: 'No valid accounts found' });
            }

            const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            const process = {
                id: requestId,
                accounts,
                delay: parseInt(delay) || 2000,
                threads: parseInt(threads) || 3,
                proxies: proxies || [],
                results: [],
                completed: false,
                stop: false,
                error: null
            };
            processes.set(requestId, process);

            // Jalankan di background
            runChecker(process).catch(err => {
                logger.error('Background process error:', err);
                process.error = err.message;
                process.completed = true;
            });

            return res.status(202).json({ requestId, message: 'Checking started' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        logger.error('Unhandled error in handler:', error);
        return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
}

async function runChecker(process) {
    const { accounts, delay, threads, proxies } = process;
    const checker = new BulkChecker({
        concurrency: threads,
        delayBetweenRequests: delay,
        maxRetries: 3,
        proxyList: proxies
    });

    // Override checkSingleAccount untuk mengumpulkan hasil
    const originalCheck = checker.checkSingleAccount.bind(checker);
    checker.checkSingleAccount = async (account, proxy) => {
        if (process.stop) {
            throw new Error('Process stopped by user');
        }
        const result = await originalCheck(account, proxy);
        process.results.push(result);
        return result;
    };

    try {
        await checker.startFromArray(accounts);
        process.completed = true;
    } catch (error) {
        process.error = error.message;
        process.completed = true;
    }
              }
