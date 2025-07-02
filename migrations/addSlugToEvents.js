const mongoose = require("mongoose");
const Event = require("../models/Event");
const slugifyEvent = require("../utils/slugify");
const connectDB = require("../config/db");
require("dotenv").config({ path: "./config/.env" }); // a bit of a guess

const addSlugsToEvents = async () => {
  await connectDB();

  try {
    const events = await Event.find({ slug: { $exists: false } });
    console.log(`Found ${events.length} events without slugs.`);

    for (const event of events) {
      try {
        const slug = slugifyEvent(
          event.venueName,
          event.location,
          event.date.toISOString(), // slugify expects a string
          event.slot
        );

        // To handle potential duplicate slugs, append a short unique id
        const potentialCollision = await Event.findOne({ slug: slug });
        if (potentialCollision) {
          event.slug = `${slug}-${event._id.toString().slice(-5)}`;
        } else {
          event.slug = slug;
        }

        await event.save();
        console.log(`Updated event ${event._id} with slug: ${event.slug}`);
      } catch (saveError) {
        console.error(`Could not update event ${event._id}:`, saveError);
      }
    }

    console.log("Finished adding slugs to events.");
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    mongoose.disconnect();
    console.log("MongoDB disconnected.");
  }
};

addSlugsToEvents();
