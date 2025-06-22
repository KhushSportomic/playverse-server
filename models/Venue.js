const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    sport: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    generalInstructions: {
      type: String,
      default: "",
    },
    amenities: {
      type: [String],
      default: [],
    },
    mapUrl: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Ensure that the combination of venue name, location, and sport is unique
venueSchema.index({ name: 1, location: 1, sport: 1 }, { unique: true });

const Venue = mongoose.model("Venue", venueSchema);

module.exports = Venue; 