import Queue from 'bull';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

class QueueService {
    constructor() {
        this.redisConfig = {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined
        };

        // Queue for processing incoming messages
        this.incomingQueue = new Queue('incoming-messages', { redis: this.redisConfig });
        
        // Queue for sending replies
        this.outgoingQueue = new Queue('outgoing-replies', { redis: this.redisConfig });

        this.setupProcessors();
    }

    setupProcessors() {
        // Incoming message processor
        this.incomingQueue.process(async (job) => {
            const { instanceId, messageData } = job.data;
            // This will call BotLogic.handleMessage but via the queue
            console.log(`[Queue] Processing incoming for instance ${instanceId}`);
            // Logic to be linked in Manager
        });

        // Outgoing reply processor with human-like delay
        this.outgoingQueue.process(async (job) => {
            const { instanceId, chatId, text, options } = job.data;
            
            // Artificial delay (5 seconds as requested)
            const delay = 10000; 
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Logic to send actual message will be handled by providing the client to this service
            console.log(`[Queue] Sending reply for instance ${instanceId} after delay`);
        });
    }

    async addIncoming(instanceId, messageData) {
        await this.incomingQueue.add({ instanceId, messageData });
    }

    async addOutgoing(instanceId, chatId, text, options = {}) {
        await this.outgoingQueue.add({ instanceId, chatId, text, options });
    }
}

export default new QueueService();
