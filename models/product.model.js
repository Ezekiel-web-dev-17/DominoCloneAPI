import mongoose from "mongoose";

const sizeSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ["small", "medium", "large"],
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  sku: {
    type: String,
    unique: true,
  },
});

// Ensure no duplicate sizes per product
sizeSchema.path("size").validate(function (value) {
  const sizeSet = new Set(this.parent().sizes.map((s) => s.size));
  return sizeSet.size === this.parent().sizes.length;
}, "Duplicate sizes are not allowed!");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      unique: true,
    },
    description: String,
    category: {
      type: String,
      enum: ["pizza", "sides", "drinks", "desserts"],
      required: true,
    },
    imageUrl: String,
    available: {
      type: Boolean,
      default: true,
    },
    sizes: [sizeSchema],
    toppings: [String],
    customizable: {
      type: Boolean,
      default: false,
    },
    prepTime: {
      type: Number,
      default: 15,
    },
    tags: [String],
    rating: {
      type: Number,
      default: 0,
    },
    isRecommended: {
      type: Boolean,
      default: false,
    },
    productCode: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to generate productCode and per-size SKUs
productSchema.pre("save", function (next) {
  if (!this.productCode) {
    const categoryCode = this.category.slice(0, 2).toUpperCase();
    const id = String(this._id).slice(-3).toUpperCase();
    this.productCode = `${categoryCode}${id}`;
  }

  // Generate SKU for each size
  this.sizes = this.sizes.map((s) => {
    if (!s.sku) {
      s.sku = `${this.productCode}-${s.size.slice(0, 2).toUpperCase()}`;
    }
    return s;
  });

  next();
});

export const Product = mongoose.model("Product", productSchema);
