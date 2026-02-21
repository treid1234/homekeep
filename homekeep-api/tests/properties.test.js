const request = require("supertest");
const makeTestApp = require("./testApp");

async function registerAndGetToken(app) {
    const reg = await request(app)
        .post("/api/v1/auth/register")
        .send({ name: "Tamara", email: "tamara@test.com", password: "Password123!" });

    return reg.body.data.token;
}

describe("Properties", () => {
    test("POST /api/v1/properties without token → 401", async () => {
        const app = makeTestApp();

        const res = await request(app).post("/api/v1/properties").send({
            nickname: "Home",
            addressLine1: "123 Main St",
            city: "Princeton",
            province: "BC",
        });

        expect(res.status).toBe(401);
    });

    test("create property then list returns it", async () => {
        const app = makeTestApp();
        const token = await registerAndGetToken(app);

        const create = await request(app)
            .post("/api/v1/properties")
            .set("Authorization", `Bearer ${token}`)
            .send({
                nickname: "Home",
                addressLine1: "123 Main St",
                city: "Princeton",
                province: "BC",
                postalCode: "V0X 1W0",
            });

        expect([200, 201]).toContain(create.status);
        expect(create.body.success).toBe(true);

        const list = await request(app)
            .get("/api/v1/properties")
            .set("Authorization", `Bearer ${token}`);

        expect(list.status).toBe(200);
        expect(list.body.success).toBe(true);

        const properties =
            list.body?.data?.properties ?? list.body?.data ?? list.body?.properties ?? [];

        expect(Array.isArray(properties)).toBe(true);
        expect(properties.length).toBeGreaterThanOrEqual(1);

        const nicknames = properties.map((p) => p.nickname);
        expect(nicknames).toContain("Home");
    });
});