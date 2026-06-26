import { Job } from 'bull';
import { getQueue } from './queue';
import { summarizeService } from '@/features/summarize/summarize.service';
import { getIO } from '@/infrastructure/socket';
import { createLogger } from '@/infrastructure/utils/logger.util';

const logger = createLogger('SummarizeWorker');

export function startSummarizeWorker() {
  const queue = getQueue();
  if (!queue) {
    logger.warn('Queue not available, worker not started');
    return;
  }

  logger.info('Worker registered, waiting for jobs...');

  queue.process(async (job: Job<{ youtubeUrl: string }>) => {
    const { youtubeUrl } = job.data;
    const io = getIO();
    const room = `job:${job.id}`;

    const emit = (progress: number, step: string) => {
      job.progress(progress);
      io.to(room).emit('job:progress', { jobId: job.id, progress, step });
    };

    try {
      logger.info('Processing job', { jobId: job.id });

      const result = await summarizeService.summarize(youtubeUrl, undefined, emit);

      io.to(room).emit('job:completed', { jobId: job.id, summaryId: result.id });
      logger.info('Job completed', { jobId: job.id, summaryId: result.id });

      return result;
    } catch (error: any) {
      logger.error('Job failed', error, { jobId: job.id });
      io.to(room).emit('job:failed', { jobId: job.id, error: error.message });
      throw error;
    }
  });
}
