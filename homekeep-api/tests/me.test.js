const request = require("supertest");
const makeTestApp = require("./testApp");

async function registerAndGetToken(app) {
    const reg = await request(app)
        .post("/api/v1/auth/register")
        .send({ name: "Tamara", email: "tamara@test.com", password: "Password123!" });

    return reg.body.data.token;
}

describe("GET /api/v1/me", () => {
    test("no token → 401", async () => {
        const app = makeTestApp();
        const res = await request(app).get("/api/v1/me");
        expect(res.status).toBe(401);
    });

    test("valid token → 200 returns user", async () => {
        const app = makeTestApp();
        const token = await registerAndGetToken(app);

        const res = await request(app)
            .get("/api/v1/me")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe("tamara@test.com");
    });
});