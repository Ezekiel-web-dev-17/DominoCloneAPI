import request from "supertest";
import app from "../app.js";

describe("Auth Routes", () => {
  it("should return 404 for an auth route", async () => {
    const res = await request(app).get("/api/auth/play");
    expect(res.statusCode).toBe(404);
  });
});
