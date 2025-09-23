import request from "supertest";
import app from "../app.js"; // your express app
import { mock } from "jest";

mock("../middleware/arcjet.middleware.js", () => (req, res, next) => next());

it("should create a new user", async () => {
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: "test@example.com", password: "StrongPass123!" });

  expect(res.statusCode).toBe(201);
  expect(res.body).toHaveProperty("user");
  expect(res.body).toHaveProperty("tokens");

  done();
});
