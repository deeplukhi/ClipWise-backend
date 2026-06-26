import { Request, Response, NextFunction } from 'express';
import { shareService } from './share.service';
import { ResponseUtil } from '@/infrastructure/utils/response.util';

export class ShareController {
  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const { pin } = req.query;
      const share = await shareService.getBySlug(slug, pin as string | undefined);
      ResponseUtil.success(res, share.summary);
    } catch (error) {
      next(error);
    }
  }
}
