const request = require("supertest");
const makeTestApp = require("./testApp");

describe("Auth", () => {
    test("register → 201 returns token", async () => {
        const app = makeTestApp();

        const res = await request(app)
            .post("/api/v1/auth/register")
            .send({ name: "Tamara", email: "tamara@test.com", password: "Password123!" });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeTruthy();
    });

    test("login → 200 returns token", async () => {
        const app = makeTestApp();

        await request(app)
            .post("/api/v1/auth/register")
            .send({ name: "Tamara", email: "tamara@test.com", password: "Password123!" });

        const res = await request(app)
            .post("/api/v1/auth/login")
            .send({ email: "tamara@test.com", password: "Password123!" });

        expect(res.status).toBe(200);
        expect(res.body.data.token).toBeTruthy();
    });
});