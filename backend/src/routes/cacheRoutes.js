import express from 'express';
import { getCacheKeys, purgeKey, purgeAllCache } from '../controllers/cacheController.js';

const router = express.Router();

router.get('/', getCacheKeys);
router.post('/purge-key', purgeKey);
router.post('/purge-all', purgeAllCache);

export default router;
