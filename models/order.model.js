import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        size: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String },
    },
    status: {
      type: String,
      enum: [
        "placed",
        "pending",
        "preparing",
        "out-for-delivery",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    phone: {
      type: String,
      minLength: 10,
      match: [
        /^\+?[1-9]\d{0,3}[-.\s]?\(?\d+\)?([-.\s]?\d+)*$/,
        "Please provide a valid phone number",
      ],
      required: true,
    },
    orderCode: {
      type: String,
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

orderSchema.pre("save", async function (next) {
  try {
    // Generate order code if missing
    if (!this.orderCode) {
      this.orderCode =
        "ORD-" +
        Math.random().toString(36).substring(2, 6).toUpperCase() +
        "-" +
        Date.now().toString().slice(-5);
    }

    let total = 0;

    for (const item of this.items) {
      const product = await mongoose.model("Product").findById(item.product);
      if (!product) {
        throw new Error(`Product with id ${item.product} not found`);
      }

      // find the size entry inside product.sizes
      const sizeInfo = product.sizes.find((s) => s.size === item.size);
      if (!sizeInfo) {
        throw new Error(
          `Size '${item.size}' is not available for product ${product.name}`
        );
      }

      if (item.price !== sizeInfo.price)
        throw new Error(
          `The Price of this ${sizeInfo.size} ${product.name} is $${sizeInfo.price} not $${item.price}.`
        );

      // Enforce correct price from product
      item.price = sizeInfo.price;

      // compute line total
      total += item.quantity * item.price;
    }

    this.totalPrice = total;

    next();
  } catch (err) {
    next(err);
  }
});

export const Order = mongoose.model("Order", orderSchema);
