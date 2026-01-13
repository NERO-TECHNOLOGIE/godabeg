import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import botLogic from './BotLogic.js';
import queueService from './QueueService.js';
import path from 'path';
import fs from 'fs';

class InstanceManager {
    constructor() {
        this.instances = new Map();
        this.maxInstances = 20;
    }

    async initInstance(id) {
        if (this.instances.has(id)) {
            return { success: false, message: `Instance ${id} is already initialized.` };
        }

        if (this.instances.size >= this.maxInstances) {
            return { success: false, message: `Maximum instance limit (${this.maxInstances}) reached.` };
        }

        console.log(`[Manager] Initializing instance ${id}...`);

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `instance-${id}`,
                dataPath: `./sessions/instance-${id}`
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ],
                handleSIGINT: false
            }
        });

        const instanceData = {
            id,
            client,
            status: 'initializing',
            qr: null,
            ready: false
        };

        this.instances.set(id, instanceData);

        client.on('qr', (qr) => {
            console.log(`[Instance ${id}] QR RECEIVED`);
            instanceData.qr = qr;
            instanceData.status = 'awaiting_scan';
        });

        client.on('ready', () => {
            console.log(`[Instance ${id}] Client is ready!`);
            instanceData.ready = true;
            instanceData.status = 'ready';
            instanceData.qr = null;
        });

        client.on('message', async (msg) => {
            // Processing via in-memory queue (handles concurrency per user)
            queueService.processMessage(id, client, msg);
        });

        client.on('disconnected', (reason) => {
            console.log(`[Instance ${id}] Disconnected: ${reason}`);
            instanceData.ready = false;
            instanceData.status = 'disconnected';
        });

        // Initialize in background to avoid blocking the HTTP response
        client.initialize().catch(error => {
            console.error(`[Instance ${id}] Initialization failed:`, error);
            this.instances.delete(id);
        });

        return { success: true, message: `L'initialisation de l'instance ${id} a démarré en arrière-plan.` };
    }

    getInstance(id) {
        return this.instances.get(id);
    }

    getAllInstances() {
        return Array.from(this.instances.values()).map(inst => ({
            id: inst.id,
            status: inst.status,
            ready: inst.ready,
            hasQr: !!inst.qr
        }));
    }

    async stopInstance(id) {
        const instance = this.instances.get(id);
        if (instance) {
            await instance.client.destroy();
            this.instances.delete(id);
            return true;
        }
        return false;
    }
}

export default new InstanceManager();