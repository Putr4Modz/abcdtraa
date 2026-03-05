import { VM } from 'vm2';
import logger from './logger.js';

export class SensorGenerator {
    _extractSensorFunction(jsCode) {
        const functionRegex = /function\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{[^}]*return\s+\[[^\]]*\]/g;
        const matches = [...jsCode.matchAll(functionRegex)];
        if (matches.length > 0) {
            return matches[0][0];
        }

        const varRegex = /var\s+([a-zA-Z0-9_]+)\s*=\s*\[[^\]]{100,}\]/g;
        const varMatches = [...jsCode.matchAll(varRegex)];
        if (varMatches.length > 0) {
            return varMatches[0][0];
        }

        throw new Error('Could not extract sensor function from JS');
    }

    generate(jsCode) {
        try {
            const sensorExpression = this._extractSensorFunction(jsCode);

            const vm = new VM({
                timeout: 1000,
                sandbox: {
                    window: {},
                    document: {
                        cookie: '',
                        referrer: '',
                        createElement: () => ({})
                    },
                    navigator: {
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        language: 'en-US',
                        platform: 'Win32'
                    },
                    screen: {
                        width: 1920,
                        height: 1080,
                        colorDepth: 24
                    }
                }
            });

            const codeToRun = `
                ${jsCode};
                if (typeof b === 'function') { b(); }
                else if (typeof sensor !== 'undefined') { sensor; }
                else { null; }
            `;
            const result = vm.run(codeToRun);
            if (Array.isArray(result) && result.length === 58) {
                logger.debug('Sensor data generated successfully');
                return result;
            } else {
                logger.warn('Sensor data not an array of length 58, using mock');
                return this._generateMockSensor();
            }
        } catch (error) {
            logger.error('Failed to execute sensor code', error);
            return this._generateMockSensor();
        }
    }

    _generateMockSensor() {
        return Array.from({ length: 58 }, () => Math.floor(Math.random() * 1000) - 500);
    }
}
