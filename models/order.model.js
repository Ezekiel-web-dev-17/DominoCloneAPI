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
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
    },
    status: {
      type: String,
      enum: [
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
    },
    phoneNumber: {
      type: String,
      minLength: 10,
      matches: [
        /^\+?[1-9]\d{0,3}[-.\s]?\(?\d+\)?([-.\s]?\d+)*$/,
        "Please provide a valid phone number",
      ],
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
