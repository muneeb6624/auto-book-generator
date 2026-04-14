import { Router } from 'express';
import {
  createBook,
  getBook,
  generateOutlineHandler,
  patchOutlineReview,
  planChapters,
  unlockAllChapters,
  patchFinalReview,
  patchBook,
} from '../controllers/bookController.js';
import { listChaptersForBook } from '../controllers/chapterController.js';
import { compileBook } from '../controllers/compileController.js';

const router = Router();

router.post('/', createBook);
router.get('/:id/chapters', listChaptersForBook);
router.get('/:id', getBook);
router.patch('/:id', patchBook);
router.post('/:id/outline/generate', generateOutlineHandler);
router.patch('/:id/outline/review', patchOutlineReview);
router.post('/:id/chapters/plan', planChapters);
router.post('/:id/chapters/unlock-all', unlockAllChapters);
router.patch('/:id/final-review', patchFinalReview);
router.post('/:id/compile', compileBook);

export default router;
