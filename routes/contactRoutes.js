const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactUsController");

// Submit contact form
router.post("/", contactController.createContact);

// Get all contacts
router.get("/", contactController.getAllContacts);

// Mark as read
router.patch("/:id/read", contactController.markAsRead);

// Delete contact
router.delete("/:id", contactController.deleteContact);

// Get unread count
router.get("/unread/count", contactController.getUnreadCount);

module.exports = router;
