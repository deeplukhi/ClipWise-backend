import crypto from 'crypto';
import prisma from '@/shared/prisma';
import { BadRequestError, NotFoundError } from '@/infrastructure/utils/errors.util';

function generateSlug(): string {
  return crypto.randomBytes(4).toString('base64url').slice(0, 8);
}

export const shareService = {
  async create(summaryId: string, pin?: string) {
    const summary = await prisma.summary.findUnique({ where: { id: summaryId } });
    if (!summary) throw new NotFoundError('Summary not found');

    let slug: string;
    let attempts = 0;
    do {
      slug = generateSlug();
      attempts++;
    } while (await prisma.share.findUnique({ where: { slug } }) && attempts < 5);

    const share = await prisma.share.create({
      data: { slug, summaryId, pin },
    });

    return share;
  },

  async getBySlug(slug: string, pin?: string) {
    const share = await prisma.share.findUnique({
      where: { slug },
      include: { summary: true },
    });
    if (!share) throw new NotFoundError('Share link not found');

    if (share.pin && share.pin !== pin) {
      throw new BadRequestError('Invalid PIN');
    }

    await prisma.share.update({
      where: { id: share.id },
      data: { views: share.views + 1 },
    });

    return share;
  },
};
