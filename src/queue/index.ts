import { Queue } from 'bullmq';
import { GenerateJob } from '../types/pipeline';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = {
  host: redisUrl.includes('://') ? new URL(redisUrl).hostname : 'localhost',
  port: redisUrl.includes('://') ? parseInt(new URL(redisUrl).port) || 6379 : 6379,
};

export const generateQueue = new Queue<GenerateJob>('generate', {
  connection,
});