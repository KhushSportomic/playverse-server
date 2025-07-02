const Event = require("../models/Event");
const slugifyEvent = require("../utils/slugify");
const Excel = require("exceljs");
const XLSX = require("xlsx");
const fs = require("fs");
const axios = require("axios");
const mongoose = require("mongoose");
const crypto = require("crypto");
const {
  createPayuPaymentRequest,
  processPayuWebhook,
  verifyPayuPayment,
} = require("../utils/payu");
const { getTodayEventsReport } = require("../corn/eventCorn");
const { sendWhatsAppMsg91 } = require("../utils/msg91");
// Removed: const Sentry = require("@sentry/node");

//Download Event Excel
exports.downloadEventExcel = async (req, res) => {
  try {
    const events = await Event.find();

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet("Events");

    worksheet.addRow([
      "Event ID",
      "Event Name",
      "Sport",
      "Venue Name",
      "Skill Level",
      "Date",
      "Time",
      "Event Price",
      "Actual Price",
      "Payment Id",
      "Order Id",
      "Participant Name",
      "Participant Phone",
      "Participant Id",
      "Quantity",
      "Total Amount",
    ]);

    for (const event of events) {
      for (const participant of event.participants) {
        if (participant.paymentStatus === "success") {
          worksheet.addRow([
            event._id,
            event.name,
            event.sportsName,
            event.venueName,
            participant.skillLevel,
            event.date,
            event.slot,
            event.price,
            event.actualPrice,
            participant.paymentId,
            participant.orderId,
            participant.name,
            participant.phone,
            participant.id,
            participant.quantity,
            participant.amount,
          ]);
        }
      }
    }

    const fileName = `events_${new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\..+/, "")}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error in downloadEventExcel:", error);
    res.status(500).json({ error: "Failed to generate Excel file" });
  }
};

//Event Functions

//Get All Events
exports.getAllEvents = async (req, res) => {
  try {
    const { sport, page, limit } = req.query;
    let filter = {};

    if (sport && sport.toLowerCase() !== "all") {
      filter.sportsName = sport.toLowerCase();
    }

    // Get total count for pagination metadata
    const totalEvents = await Event.countDocuments(filter);

    // Create base query
    let eventsQuery = Event.find(filter);

    // Apply pagination only if both page and limit are provided
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
        return res.status(400).json({
          error:
            "Invalid pagination parameters. Page and limit must be positive numbers",
        });
      }

      const skip = (pageNum - 1) * limitNum;
      eventsQuery = eventsQuery.skip(skip).limit(limitNum);
    }

    // Execute query
    const events = await eventsQuery;
    const allSports = await Event.distinct("sportsName");

    const eventsWithSlots = events.map((event) => {
      const successfulParticipants = event.participants.filter(
        (p) => p.paymentStatus === "success"
      );
      const totalBookedSlots = successfulParticipants.reduce(
        (sum, p) => sum + p.quantity,
        0
      );
      const slotsLeft = event.participantsLimit - totalBookedSlots;
      const filledPercent =
        event.participantsLimit > 0
          ? totalBookedSlots / event.participantsLimit
          : 0;
      const eventWithSlots = {
        ...event._doc,
        slotsLeft,
        filledPercent,
      };
      return eventWithSlots;
    });

    // Sort events by filledPercent (descending: most filled first)
    eventsWithSlots.sort((a, b) => b.filledPercent - a.filledPercent);

    // Construct response with pagination metadata
    const response = {
      total: totalEvents,
      sport: sport || "all",
      availableSports: allSports,
      events: eventsWithSlots,
    };

    // Add pagination metadata if pagination was requested
    if (page && limit) {
      const totalPages = Math.ceil(totalEvents / parseInt(limit));
      response.pagination = {
        currentPage: parseInt(page),
        totalPages,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getAllEvents:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

//Get Event By ID
exports.getEventById = async (req, res) => {
  const { id } = req.params;
  try {
    let event;
    // Check if the ID is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      event = await Event.findById(id);
    } else {
      // If not a valid ObjectId, assume it's a slug
      event = await Event.findOne({ slug: id });
    }

    if (!event) return res.status(404).json({ error: "Event not found" });

    // Find the venue for this event (case-insensitive, trimmed match)
    const Venue = require("../models/Venue");
    const venue = await Venue.findOne({
      name: { $regex: `^${event.venueName.trim()}$`, $options: "i" },
      location: { $regex: `^${event.location.trim()}$`, $options: "i" },
      sport: { $regex: `^${event.sportsName.trim()}$`, $options: "i" },
    });

    const successfulParticipants = event.participants.filter(
      (p) => p.paymentStatus === "success"
    );
    const totalBookedSlots = successfulParticipants.reduce(
      (sum, p) => sum + p.quantity,
      0
    );
    const slotsLeft = event.participantsLimit - totalBookedSlots;

    const eventWithSlots = {
      ...event._doc,
      slotsLeft,
      totalBookedSlots,
      mapUrl: venue ? venue.mapUrl : "",
    };

    res.status(200).json(eventWithSlots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
};

//get successful payments
exports.getSuccessfulPayments = async (req, res) => {
  const { id } = req.params;

  try {
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const successfulPayments = event.participants.filter(
      (participant) => participant.paymentStatus === "success"
    );

    const totalBookedSlots = successfulPayments.reduce(
      (acc, curr) => acc + curr.quantity,
      0
    );
    const slotsLeft = event.participantsLimit - totalBookedSlots;

    res.status(200).json({
      eventName: event.name,
      slotsLeft,
      totalBookedSlots,
      totalSuccessfulPayments: successfulPayments.length,
      successfulPayments: successfulPayments.map((p) => ({
        name: p.name,
        phone: p.phone,
        skillLevel: p.skillLevel,
        quantity: p.quantity,
        amount: p.amount,
        paymentId: p.paymentId,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch successful payments" });
  }
};

//Create New Event
exports.createEvent = async (req, res) => {
  try {
    const {
      name,
      description,
      date,
      slot,
      participantsLimit,
      price,
      actualPrice,
      sportsName,
      venueName,
      location,
      venueImage,
    } = req.body;

    // Generate slug
    const eventSlug = slugifyEvent(venueName, location, date, slot);

    const newEvent = new Event({
      name,
      description,
      date,
      slot,
      participantsLimit,
      price,
      actualPrice,
      sportsName,
      venueName,
      location,
      venueImage,
      slug: eventSlug,
    });
    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (error) {
    res.status(500).json({ error: "Failed to create event" });
  }
};

// Update Event
exports.updateEvent = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    if (!id) return res.status(400).json({ error: "Event ID is required" });
    const event = await Event.findByIdAndUpdate(id, updates, { new: true });
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.status(200).json({ message: "Event updated successfully", event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update event" });
  }
};

//Delete Event by ID
exports.deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id) return res.status(400).json({ error: "Event ID is required" });
    const event = await Event.findByIdAndDelete(id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.status(200).json({ message: "Event deleted successfully", event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete event" });
  }
};

exports.getTodaysEventsByVenue = async (req, res) => {
  try {
    //get today's start and end date
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    //aggregate events by venue for today
    const eventsByVenue = await Event.aggregate([
      {
        $match: {
          date: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: "$venueName",
          totalEvents: { $sum: 1 },
          events: {
            $push: {
              _id: "$_id",
              name: "$name",
              time: "$slot",
              sport: "$sportsName",
              currentParticipants: "$currentParticipants",
              participantsLimit: "$participantsLimit",
            },
          },
        },
      },
      {
        $project: {
          venue: "$_id",
          totalEvents: 1,
          events: 1,
          _id: 0,
        },
      },
    ]);

    res.status(200).json({
      date: today.toISOString().split("T")[0],
      venues: eventsByVenue,
    });
  } catch (error) {
    console.error("Error in getTodaysEventsByVenue:", error);
    res.status(500).json({ error: "Failed to fetch today's events" });
  }
};

exports.getEventReports = async (req, res) => {
  try {
    const report = await getTodayEventsReport();
    if (!report) {
      return res.status(500).json({ error: "Failed to generate report" });
    }

    /*
      getTodayEventsReport function returns an object with the following structure:
     
      date: today.toISOString().split("T")[0],
      totalVenuesChecked: VENUE_NAMES.length,
      venuesWithNoEvents,
      venuesWithEvents: eventsByVenue.map((venue) => ({
        venueName: venue._id,
        totalEvents: venue.totalEvents,
      
    
    */

    res.status(200).json({
      date: report.date,
      totalVenuesChecked: report.totalVenuesChecked,
      venuesWithNoEvents: report.venuesWithNoEvents,
      venuesWithEvents: report.venuesWithEvents,
    });
  } catch (error) {
    console.error("Error in getEventReports:", error);
    res.status(500).json({ error: "Failed to fetch event reports" });
  }
};

//Payment Related Functions
//payU paymnet logic
exports.initiateBooking = async (req, res) => {
  const { id } = req.params;
  // const { name, phone, skillLevel, quantity = 1, email } = req.body; // removed
  const { name, phone, skillLevel, quantity = 1, email, clientUrl } = req.body; // added

  try {
    if (!name || !phone || !skillLevel) {
      return res.status(400).json({
        error: "Name, phone number, and skill level are required",
      });
    }

    if (typeof quantity !== "number" || quantity < 1) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Phone number must be 10 digits" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const event = await Event.findById(id).session(session);

      console.log("Fetched event:", event); // Debug log
      if (!event) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Event not found" });
      }

      console.log("Fetched event:", event); // Debug log

      const successfulParticipants = event.participants.filter(
        (p) => p.paymentStatus === "success"
      );
      const totalBookedSlots = successfulParticipants.reduce(
        (acc, curr) => acc + curr.quantity,
        0
      );
      const availableSlots = event.participantsLimit - totalBookedSlots;

      if (availableSlots < quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          error: `Only ${availableSlots} slots available`,
        });
      }

      const totalAmount = event.price * quantity;
      const eventId = event?._id.toString();
      console.log("Event ID:", eventId); // Debug log
      const eventDetails = {
        eventId: eventId || "",
        name: event.name || "Unknown Event",
        date: event.date || new Date(),
        venueName: event.venueName || "Unknown Venue",
        slot: event.slot || "Unknown Slot",
      };

      console.log("Constructed eventDetails:", eventDetails); // Debug log

      const userDetails = {
        name: name ? name.trim() : "Unknown",
        phone: phone ? phone.trim() : "0000000000",
        skillLevel: skillLevel ? skillLevel.trim() : "",
        quantity,
        email: email ? email.trim() : `${phone}@example.com`, // Ensure email is valid
      };

      const backendUrl = `${req.protocol}://${req.get("host")}`;
      const payuRequest = await createPayuPaymentRequest(
        totalAmount,
        eventDetails,
        userDetails,
        backendUrl
      );
      console.log("PayU request sent:", payuRequest.paymentData); // Debug log

      const participant = {
        name,
        phone,
        skillLevel,
        paymentStatus: "pending",
        orderId: payuRequest.txnId,
        bookingDate: new Date(),
        amount: totalAmount,
        quantity,
        clientUrl,
      };

      event.participants.push(participant);
      await event.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Flatten response
      res.status(200).json({
        message: "Booking initiated",
        payuUrl: payuRequest.payuUrl,
        key: payuRequest.paymentData.key,
        txnid: payuRequest.txnId,
        amount: payuRequest.paymentData.amount,
        productinfo: payuRequest.paymentData.productinfo,
        firstname: payuRequest.paymentData.firstname,
        email: payuRequest.paymentData.email,
        phone: payuRequest.paymentData.phone,
        surl: payuRequest.paymentData.surl,
        furl: payuRequest.paymentData.furl,
        hash: payuRequest.paymentData.hash,
        udf1: payuRequest.paymentData.udf1,
        udf2: payuRequest.paymentData.udf2,
        udf3: payuRequest.paymentData.udf3,
        eventName: event.name,
        eventDate: event.date,
        venue: event.venueName,
        customerName: name,
        customerPhone: phone,
        skillLevel,
        quantity,
        totalAmount,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error(`Booking Initiation Error for event ${id}:`, error.message);
    res.status(500).json({
      error: "Failed to initiate booking",
      details: error.message,
    });
  }
};

// Replaced Razorpay webhook handler with PayU webhook handler
exports.handlePayuWebhook = async (req, res) => {
  try {
    console.log("PayU Webhook received:", JSON.stringify(req.body, null, 2));

    let paymentData;
    try {
      paymentData = processPayuWebhook(req.body);
    } catch (error) {
      console.error("Error processing PayU webhook:", error.message);
      return res.status(400).json({ error: "Invalid webhook data" });
    }

    const { txnId, paymentId, status, amount } = paymentData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const event = await Event.findOne({
        "participants.orderId": txnId,
      }).session(session);

      if (!event) {
        console.error(`Event not found for txnId: ${txnId}`);
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ error: "Event not found" });
      }

      // Modified: Look for participant with any status except success
      const participantIndex = event.participants.findIndex(
        (p) => p.orderId === txnId && p.paymentStatus !== "success"
      );

      if (participantIndex === -1) {
        console.log(
          `Participant already processed or not found for txnId: ${txnId}`
        );
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ status: "ok" });
      }

      const participant = event.participants[participantIndex];

      if (status === "success") {
        const successfulParticipants = event.participants.filter(
          (p) => p.paymentStatus === "success"
        );
        const totalBookedSlots = successfulParticipants.reduce(
          (acc, curr) => acc + curr.quantity,
          0
        );
        const availableSlots = event.participantsLimit - totalBookedSlots;

        if (availableSlots < participant.quantity) {
          console.error(`Insufficient slots for txnId: ${txnId}`);
          await Event.updateOne(
            { _id: event._id, "participants.orderId": txnId },
            { $set: { "participants.$.paymentStatus": "failed" } },
            { session }
          );
          await session.commitTransaction();
          session.endSession();
          return res.status(200).json({
            status: "ok",
            note: "Payment processed but booking failed due to insufficient slots",
          });
        }

        await Event.updateOne(
          { _id: event._id, "participants.orderId": txnId },
          {
            $set: {
              "participants.$.paymentStatus": "success",
              "participants.$.paymentId": paymentId,
              "participants.$.bookingDate": new Date(),
              "participants.$.amount": amount,
            },
            $inc: { currentParticipants: participant.quantity },
          },
          { session }
        );

        // // --- MSG91 WhatsApp Notification Logic ---
        // // Re-fetch event to get updated participants
        // const updatedEvent = await Event.findById(event._id).session(session);
        // const successfulParticipantsUpdated = updatedEvent.participants.filter(
        //   (p) => p.paymentStatus === "success"
        // );
        // const totalBookedSlotsUpdated = successfulParticipantsUpdated.reduce(
        //   (acc, curr) => acc + curr.quantity,
        //   0
        // );
        // const occupancy = (totalBookedSlotsUpdated / updatedEvent.participantsLimit) * 100;
        // let shouldSave = false;
        // // 75% notification
        // console.log("outside 75% condition");
        // if (occupancy >= 75 && !updatedEvent.notified75) {
        //   console.log("inside 75% condition");
        //   try {
        //     await sendWhatsAppMsg91(
        //       '919408824242',
        //       updatedEvent.name, // Name (for {{1}})
        //       `75% slots booked for event ID: ${updatedEvent._id}` // Order number/info (for {{2}})
        //     );
        //     updatedEvent.notified75 = true;
        //     shouldSave = true;
        //   } catch (err) {
        //     console.error('Failed to send 75% MSG91 WhatsApp notification:', err.message);
        //   }
        // }
        // // 100% notification
        // if (occupancy >= 100 && !updatedEvent.notified100) {
        //   try {
        //     await sendWhatsAppMsg91(
        //       '919408824242',
        //       updatedEvent.name, // Name (for {{1}})
        //       `100% slots booked for event ID: ${updatedEvent._id}` // Order number/info (for {{2}})
        //     );
        //     updatedEvent.notified100 = true;
        //     shouldSave = true;
        //   } catch (err) {
        //     console.error('Failed to send 100% MSG91 WhatsApp notification:', err.message);
        //   }
        // }
        // if (shouldSave) await updatedEvent.save({ session });
        // // --- End MSG91 WhatsApp Notification Logic ---
      } else {
        await Event.updateOne(
          { _id: event._id, "participants.orderId": txnId },
          {
            $set: {
              "participants.$.paymentStatus":
                status === "pending" ? "pending" : "failed",
              "participants.$.paymentId": paymentId,
            },
          },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      console.log(`Payment ${status} processed for txnId: ${txnId}`);
      return res.status(200).json({ status: "ok" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error(
      `Webhook processing error for txnId: ${req.body.txnid || "unknown"}`,
      error.message
    );
    res.status(500).json({ error: "Failed to process webhook" });
  }
};

//PayU success and failure handlers
exports.handlePayuSuccess = async (req, res) => {
  const payuResponse = req.body;
  console.log("PayU success response received:", payuResponse);
  const { txnid, status, udf3 } = payuResponse;
  const eventId = udf3;

  if (!txnid || !status) {
    return res.status(400).json({ error: "Invalid response from PayU" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const event = await Event.findOne({ "participants.orderId": txnid });
    let clientUrl = process.env.CLIENT_BASE_URL;

    if (event) {
      const participant = event.participants.find((p) => p.orderId === txnid);

      if (participant && participant.paymentStatus !== "success") {
        participant.paymentStatus = "success";
        participant.paymentId = payuResponse.mihpayid;
        await event.save({ session });

        // Send confirmation email/SMS if needed here

        // --- MSG91 WhatsApp Notification Logic ---
        // Re-fetch event to get updated participants
        const updatedEvent = await Event.findById(event._id).session(session);
        const successfulParticipantsUpdated = updatedEvent.participants.filter(
          (p) => p.paymentStatus === "success"
        );
        const totalBookedSlotsUpdated = successfulParticipantsUpdated.reduce(
          (acc, curr) => acc + curr.quantity,
          0
        );
        const occupancy =
          (totalBookedSlotsUpdated / updatedEvent.participantsLimit) * 100;
        let shouldSave = false;

        // 75% notification
        if (occupancy >= 75 && !updatedEvent.notified75) {
          console.log("inside 75% condition");
          try {
            const successfulParticipants = updatedEvent.participants.filter(
              (p) => p.paymentStatus === "success"
            );
            const allNames = successfulParticipants
              .map((p) => p.name || "N/A")
              .join(", ");
            const allNumbers = successfulParticipants
              .map((p) => p.phone || "N/A")
              .join(", ");
            await sendWhatsAppMsg91(
              "919408824242",
              formatDate(updatedEvent.date),
              updatedEvent.slot || "",
              updatedEvent.venueName || "",
              "75%",
              allNames, // body_5: all names
              `https://playverse-client-nine.vercel.app/event/${
                updatedEvent._id || ""
              }`,
              allNumbers // body_7: all numbers
            );
            updatedEvent.notified75 = true;
            shouldSave = true;
          } catch (err) {
            console.error(
              "Failed to send 75% MSG91 WhatsApp notification:",
              err.message
            );
          }
        }

        // 100% notification
        if (occupancy >= 100 && !updatedEvent.notified100) {
          console.log("inside 100% condition");
          try {
            const successfulParticipants = updatedEvent.participants.filter(
              (p) => p.paymentStatus === "success"
            );
            const allNames = successfulParticipants
              .map((p) => p.name || "N/A")
              .join(", ");
            const allNumbers = successfulParticipants
              .map((p) => p.phone || "N/A")
              .join(", ");
            await sendWhatsAppMsg91(
              "919408824242",
              formatDate(updatedEvent.date),
              updatedEvent.slot || "",
              updatedEvent.venueName || "",
              "100%",
              allNames, // body_5: all names
              `https://playverse-client-nine.vercel.app/event/${
                updatedEvent._id || ""
              }`,
              allNumbers // body_7: all numbers
            );
            updatedEvent.notified100 = true;
            shouldSave = true;
          } catch (err) {
            console.error(
              "Failed to send 100% MSG91 WhatsApp notification:",
              err.message
            );
          }
        }

        if (shouldSave) await updatedEvent.save({ session });

        // --- End MSG91 WhatsApp Notification Logic ---
      }

      await session.commitTransaction();
      session.endSession();

      const redirectUrl = participant?.clientUrl || process.env.CLIENT_BASE_URL;
      return res.redirect(
        `${redirectUrl}/event/${event._id}?payment=success&txnid=${txnid}`
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Fallback redirect if event not found
    const eventForFallback = await Event.findOne({
      "participants.orderId": txnid,
    });
    const participantForFallback = eventForFallback?.participants.find(
      (p) => p.orderId === txnid
    );
    const redirectUrl =
      participantForFallback?.clientUrl || process.env.CLIENT_BASE_URL;
    res.redirect(
      `${redirectUrl}/event/${eventForFallback?._id}?payment=success&txnid=${txnid}`
    );
  } catch (error) {
    console.error("Error processing PayU success response:", error);
    await session.abortTransaction();
    session.endSession();
    // Redirect to a failure page on the frontend
    const eventForFallback = await Event.findOne({
      "participants.orderId": payuResponse.txnid,
    });
    const participantForFallback = eventForFallback?.participants.find(
      (p) => p.orderId === payuResponse.txnid
    );
    const redirectUrl =
      participantForFallback?.clientUrl || process.env.CLIENT_BASE_URL;
    res.redirect(
      `${redirectUrl}/event/${eventForFallback?._id}?payment=failure&reason=server_error`
    );
  }
};

exports.handlePayuFailure = async (req, res) => {
  const payuResponse = req.body;
  console.log("PayU failure response received:", payuResponse);
  const { txnid, status, udf3 } = payuResponse;
  const eventId = udf3;

  if (!txnid || !status) {
    return res.status(400).json({ error: "Invalid response from PayU" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const event = await Event.findOne({ "participants.orderId": txnid });
    let clientUrl = process.env.CLIENT_BASE_URL;

    if (event) {
      const participant = event.participants.find((p) => p.orderId === txnid);
      if (participant) {
        clientUrl = participant.clientUrl || clientUrl;
        if (participant.paymentStatus !== "success") {
          participant.paymentStatus = "failed";
          await event.save({ session });
        }
      }
    }
    await session.commitTransaction();
    session.endSession();
    res.redirect(
      `${clientUrl}/event/${eventId}?payment=failure&reason=${
        payuResponse.error_Message || "payment_failed"
      }`
    );
  } catch (error) {
    console.error("Error processing PayU failure response:", error);
    await session.abortTransaction();
    session.endSession();
    res.redirect(
      `${process.env.CLIENT_BASE_URL}/event/${eventId}?payment=failure&reason=server_error`
    );
  }
};

//bulk upload events
exports.uploadEventsFromExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please upload an Excel file" });
  }

  try {
    const filePath = req.file.path;
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ message: "Uploaded file not found" });
    }

    console.log("Processing Excel file:", filePath);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log("Raw Excel data:", data);
    console.log("Number of events to process:", data.length);

    const excelSerialToJSDate = (serial) => {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const utcDate = new Date(excelEpoch.getTime() + serial * 86400000);
      if (serial >= 60) {
        utcDate.setTime(utcDate.getTime() + 86400000);
      }
      const year = utcDate.getUTCFullYear();
      const month = utcDate.getUTCMonth();
      const day = utcDate.getUTCDate();
      return new Date(Date.UTC(year, month, day));
    };

    const events = data.map((event) => {
      if (
        !event.name ||
        !event.description ||
        !event.date ||
        !event.slot ||
        !event.participantsLimit ||
        !event.price ||
        !event.venueName ||
        !event.location ||
        !event.sportsName
      ) {
        throw new Error("Each event must have all required fields");
      }

      const processedEvent = {
        name: event.name,
        description: event.description,
        date: excelSerialToJSDate(event.date),
        slot: event.slot,
        participantsLimit: Number(event.participantsLimit),
        currentParticipants: 0, // Add this field for new events
        price: Number(event.price),
        venueName: event.venueName,
        venueImage: event.venueImage || "",
        location: event.location,
        sportsName: event.sportsName,
        participants: [], // Add empty participants array
      };

      console.log("Processed event:", processedEvent);
      return processedEvent;
    });

    console.log("Saving events to database...");
    const savedEvents = await Event.insertMany(events);
    console.log("Successfully saved", savedEvents.length, "events to database");

    fs.unlinkSync(filePath);
    console.log("Temporary file deleted");

    res.status(201).json({
      message: "Events Uploaded Successfully",
      count: savedEvents.length,
      events: savedEvents,
    });
  } catch (error) {
    console.error("Error in uploadEventsFromExcel:", error);
    res.status(500).json({
      message: "Failed to upload events",
      error: error.message,
    });
  }
};

//msg91 functions

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_API_URL = process.env.MSG91_API_URL;
const INTEGRATED_NUMBER = process.env.INTEGRATED_NUMBER;

// Send confirmation and cancellation messages
// to participants via WhatsApp using MSG91 API
exports.sendConfirmation = async (req, res) => {
  const { id } = req.params;

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const participants = event.participants
      .filter((p) => p.paymentStatus === "success")
      .map((p) => ({
        phone: `91${p.phone}`,
        name: p.name || "Player",
      }))
      .filter((p) => p.phone && /^\d{12}$/.test(p.phone));

    if (participants.length === 0) {
      return res.status(400).json({
        error: "No valid participants with successful payments found",
      });
    }

    const formattedDate = new Date(event.date)
      .toLocaleDateString("en-GB")
      .replace(/\//g, "-");

    const payload = {
      integrated_number: INTEGRATED_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "playverse_game_confirmation_24_feb_template",
          language: { code: "en", policy: "deterministic" },
          namespace: "6e8aa1f2_7d4c_4f4b_865c_882d0f4043be",
          to_and_components: participants.map((participant) => ({
            to: [participant.phone],
            components: {
              header_1: {
                type: "image",
                value:
                  event.venueImage || "https://files.msg91.com/432091/vcaifgxt",
              },
              body_1: { type: "text", value: participant.name },
              body_2: { type: "text", value: event.name },
              body_3: { type: "text", value: event.venueName },
              body_4: { type: "text", value: event.sportsName },
              body_5: { type: "text", value: formattedDate },
              body_6: { type: "text", value: event.slot },
              body_7: { type: "text", value: event.location },
              button_1: {
                subtype: "url",
                type: "text",
                value: "https://sportomic.com/confirm?event=" + event._id,
              },
            },
          })),
        },
      },
    };

    const response = await axios.post(MSG91_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        authkey: MSG91_AUTH_KEY,
      },
    });

    event.confirmationCount += 1;
    await event.save();

    res.status(200).json({
      message: "Confirmation messages sent",
      confirmationCount: event.confirmationCount,
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error sending confirmation:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to send confirmation messages" });
  }
};

exports.sendCancellation = async (req, res) => {
  const { id } = req.params;

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const participants = event.participants
      .filter((p) => p.paymentStatus === "success")
      .map((p) => ({
        phone: `91${p.phone}`,
        name: p.name || "Player",
      }))
      .filter((p) => p.phone && /^\d{12}$/.test(p.phone));

    if (participants.length === 0) {
      return res.status(400).json({
        error: "No valid participants with successful payments found",
      });
    }

    const formattedDate = new Date(event.date)
      .toLocaleDateString("en-GB")
      .replace(/\//g, "-");

    const payload = {
      integrated_number: INTEGRATED_NUMBER,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "playverse_cancellation_msg_24_feb",
          language: { code: "en", policy: "deterministic" },
          namespace: "6e8aa1f2_7d4c_4f4b_865c_882d0f4043be",
          to_and_components: participants.map((participant) => ({
            to: [participant.phone],
            components: {
              header_1: {
                type: "image",
                value:
                  event.venueImage || "https://files.msg91.com/432091/vcaifgxt",
              },
              body_1: { type: "text", value: participant.name },
              body_2: { type: "text", value: event.name },
              body_3: { type: "text", value: event.venueName },
              body_4: { type: "text", value: event.sportsName },
              body_5: { type: "text", value: formattedDate },
              body_6: { type: "text", value: event.slot },
            },
          })),
        },
      },
    };

    const response = await axios.post(MSG91_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        authkey: MSG91_AUTH_KEY,
      },
    });

    event.cancellationCount += 1;
    await event.save();

    res.status(200).json({
      message: "Cancellation messages sent",
      cancellationCount: event.cancellationCount,
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error sending cancellation:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Failed to send cancellation messages" });
  }
};

// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Get Event By Venue Name, Location, Date, and Slot Time (SEO-friendly URL)
exports.getEventByVenueLocationDateSlot = async (req, res) => {
  try {
    const { venueName, location, date, slotTime } = req.params;

    // Convert slug back to a case-insensitive regex for searching
    const venueNameRegex = new RegExp(`^${venueName.replace(/-/g, " ")}$`, "i");
    const locationRegex = new RegExp(`^${location.replace(/-/g, " ")}$`, "i");

    // Revert the slot slug to its original format
    const originalSlotTime = slotTime
      .replace(/-/g, " ")
      .replace(/_/g, " - ")
      .replace(/\./g, ":");

    // Find the event using these fields
    const event = await Event.findOne({
      venueName: { $regex: venueNameRegex },
      location: { $regex: locationRegex },
      date: new Date(date), // Ensure date is in correct format
      slot: originalSlotTime,
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);
  } catch (error) {
    console.error("Error in getEventByVenueLocationDateSlot:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
};

// Get events with successful payments (for Refund section)
exports.getEventsWithPayments = async (req, res) => {
  try {
    const events = await Event.find();
    const filteredEvents = events
      .map((event) => {
        const paidParticipants = event.participants.filter(
          (p) => p.paymentStatus === "success"
        );
        if (paidParticipants.length > 0) {
          return {
            eventId: event._id,
            eventName: event.name,
            participants: paidParticipants.map((p) => ({
              id: p.id,
              name: p.name,
              paymentId: p.paymentId,
              amount: p.amount,
            })),
          };
        }
        return null;
      })
      .filter((e) => e !== null);
    res.status(200).json(filteredEvents);
  } catch (error) {
    console.error("Error in getEventsWithPayments:", error);
    res.status(500).json({ error: "Failed to fetch events with payments" });
  }
};

// Refund Payment via PayU
// exports.refundPayment = async (req, res) => {
//   console.log("refundPayment called");
//   try {
//     const { id, participantId } = req.params;
//     const event = await Event.findById(id);
//     if (!event) return res.status(404).json({ error: "Event not found" });

//     const participant = event.participants.find((p) => p.id === participantId);
//     if (!participant)
//       return res.status(404).json({ error: "Participant not found" });
//     if (!participant.paymentId)
//       return res
//         .status(400)
//         .json({ error: "No paymentId for this participant" });

//     const key = process.env.PAYU_MERCHANT_KEY;
//     const salt = process.env.PAYU_MERCHANT_SALT;
//     const mihpayid = participant.paymentId;
//     const amount = participant.amount;
//     const command = "cancel_refund_transaction";
//     const var1 = mihpayid;
//     const var2 = "2.00";
//     const hashString = `${key}|${command}|${var1}|${salt}`;
//     const hash = require("crypto")
//       .createHash("sha512")
//       .update(hashString)
//       .digest("hex");
//     console.log(" value of hash", hash);
//     console.log("Hash string:", JSON.stringify(hashString));
//     console.log("value of salt", salt);

//     // const params = new URLSearhParams();
//     // params.append("key", key);
//     // params.append("command", command);
//     // params.append("var1", var1);
//     // params.append("var2", var2);
//     // params.append("hash", hash);

//     const params = require("qs").stringify({
//       key,
//       command,
//       var1,
//       var2,
//       hash,
//     });
//     console.log(" value of params", params);

//     const payuUrl = "https://info.payu.in/merchant/postservice.php?form=2";
//     const axios = require("axios");
//     console.log("payload before making request", params.toString());

//     const payuRes = await axios.post(payuUrl, params.toString(), {
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//         "Accept": "application/json",
//       },
//     });

//     console.log("PayU refund response:", payuRes.data);

//     res.status(200).json({ refundResult: payuRes.data });
//   } catch (error) {
//     console.error(
//       "Error in refundPayment:",
//       error?.response?.data || error.message
//     );
//     res.status(500).json({
//       error: "Refund failed",
//       details: error?.response?.data || error.message,
//     });
//   }
// };


const qs = require("qs");
const { v4: uuidv4 } = require("uuid"); // npm install uuid
// Refund Payment via PayU
exports.refundPayment = async (req, res) => {
  console.log("refundPayment called");

  try {
    const { id, participantId } = req.params;
    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const participant = event.participants.find((p) => p.id === participantId);
    if (!participant)
      return res.status(404).json({ error: "Participant not found" });
    if (!participant.paymentId)
      return res.status(400).json({ error: "No paymentId for this participant" });

    const key = process.env.PAYU_MERCHANT_KEY;
    const salt = process.env.PAYU_MERCHANT_SALT;
    const mihpayid = participant.paymentId;
    const amount = parseFloat(participant.amount).toFixed(2); // refund amount
    const command = "cancel_refund_transaction";
    const var1 = mihpayid;

    // generate unique token for var2 (max 23 characters)
    const token = require("uuid").v4().replace(/-/g, "").slice(0, 23);
    const var2 = token;
    const var3 = amount;

    // Correct hash string format: key|command|var1|salt
    const hashString = `${key}|${command}|${var1}|${salt}`;
    const hash = require("crypto").createHash("sha512").update(hashString).digest("hex");

    // Logs for debugging
    console.log("value of key", key);
    console.log("value of command", command);
    console.log("value of var1 (mihpayid)", var1);
    console.log("value of var2 (token)", var2);
    console.log("value of var3 (amount)", var3);
    console.log("Hash string:", JSON.stringify(hashString));
    console.log("Generated hash:", hash);
    console.log("value of salt", salt);

    const params = require("qs").stringify({
      key,
      command,
      var1,
      var2,
      var3,
      hash,
    });

    console.log("value of params", params);

    const payuUrl = "https://test.payu.in/merchant/postservice.php?form=2";
    const axios = require("axios");

    console.log("Payload before making request", params.toString());

    const payuRes = await axios.post(payuUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    });

    console.log("PayU refund response:", payuRes.data);

    res.status(200).json({ refundResult: payuRes.data });

  } catch (error) {
    console.error("Error in refundPayment:", error?.response?.data || error.message);
    res.status(500).json({
      error: "Refund failed",
      details: error?.response?.data || error.message,
    });
  }
};
