const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

class Logger {
    constructor(level = 'info') {
        this.level = levels[level] || levels.info;
    }

    _log(level, message, meta) {
        if (levels[level] >= this.level) {
            const timestamp = new Date().toISOString();
            const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
            console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
        }
    }

    debug(message, meta) { this._log('debug', message, meta); }
    info(message, meta) { this._log('info', message, meta); }
    warn(message, meta) { this._log('warn', message, meta); }
    error(message, meta) { this._log('error', message, meta); }

    setLevel(level) {
        this.level = levels[level] || levels.info;
    }
}

export default new Logger(process.env.LOG_LEVEL || 'info');
