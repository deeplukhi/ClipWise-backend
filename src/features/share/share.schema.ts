import { z } from 'zod';

export const createShareSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    pin: z.string().length(4).optional(),
  }),
});

export const getShareSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  query: z.object({
    pin: z.string().optional(),
  }),
});

export const createShareSchemaValidator = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    pin: z.string().length(4).optional(),
  }),
});
