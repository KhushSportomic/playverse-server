const mongoose = require("mongoose");
const Event = require("../models/Event");
require("dotenv").config();

async function migrateData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const events = await Event.find({
      "participants.0": { $exists: true },
    });

    for (const event of events) {
      console.log(`Migrating event ${event._id}`);

      const updatedParticipants = event.participants.map((p) => {
        // Get values from existing participant
        const existingPaymentStatus = p.paymentStatus || "pending";
        const hasPaymentId = !!p.paymentId;

        // Determine payment status based on original value
        const paymentStatus = hasPaymentId ? "success" : existingPaymentStatus;

        return {
          name: p.name,
          phone: p.phone,
          skillLevel: p.skillLevel,
          paymentStatus: paymentStatus,
          paymentId: p.paymentId || undefined, // Keep existing or set undefined
          orderId: p.orderId || undefined,
          bookingDate: p.bookingDate || new Date(),
          quantity: 1, // Default to 1 slot
          amount: p.amount || event.price, // Use existing amount or calculate
        };
      });

      // Calculate current participants based on quantity
      const currentParticipants = updatedParticipants
        .filter((p) => p.paymentStatus === "success")
        .reduce((sum, p) => sum + p.quantity, 0);

      await Event.updateOne(
        { _id: event._id },
        {
          $set: {
            participants: updatedParticipants,
            currentParticipants: Math.min(
              currentParticipants,
              event.participantsLimit
            ),
          },
        }
      );
    }

    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateData();
