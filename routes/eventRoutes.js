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
  editEvent,
  deleteEvent,
  sendConfirmation,
  sendCancellation,
  //handleRazorpayWebhook,
  handlePayuWebhook,
  handlePayuSuccess,
  handlePayuFailure,
  getTodaysEventsByVenue,
  getEventReports,
} = require("../controllers/eventController");
const verifyAdmin = require("../middleware/verifyAdmin"); // Import the middleware
const upload = require("../middleware/uploadFile");

router.post("/upload", upload.single("file"), uploadEventsFromExcel);
router.get("/excel", downloadEventExcel);
router.post("/add-event", createEvent);
router.put("/:id", editEvent);
router.delete("/:id", deleteEvent);

router.get("/", getAllEvents);
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

module.exports = router;
