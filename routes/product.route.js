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

const productRoute = express.Router();

/* ================= CRUD ================= */
// Create a new product
productRoute.post("/", createProduct);

// Get all products (with optional filters: category, available, search, pagination)
productRoute.get("/", getAllProducts);

// Get recommended products
productRoute.get("/recommended", getRecommendedProducts);

// Search products by query
productRoute.get("/search", searchProducts);

// Get single product by ID
productRoute.get("/:id", getProductById);

// Update product by ID
productRoute.patch("/:id", updateProduct);

// Delete product by ID
productRoute.delete("/:id", deleteProduct);

// Toggle availability (quick switch)
productRoute.patch("/:id/availability", toggleAvailability);

export default productRoute;
