const Venue = require("../models/Venue.js");

// Create a new venue
const createVenue = async (req, res) => {
    try {
        const { name, location, sport, imageUrl, description, generalInstructions, mapUrl, amenities } = req.body;
        if (!name || !location || !sport || !imageUrl) {
            return res.status(400).json({ success: false, message: "Name, location, sport, and image URL are required" });
        }
        const newVenue = new Venue({ 
            name, 
            location, 
            sport, 
            imageUrl, 
            description, 
            generalInstructions, 
            mapUrl, 
            amenities 
        });
        await newVenue.save();
        res.status(201).json({ success: true, data: newVenue, message: "Venue created successfully" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "A venue with this name, location, and sport already exists." });
        }
        console.error("Error creating venue:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Get all venues
const getAllVenues = async (req, res) => {
    try {
        const venues = await Venue.find();
        res.status(200).json({ success: true, data: venues });
    } catch (error) {
        console.error("Error fetching all venues:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Get a single venue by ID
const getVenueById = async (req, res) => {
    try {
        const venue = await Venue.findById(req.params.id);
        if (!venue) {
            return res.status(404).json({ success: false, message: "Venue not found" });
        }
        res.status(200).json({ success: true, data: venue });
    } catch (error) {
        console.error("Error fetching venue by ID:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Update a venue's details
const updateVenue = async (req, res) => {
    try {
        const venue = await Venue.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!venue) {
            return res.status(404).json({ success: false, message: "Venue not found" });
        }
        res.status(200).json({ success: true, data: venue, message: "Venue updated successfully" });
    } catch (error) {
        console.error("Error updating venue:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Delete a venue
const deleteVenue = async (req, res) => {
    try {
        const venue = await Venue.findByIdAndDelete(req.params.id);
        if (!venue) {
            return res.status(404).json({ success: false, message: "Venue not found" });
        }
        res.status(200).json({ success: true, message: "Venue deleted successfully" });
    } catch (error) {
        console.error("Error deleting venue:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

module.exports = {
    createVenue,
    getAllVenues,
    getVenueById,
    updateVenue,
    deleteVenue,
}; 