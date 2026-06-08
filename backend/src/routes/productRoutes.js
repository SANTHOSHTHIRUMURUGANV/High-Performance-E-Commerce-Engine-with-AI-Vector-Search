import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  semanticSearch,
  getProductStats
} from '../controllers/productController.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/stats', getProductStats);
router.get('/search', semanticSearch);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
