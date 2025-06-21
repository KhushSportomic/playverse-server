const cron = require("node-cron");
const Event = require("../models/Event");

// Static list of venue names
const VENUE_NAMES = [
  //basketball,Volleyball
  "Adani Riverfront",
  "KN Sports Arena",

  //football
  "Tiki Taka Football",

  //table tennis
  "Top Spin",

  //badminton
  "Shuttle Empire",
  "Kelika",
  "Akshar Badminton",
  "Spinters Club",
  "Gujarat University Badminton",
  "Phoenix Academy",

  //pickleball
  "Tiki Taka Pickleball",
  "Pickleplay",
  "Go Dash Pickleball",
  "Serve Up",
  "AP Pickleball",
  "Vinayak Sports Arena",

  //tennis
  "Adani Riverfront Sportspark",
  "Guj Uni Tennis Centre",
];

const getTodayEventsReport = async () => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get events for today
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
        },
      },
    ]);

    // Create a map of venue events for easier lookup
    const venueEventMap = eventsByVenue.reduce((map, venue) => {
      map[venue._id] = venue.totalEvents;
      return map;
    }, {});

    // Check all static venues and report those with zero events
    const venuesWithNoEvents = VENUE_NAMES.filter(
      (venueName) => !venueEventMap[venueName] || venueEventMap[venueName] === 0
    );

    return {
      date: today.toISOString().split("T")[0],
      totalVenuesChecked: VENUE_NAMES.length,
      venuesWithNoEvents,
      venuesWithEvents: eventsByVenue.map((venue) => ({
        venueName: venue._id,
        totalEvents: venue.totalEvents,
      })),
    };
  } catch (error) {
    console.error("Error generating today's events report:", error);
    return null;
  }
};

//exposing getTodayEventsReport function as Api endpoint to share data to admin

// Schedule cron job to run at midnight every day
const scheduleEventsReport = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("Running today's events report...");
    const report = await getTodayEventsReport();
    if (report) {
      console.log("Today's events report:", JSON.stringify(report, null, 2));
      // You can use this report to identify venues needing events

      //send report to whatsapp using msg91
      //   sendWhatsAppMessage(report);
    }
  });
};

// Function to send WhatsApp message using msg91
// const sendWhatsAppMessage = async (report) => {
//   try {
//     const message = `Today's Events Report:\n\nDate: ${report.date}\nTotal Venues Checked: ${report.totalVenuesChecked}\nVenues with No Events: ${report.venuesWithNoEvents.join(", ")}\n\nVenues with Events:\n${report.venuesWithEvents
//       .map((venue) => `${venue.venueName}: ${venue.totalEvents} events`)
//       .join("\n")}`;

//     // Replace with your WhatsApp number and msg91 API details
//     const phoneNumber = "YOUR_PHONE_NUMBER";
//     const apiKey = "YOUR_MSG91_API_KEY";
//     const url = `https://api.msg91.com/api/v5/whatsapp/send?phone=${phoneNumber}&message=${encodeURIComponent(
//       message
//     )}&authkey=${apiKey}`;

//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//     });

//     if (response.ok) {
//       console.log("WhatsApp message sent successfully!");
//     } else {
//       console.error("Failed to send WhatsApp message:", response.statusText);
//     }
//   } catch (error) {
//     console.error("Error sending WhatsApp message:", error);
//   }
// };

// (async () => {
//   const report = await getTodayEventsReport();
//   if (report) {
//     console.log("Today's events report:", JSON.stringify(report, null, 2));
//     // You can use this report to identify venues needing events
//   }
// })();

module.exports = {
  scheduleEventsReport,
  getTodayEventsReport,
};
