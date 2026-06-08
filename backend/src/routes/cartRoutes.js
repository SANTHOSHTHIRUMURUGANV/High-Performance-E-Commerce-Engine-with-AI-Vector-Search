import express from 'express';
import { calculateTotal, checkout } from '../controllers/cartController.js';

const router = express.Router();

router.post('/calculate', calculateTotal);
router.post('/checkout', checkout);

export default router;
