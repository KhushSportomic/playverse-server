const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../config/db');
const Venue = require('../models/Venue');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const deleteAllVenues = async () => {
    try {
        await connectDB();
        console.log('MongoDB Connected...');

        console.log('Attempting to delete all documents from the venues collection...');
        const result = await Venue.deleteMany({});
        console.log(`Successfully deleted ${result.deletedCount} venues.`);

    } catch (error) {
        console.error('An error occurred while deleting venues:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB Disconnected.');
    }
};

deleteAllVenues(); 