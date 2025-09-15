import { Product } from "../models/product.model.js";
import { errorResponse, successResponse } from "../utils/response.util.js";

/* ================= CREATE PRODUCT ================= */
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      imageUrl,
      available,
      sizes,
      toppings,
      customizable,
      prepTime,
      tags,
      rating,
      isRecommended,
    } = req.body;

    if (!name || !category || !sizes || !sizes.length) {
      return errorResponse(
        res,
        "Product name, category, and at least one size with price are required!",
        400
      );
    }

    const existingProduct = await Product.findOne({ name });
    if (existingProduct) {
      return errorResponse(res, "Product with this name already exists!", 400);
    }

    const product = new Product({
      name,
      description,
      category,
      imageUrl,
      available,
      sizes,
      toppings,
      customizable,
      prepTime,
      tags,
      rating,
      isRecommended,
    });

    await product.save();

    return successResponse(
      res,
      { product, message: "Product created successfully!" },
      201
    );
  } catch (error) {
    next(error);
  }
};

/* ================= GET ALL PRODUCTS ================= */
export const getAllProducts = async (req, res, next) => {
  try {
    const { category, available, search, limit = 20, page = 1 } = req.query;
    const query = {};

    if (category) query.category = category;
    if (available !== undefined) query.available = available === "true";
    if (search)
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];

    const skip = (page - 1) * limit;
    const products = await Product.find(query)
      .skip(skip)
      .limit(Number(limit))
      .lean(true);

    return successResponse(res, {
      products,
      message: "Products fetched successfully!",
    });
  } catch (error) {
    next(error);
  }
};

/* ================= GET SINGLE PRODUCT ================= */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return errorResponse(res, { message: "Product not found!" }, 404);
    }

    return successResponse(res, {
      product,
      message: "Product fetched successfully!",
    });
  } catch (error) {
    next(error);
  }
};

/* ================= UPDATE PRODUCT ================= */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Optional: prevent changing name to an existing one
    if (updates.name) {
      const existing = await Product.findOne({
        name: updates.name,
        _id: { $ne: id },
      });
      if (existing)
        return errorResponse(
          res,
          { message: "Product name already in use!" },
          400
        );
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) return errorResponse(res, "Product not found!", 404);

    return successResponse(res, {
      product,
      message: "Product updated successfully!",
    });
  } catch (error) {
    next(error);
  }
};

/* ================= DELETE PRODUCT ================= */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) return errorResponse(res, "Product not found!", 404);

    return successResponse(res, { message: "Product deleted successfully!" });
  } catch (error) {
    next(error);
  }
};

/* ================= TOGGLE AVAILABILITY ================= */
export const toggleAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) return errorResponse(res, "Product not found!", 404);

    product.available = !product.available;
    await product.save();

    return successResponse(res, {
      product,
      message: `Product is now ${
        product.available ? "available" : "unavailable"
      }`,
    });
  } catch (error) {
    next(error);
  }
};

/* ================= GET RECOMMENDED PRODUCTS ================= */
export const getRecommendedProducts = async (req, res, next) => {
  try {
    const { category } = req.query;
    const query = { isRecommended: true };
    if (category) query.category = category;

    const products = await Product.find(query);

    return successResponse(res, {
      products,
      message: "Recommended products fetched!",
    });
  } catch (error) {
    next(error);
  }
};

/* ================= SEARCH PRODUCTS ================= */
export const searchProducts = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) return errorResponse(res, "Search query is required!", 400);

    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { tags: { $regex: query, $options: "i" } },
      ],
    });

    return successResponse(res, {
      products,
      message: "Search results fetched!",
    });
  } catch (error) {
    next(error);
  }
};
