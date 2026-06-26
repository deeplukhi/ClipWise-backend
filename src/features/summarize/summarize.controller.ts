import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import type { DeviceRequest } from '@/infrastructure/middleware/device.middleware';
import { summarizeService } from './summarize.service';
import { shareService } from '@/features/share/share.service';
import { ResponseUtil } from '@/infrastructure/utils/response.util';
import { getIO } from '@/infrastructure/socket';
import { env } from '@/config/env.config';
import { createLogger } from '@/infrastructure/utils/logger.util';

const logger = createLogger('SummarizeController');

function emit(room: string, event: string, data: any) {
  try {
    const io = getIO();
    if (io) io.to(room).emit(event, data);
  } catch { /* socket unavailable */ }
}

function processSyncJob(jobId: string, youtubeUrl: string, deviceId?: string) {
  setTimeout(async () => {
    try {
      const result = await summarizeService.summarize(youtubeUrl, deviceId, (progress, step) => {
        emit(`job:${jobId}`, 'job:progress', { jobId, progress, step });
      });
      emit(`job:${jobId}`, 'job:completed', { jobId, summaryId: result.id });
    } catch (error: any) {
      logger.error('Sync job failed', { jobId, message: error?.message });
      emit(`job:${jobId}`, 'job:failed', { jobId, error: error?.message || 'Unknown error' });
    }
  }, 1500);
}

export class SummarizeController {
  static async create(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      const { youtubeUrl } = req.body;
      const jobId = crypto.randomUUID();
      ResponseUtil.created(res, { jobId }, 'Summary queued');
      processSyncJob(jobId, youtubeUrl, req.deviceId);
    } catch (error) {
      next(error);
    }
  }

  static async generateFormat(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      const { format } = req.body;
      const { id } = req.params;
      const result = await summarizeService.generateFormat(id, format);
      ResponseUtil.success(res, result, `${format} generated successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async history(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
      const result = await summarizeService.getHistory(req.deviceId, page, limit);
      ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      const result = await summarizeService.getById(req.params.id);
      ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async search(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
      const result = await summarizeService.search(req.deviceId, q, page, limit);
      ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      await summarizeService.remove(req.params.id);
      ResponseUtil.success(res, undefined, 'Summary deleted');
    } catch (error) {
      next(error);
    }
  }

  static async createShare(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { pin } = req.body;
      const share = await shareService.create(id, pin);
      ResponseUtil.created(res, {
        slug: share.slug,
        url: `${env.SHARE_BASE_URL}/${share.slug}`,
      }, 'Share link created');
    } catch (error) {
      next(error);
    }
  }

  static async export(req: DeviceRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const format = req.query.format as string;
      const summary = await summarizeService.getById(id);

      if (format === 'md') {
        const md = summarizeService.generateMarkdown(summary);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="clipwise-${id}.md"`);
        return res.send(md);
      }

      if (format === 'pdf') {
        return summarizeService.generatePDF(summary, res);
      }

      return ResponseUtil.error(res, 'Invalid format', 400);
    } catch (error) {
      next(error);
    }
  }
}
