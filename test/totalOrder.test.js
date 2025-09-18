import { calculateOrderTotal } from "../controllers/order.controller";

describe("calculateOrderTotal", () => {
  it("should return 0 for an empty cart", () => {
    const items = [];
    const total = calculateOrderTotal(items);
    expect(total).toBe(0);
  });

  it("should calculate total for a single item", () => {
    const items = [{ name: "Pizza", price: 12, quantity: 2 }];
    const total = calculateOrderTotal(items);
    expect(total).toBe(24); // 12 * 2
  });

  it("should calculate total for multiple items", () => {
    const items = [
      { name: "Pizza", price: 12, quantity: 2 },
      { name: "Burger", price: 8, quantity: 1 },
      { name: "Soda", price: 3, quantity: 3 },
    ];
    const total = calculateOrderTotal(items);
    expect(total).toBe(41); // (12*2) + (8*1) + (3*3)
  });

  it("should handle items with quantity 0", () => {
    const items = [{ name: "Fries", price: 5, quantity: 0 }];
    const total = calculateOrderTotal(items);
    expect(total).toBe(0);
  });
});
