const express = require("express");
const router = express.Router();
const {
  getAllEvents,
  getEventById,
  getSuccessfulPayments,
  createEvent,
  initiateBooking,
  // confirmPayment,
  downloadEventExcel,
  uploadEventsFromExcel,
  updateEvent,
  deleteEvent,
  sendConfirmation,
  sendCancellation,
  //handleRazorpayWebhook,
  handlePayuWebhook,
  handlePayuSuccess,
  handlePayuFailure,
  getTodaysEventsByVenue,
  getEventReports,
  getEventByVenueLocationDateSlot,
  getEventsWithPayments,
  refundPayment,
} = require("../controllers/eventController");
const verifyAdmin = require("../middleware/verifyAdmin"); // Import the middleware
const upload = require("../middleware/uploadFile");

router.post("/upload", upload.single("file"), uploadEventsFromExcel);
router.get("/excel", downloadEventExcel);
router.post("/add-event", createEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

router.get("/", getAllEvents);

// SEO-friendly event route (must be above "/:id" to avoid conflicts)
router.get(
  "/:venueName/:location/:date/:slotTime",
  getEventByVenueLocationDateSlot
);

router.get("/:id", getEventById);
router.get("/:id/successful-payments", getSuccessfulPayments);

// Razorpay routes
// router.post("/webhook/razorpay", handleRazorpayWebhook);
// router.post("/:id/book", initiateBooking);
// router.post("/:id/confirm", confirmPayment);

// PayU routes
router.post("/:id/book", initiateBooking);
router.post("/webhook/payu", handlePayuWebhook);
router.post("/payu/success", handlePayuSuccess);
router.post("/payu/failure", handlePayuFailure);

router.post("/:id/send-confirmation", sendConfirmation);
router.post("/:id/send-cancellation", sendCancellation);

//today's event Routes
router.get("/today/by-venue", getTodaysEventsByVenue);

//event daily report
router.get("/today/report", getEventReports);

// Refund section: Get events with successful payments
router.get("/refunds/events-with-payments", verifyAdmin, getEventsWithPayments);

// Refund route (admin only)
router.post("/:id/refund/:participantId", verifyAdmin, refundPayment);

module.exports = router;
