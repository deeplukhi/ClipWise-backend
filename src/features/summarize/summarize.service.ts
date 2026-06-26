import PDFDocument from 'pdfkit';
import { YoutubeTranscript } from 'youtube-transcript';
import prisma from '@/shared/prisma';
import { env } from '@/config/env.config';
import { BadRequestError, InternalServerError } from '@/infrastructure/utils/errors.util';
import { RateLimiter } from '@/infrastructure/utils/rate-limiter.util';
import type { Response } from 'express';

const OR_API = 'https://openrouter.ai/api/v1/chat/completions';

// OpenRouter free tier: ~20 req/min, cap at 18, max 3 concurrent, 1s min interval
const aiLimiter = new RateLimiter(18, 60_000, 3, 1_000);

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(YT_REGEX);
  return match ? match[1] : null;
}

const MAX_TRANSCRIPT_LENGTH = 8_000;

async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    const text = items.map(i => i.text).join(' ');
    return text.length > MAX_TRANSCRIPT_LENGTH
      ? text.slice(0, MAX_TRANSCRIPT_LENGTH) + '... [transcript truncated]'
      : text;
  } catch (err: any) {
    if (err.message?.includes('disabled')) {
      throw new BadRequestError('Transcripts are disabled for this video');
    }
    if (err.message?.includes('unavailable')) {
      throw new BadRequestError('This video is unavailable');
    }
    throw new BadRequestError('Could not fetch transcript. The video may not have captions.');
  }
}

async function getVideoTitle(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (response.ok) {
      const data: any = await response.json();
      return data.title || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function callAI(prompt: string, transcript: string): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new InternalServerError('OPENROUTER_API_KEY is not set in .env');
  }
  const result = await aiLimiter.schedule(async () => {
    const res = await fetch(OR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a precise YouTube video summarizer. Read the transcript carefully and produce accurate, fact-based summaries. Do not hallucinate or add information not present in the transcript. Use the exact terminology from the video.',
          },
          { role: 'user', content: `${prompt}\n\nTranscript:\n${transcript}` },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new InternalServerError(`OpenRouter ${res.status}: ${text}`);
    }

    const json = await res.json() as { choices: { message: { content: string } }[] };
    return json.choices[0].message.content;
  });
  return result;
}

const PROMPTS: Record<string, string> = {
  summary: `Summarize this YouTube video transcript concisely in 3-5 paragraphs. Include specific details, data points, and examples mentioned in the video. Cover: the main topic, key arguments, evidence presented, and conclusions.`,
  keyPoints: `Extract the 7-10 most important specific points from this video transcript. Format as a numbered list. Each point must include specific details, numbers, or examples from the video.`,
  motivational: `Rewrite the core message of this video in an inspiring tone. Use specific examples and stories from the transcript to make it compelling. Write 2-3 paragraphs.`,
  timestamps: `Create a timeline of the key moments covered in this video transcript. Group related segments together. Format each entry as:
[MM:SS] Topic title — brief description of what was covered
Aim for 5-8 entries covering the full video.`,
  insight: `Provide thoughtful analysis of this video transcript. Include: non-obvious takeaways, connections to broader context, implications of the ideas presented. Support each insight with specific evidence from the transcript. Write 3-4 paragraphs.`,
};

