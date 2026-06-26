import { Router } from 'express';
import summarizeRoutes from '@/features/summarize/summarize.routes';
import shareRoutes from '@/features/share/share.routes';

const router: Router = Router();

router.use('/summarize', summarizeRoutes);
router.use('/share', shareRoutes);

export default router;
