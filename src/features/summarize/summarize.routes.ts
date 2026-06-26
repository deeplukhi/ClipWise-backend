import { Router } from 'express';
import { SummarizeController } from './summarize.controller';
import { validate } from '@/infrastructure/middleware/validate.middleware';
import { createShareValidator } from '@/features/share/share.routes';
import {
  summarizeSchema, generateFormatSchema, getByIdSchema,
  historyQuerySchema, searchQuerySchema, exportQuerySchema,
} from './summarize.schema';

const router: Router = Router();

router.post('/', validate(summarizeSchema), SummarizeController.create);
router.post('/:id/generate', validate(generateFormatSchema), SummarizeController.generateFormat);
router.post('/:id/share', createShareValidator, SummarizeController.createShare);
router.get('/search', validate(searchQuerySchema), SummarizeController.search);
router.get('/export/:id', validate(exportQuerySchema), SummarizeController.export);
router.get('/', validate(historyQuerySchema), SummarizeController.history);
router.get('/:id', validate(getByIdSchema), SummarizeController.getById);
router.delete('/:id', SummarizeController.remove);

export default router;
