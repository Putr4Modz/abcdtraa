import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import jwt from 'jsonwebtoken';
import logger from './logger.js';

export class JWTManager {
    constructor(cookieJar, baseURL = 'https://mtacc.mobilelegends.com') {
        this.cookieJar = cookieJar;
        this.client = wrapper(axios.create({
            jar: cookieJar,
            withCredentials: true,
            baseURL,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        }));
        this.token = null;
        this.refreshToken = null;
    }

    async login(email, password) {
        try {
            const payload = {
                email,
                password,
                deviceInfo: this._getDeviceFingerprint()
            };
            const response = await this.client.post('/api/login', payload);

            if (response.data?.token) {
                this.token = response.data.token;
                this.refreshToken = response.data.refreshToken || null;

                const decoded = jwt.decode(this.token);
                logger.info(`Login success for ${email}`, { expires: decoded?.exp });

                return {
                    success: true,
                    token: this.token,
                    expires: decoded?.exp,
                    account: response.data.account || {}
                };
            } else {
                logger.warn(`Login failed for ${email}: ${response.data?.message}`);
                return {
                    success: false,
                    message: response.data?.message || 'Login failed'
                };
            }
        } catch (error) {
            logger.error(`Login error for ${email}`, error);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    async refreshAccessToken() {
        if (!this.refreshToken) return false;
        try {
            const response = await this.client.post('/api/refresh', {
                refreshToken: this.refreshToken
            });
            if (response.data?.token) {
                this.token = response.data.token;
                logger.debug('Token refreshed');
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Refresh token failed', error);
            return false;
        }
    }

    _getDeviceFingerprint() {
        return {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            screenResolution: '1920x1080',
            timezone: 'Asia/Jakarta',
            language: 'en-US',
            platform: 'Win32',
            hardwareConcurrency: 8,
            deviceMemory: 8
        };
    }
          }
