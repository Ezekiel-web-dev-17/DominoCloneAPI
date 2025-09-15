export const processPayment = async (order, paymentDetails) => {
  // In a real app, call Paystack / Stripe API here
  // For now, simulate success
  return {
    status: "success",
    transactionId: `TX-${Date.now()}`,
    amount: order.totalPrice,
    currency: "USD",
    method: paymentDetails.method || "card",
  };
};

export const refundPayment = async (transactionId) => {
  // Simulated refund
  return {
    status: "refunded",
    transactionId,
  };
};
