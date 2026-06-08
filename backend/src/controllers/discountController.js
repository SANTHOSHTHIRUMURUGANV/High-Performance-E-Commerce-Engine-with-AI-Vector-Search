import Discount from '../models/Discount.js';

/**
 * GET /api/discounts
 * Retrieves all discount coupons.
 */
export const getDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find({}).sort({ createdAt: -1 });
    return res.status(200).json(discounts);
  } catch (error) {
    console.error('getDiscounts Error:', error);
    return res.status(500).json({ message: 'Error fetching discount coupons', error: error.message });
  }
};

/**
 * POST /api/discounts
 * Creates a new discount coupon.
 */
export const createDiscount = async (req, res) => {
  try {
    const { code, discountPercent, isActive, expiresAt } = req.body;

    if (!code || discountPercent === undefined) {
      return res.status(400).json({ message: 'Coupon code and discount percentage are required.' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check if coupon code already exists
    const existing = await Discount.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ message: `Coupon code "${cleanCode}" already exists.` });
    }

    const percent = parseFloat(discountPercent);
    if (isNaN(percent) || percent < 0 || percent > 100) {
      return res.status(400).json({ message: 'Discount percentage must be a number between 0 and 100.' });
    }

    const discount = new Discount({
      code: cleanCode,
      discountPercent: percent,
      isActive: isActive !== undefined ? isActive : true,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    await discount.save();
    return res.status(201).json(discount);
  } catch (error) {
    console.error('createDiscount Error:', error);
    return res.status(500).json({ message: 'Error creating coupon', error: error.message });
  }
};

/**
 * PUT /api/discounts/:id/toggle
 * Toggles a discount coupon active/inactive state.
 */
export const toggleDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({ message: 'Discount coupon not found.' });
    }

    discount.isActive = !discount.isActive;
    await discount.save();

    return res.status(200).json(discount);
  } catch (error) {
    console.error('toggleDiscount Error:', error);
    return res.status(500).json({ message: 'Error toggling discount state', error: error.message });
  }
};
