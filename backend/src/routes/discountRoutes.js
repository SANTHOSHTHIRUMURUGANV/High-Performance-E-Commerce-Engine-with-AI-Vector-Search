import express from 'express';
import { getDiscounts, createDiscount, toggleDiscount } from '../controllers/discountController.js';

const router = express.Router();

router.get('/', getDiscounts);
router.post('/', createDiscount);
router.put('/:id/toggle', toggleDiscount);

export default router;
