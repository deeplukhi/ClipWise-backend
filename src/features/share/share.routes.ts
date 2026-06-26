import { Router } from 'express';
import { ShareController } from './share.controller';
import { validate } from '@/infrastructure/middleware/validate.middleware';
import { createShareSchemaValidator, getShareSchema } from './share.schema';

export const createShareValidator = validate(createShareSchemaValidator);

const router: Router = Router();

router.get('/:slug', validate(getShareSchema), ShareController.getBySlug);

export default router;
