const router = require("express").Router();

const authCtrl = require("../controllers/authController");

// Guard: fail loudly but safely if exports are missing
function mustBeFn(fn, name) {
    if (typeof fn !== "function") {
        throw new Error(
            `authController.${name} is not a function. Check exports in src/controllers/authController.js`
        );
    }
    return fn;
}

// Support either naming convention in controller:
// - login / register
// - loginUser / registerUser
const login =
    authCtrl.login ||
    authCtrl.loginUser;

const register =
    authCtrl.register ||
    authCtrl.registerUser;

router.post("/login", mustBeFn(login, login ? (login.name || "login") : "login"));
router.post("/register", mustBeFn(register, register ? (register.name || "register") : "register"));

module.exports = router;

