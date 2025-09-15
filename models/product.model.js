import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
    },
    description: {
      type: String,
    },
    category: {
      type: String,
      enum: ["pizza", "sides", "drinks", "desserts"],
      required: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
    },
    imageUrl: {
      type: String,
    },
    available: {
      type: Boolean,
      default: true,
    },
    sizes: [
      {
        size: { type: String, enum: ["small", "medium", "large"] },
        price: { type: Number, required: true },
      },
    ],
    ingredients: [String],
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
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id; // expose "id" instead of "_id"
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
