const express = require("express");
const {
    createVenue,
    getAllVenues,
    getVenueById,
    updateVenue,
    deleteVenue,
} = require("../controllers/venueController.js");
const verifyAdmin = require("../middleware/verifyAdmin.js");

const router = express.Router();

// Public routes
router.get("/", getAllVenues);
router.get("/:id", getVenueById);

// Admin routes
router.post("/", verifyAdmin, createVenue);
router.put("/:id", verifyAdmin, updateVenue);
router.delete("/:id", verifyAdmin, deleteVenue);

module.exports = router;