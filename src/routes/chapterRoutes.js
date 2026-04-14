import { Router } from 'express';
import { patchChapterNotes, generateChapter } from '../controllers/chapterController.js';

const router = Router();

router.patch('/:id/notes', patchChapterNotes);
router.post('/:id/generate', generateChapter);

export default router;
