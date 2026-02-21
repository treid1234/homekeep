const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");

const reminderController = require("../controllers/reminderController");

function mustBeFn(name) {
    if (typeof reminderController[name] !== "function") {
        throw new Error(
            `reminderController.${name} is not a function. Check exports in src/controllers/reminderController.js`
        );
    }
    return reminderController[name];
}

// List all reminders (reminderEnabled + nextDueDate)
router.get("/reminders", requireAuth, mustBeFn("listReminders"));

// Upcoming reminders within windowDays (default 30)
router.get("/reminders/upcoming", requireAuth, mustBeFn("getUpcomingReminders"));

// Snooze reminder by N days (default 7)
router.post("/reminders/:logId/snooze", requireAuth, mustBeFn("snoozeReminder"));

// Complete reminder (disable reminders + clear nextDueDate)
router.post("/reminders/:logId/complete", requireAuth, mustBeFn("completeReminder"));

module.exports = router;

