import { z } from 'zod';

export const summarizeSchema = z.object({
  body: z.object({
    youtubeUrl: z.string().url('Invalid YouTube URL').refine(
      (url) => url.includes('youtube.com') || url.includes('youtu.be'),
      'Must be a valid YouTube URL'
    ),
  }),
});

export const generateFormatSchema = z.object({
  body: z.object({
    format: z.enum(['keyPoints', 'motivational', 'timestamps', 'insight']),
  }),
  params: z.object({
    id: z.string().min(1, 'Summary ID is required'),
  }),
});

export const getByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Summary ID is required'),
  }),
});

export const historyQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
  }),
});

export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
  }),
});

export const exportQuerySchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  query: z.object({
    format: z.enum(['md', 'pdf']),
  }),
});

export type SummarizeInput = z.infer<typeof summarizeSchema>['body'];
export type GenerateFormatInput = z.infer<typeof generateFormatSchema>['body'];
