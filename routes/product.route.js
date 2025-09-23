import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleAvailability,
  getRecommendedProducts,
  searchProducts,
} from "../controllers/product.controller.js";
import { authMiddleware, isAdmin } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";
import { cache } from "../middleware/redis.middleware.js";

const productRoute = express.Router();

/* ================= CRUD ================= */
// Create a new product
productRoute.post("/", isAdmin, upload.single("file"), createProduct);

// Get all products (with optional filters: category, available, search, pagination)
productRoute.get("/", cache("All products: "), getAllProducts);

// Get recommended products
productRoute.get(
  "/recommended",
  cache("All recommended products: "),
  getRecommendedProducts
);

// Search products by query
productRoute.get("/search", searchProducts);

// Get single product by ID
productRoute.get("/:id", getProductById);

// Update product by ID
productRoute.patch("/:id", authMiddleware, isAdmin, updateProduct);

// Delete product by ID
productRoute.delete("/:id", authMiddleware, isAdmin, deleteProduct);

// Toggle availability (quick switch)
productRoute.patch(
  "/:id/availability",
  authMiddleware,
  isAdmin,
  toggleAvailability
);

export default productRoute;
