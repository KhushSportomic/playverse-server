const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Drop the unnecessary 'eventId_1' index if it exists
    try {
      const collection = conn.connection.db.collection("events");
      const result = await collection.dropIndex("eventId_1");
      console.log("Index 'eventId_1' dropped successfully:", result);
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log("Index 'eventId_1' not found, skipping drop.");
      } else {
        console.error("Error dropping index:", error.message);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
