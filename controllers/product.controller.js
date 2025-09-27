import logger from "../config/logger.config.js";
import { Product } from "../models/product.model.js";
import redis from "../utils/redis.util.js";
import { errorResponse, successResponse } from "../utils/response.util.js";
import { v2 as cloudinary } from "cloudinary";

/* ================= CREATE PRODUCT ================= */
export const createProduct = async (req, res, next) => {
  try {
    let {
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

    if (typeof sizes === "string") sizes = JSON.parse(sizes);
    if (typeof toppings === "string") toppings = JSON.parse(toppings);

    if (!name || !category || !sizes || !sizes.length) {
      return errorResponse(
        res,
        "Product name, category, and at least one size with price are required!",
        400
      );
    }

    if (!req.file) return errorResponse(res, "Product image is required.", 400);

    const existingProduct = await Product.findOne({ name });
    if (existingProduct) {
      return errorResponse(res, "Product with this name already exists!", 400);
    }

    // Upload product image to Cloudinary from buffer
    // 🚀 FIXED: Proper Cloudinary upload with buffer
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            public_id: `domino-product-${Date.now()}`,
            folder: "domino-products",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    const optimizeUrl = cloudinary.url(uploadResult.public_id, {
      fetch_format: "auto",
      quality: "auto",
    });

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
      productImage: uploadResult.secure_url,
      optimizedImage: optimizeUrl,
    });

    await product.save();

    redis.del("All products: ");

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

    redis.del("All products: ");
    redis.del("All recommended products: ");

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

    redis.del("All products: ");

    return successResponse(res, { message: "Product deleted successfully!" });
  } catch (error) {
    next(error);
  }
};

/* ================= TOGGLE AVAILABILITY ================= */
export const toggleAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prevProduct = await Product.findById(id);

    if (!prevProduct) return errorResponse(res, "Product not found!", 404);

    await prevProduct.updateOne({ available: !prevProduct.available });

    redis.del("All products: ");

    return successResponse(res, {
      prevProduct,
      message: `Product is now ${
        !prevProduct.available ? "available" : "unavailable"
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
    const { name, description, tags } = req.query;

    if (!name && !description && !tags)
      return errorResponse(res, "Name, Description or Tags is required!", 400);

    for (const query in req.query) {
      if (query !== "tags") {
        const products = await Product.find({
          [`${query}`]: req.query[query].replaceAll("%20", " "),
        });

        logger.info(`Search for: ${req.query[query]}`);
        return successResponse(res, {
          products,
          message: "Search results fetched!",
        });
      }

      const products = await Product.find({
        tags,
      });

      const tagProducts = products.filter((product) =>
        product.tags.includes(req.query[query])
      );

      return successResponse(res, {
        products: tagProducts,
        message: "Search results fetched!",
      });
    }
  } catch (error) {
    next(error);
  }
};