export const summarizeService = {
  async summarize(youtubeUrl: string, deviceId?: string, onProgress?: (progress: number, step: string) => void) {
    onProgress?.(5, 'Validating URL');
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) throw new BadRequestError('Could not extract video ID from URL');

    const existing = await prisma.summary.findFirst({ where: { youtubeUrl, deviceId: deviceId || null } });
    if (existing) {
      onProgress?.(100, 'Cached');
      return existing;
    }

    onProgress?.(15, 'Fetching transcript');
    const [transcript, videoTitle] = await Promise.all([
      fetchTranscript(videoId),
      getVideoTitle(videoId),
    ]);

    onProgress?.(40, 'Generating summary with AI');
    const summary = await callAI(PROMPTS.summary, transcript);

    onProgress?.(85, 'Saving to database');
    const saved = await prisma.summary.create({
      data: { youtubeUrl, videoTitle, transcript, summary, deviceId },
    });

    onProgress?.(100, 'Complete');
    return saved;
  },

  async generateFormat(id: string, format: string) {
    const existing = await prisma.summary.findUnique({ where: { id } });
    if (!existing) throw new BadRequestError('Summary not found');
    if (!existing.transcript) throw new BadRequestError('Transcript not available');
    if (!PROMPTS[format]) throw new BadRequestError(`Unknown format: ${format}`);

    const content = await callAI(PROMPTS[format], existing.transcript);

    const updated = await prisma.summary.update({
      where: { id },
      data: { [format]: content },
    });

    return updated;
  },

  async getHistory(deviceId?: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const where = deviceId ? { deviceId } : { deviceId: null };
    const [data, total] = await Promise.all([
      prisma.summary.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.summary.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(id: string) {
    const summary = await prisma.summary.findUnique({ where: { id } });
    if (!summary) throw new BadRequestError('Summary not found');
    return summary;
  },

  async remove(id: string) {
    const summary = await prisma.summary.findUnique({ where: { id } });
    if (!summary) throw new BadRequestError('Summary not found');
    await prisma.summary.delete({ where: { id } });
  },

  async search(deviceId: string | undefined, query: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const sanitized = query.replace(/[^\w\s]/g, '').trim();
    if (!sanitized) throw new BadRequestError('Invalid search query');

    const like = `%${sanitized}%`;
    const deviceWhere = deviceId ? `"deviceId" = $5` : `"deviceId" IS NULL`;

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, "youtubeUrl", "videoTitle", summary,
        ts_rank(
          to_tsvector('english', coalesce(summary, '') || ' ' || coalesce("videoTitle", '')),
          plainto_tsquery('english', $1)
        ) AS rank
      FROM "summaries"
      WHERE (to_tsvector('english', coalesce(summary, '') || ' ' || coalesce("videoTitle", ''))
        @@ plainto_tsquery('english', $1)
         OR "summary" ILIKE $4
         OR "videoTitle" ILIKE $4)
        AND ${deviceWhere}
      ORDER BY
        CASE WHEN to_tsvector('english', coalesce(summary, '') || ' ' || coalesce("videoTitle", ''))
          @@ plainto_tsquery('english', $1) THEN ts_rank(
            to_tsvector('english', coalesce(summary, '') || ' ' || coalesce("videoTitle", '')),
            plainto_tsquery('english', $1)
          ) ELSE 0 END DESC,
        "summary" ILIKE $4 DESC
      LIMIT $2 OFFSET $3
    `, sanitized, limit, skip, like, ...(deviceId ? [deviceId] : []));

    const countResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS count
      FROM "summaries"
      WHERE (to_tsvector('english', coalesce(summary, '') || ' ' || coalesce("videoTitle", ''))
        @@ plainto_tsquery('english', $1)
         OR "summary" ILIKE $2
         OR "videoTitle" ILIKE $2)
        AND ${deviceWhere}
    `, sanitized, like, ...(deviceId ? [deviceId] : []));

    const total = countResult[0]?.count ?? 0;

    return {
      data: rows.map((r: any) => ({ ...r, rank: Number(r.rank) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  generateMarkdown(summary: any): string {
    return [
      `# ${summary.videoTitle || 'Video Summary'}`,
      '',
      '## Summary',
      summary.summary || '',
      '',
      '## Key Points',
      summary.keyPoints || '*Not generated*',
      '',
      '## Motivational',
      summary.motivational || '*Not generated*',
      '',
      '## Timeline',
      summary.timestamps || '*Not generated*',
      '',
      '## Insights',
      summary.insight || '*Not generated*',
      '',
      '---',
      `*Generated by ClipWise — [${summary.youtubeUrl}](${summary.youtubeUrl})*`,
    ].join('\n');
  },

  generatePDF(summary: any, res: Response): void {
    const doc = new PDFDocument({ margin: 50, info: { Title: summary.videoTitle || 'Video Summary' } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="clipwise-${summary.id}.pdf"`);
    doc.pipe(res);

    const title = summary.videoTitle || 'Video Summary';
    doc.fontSize(22).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#888').text(summary.youtubeUrl, { align: 'center' });
    doc.moveDown(1.5);

    const sections: [string, string | null][] = [
      ['Summary', summary.summary],
      ['Key Points', summary.keyPoints],
      ['Motivational', summary.motivational],
      ['Timeline', summary.timestamps],
      ['Insights', summary.insight],
    ];

    for (const [label, content] of sections) {
      if (!content) continue;
      doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text(label);
      doc.moveDown(0.3);
      doc.fillColor('#333').fontSize(10).font('Helvetica').text(content, { align: 'justify' });
      doc.moveDown(1);
    }

    doc.fontSize(8).fillColor('#aaa').text('Generated by ClipWise', { align: 'center' });
    doc.end();
  },
};
