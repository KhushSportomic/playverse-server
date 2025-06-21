// instrument.js
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://71502a48c48034d1e3cfae30a8e459fd@o4509191553155072.ingest.us.sentry.io/4509191636975616", // Replace with your Sentry DSN

  // Performance Monitoring
  sendDefaultPii: true,
});
