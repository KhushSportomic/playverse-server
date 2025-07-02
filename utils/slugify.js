const slugify = require("slugify");

function slugifyEvent(venue, location, date, slotTime) {
  // Helper to turn a string into a URL-friendly slug
  const slugifyOptions = {
    replacement: "-", // replace spaces with replacement character, defaults to `-`
    remove: /[^\w\s-]/g, // remove characters that match regex, defaults to `undefined`
    lower: true, // convert to lower case, defaults to `false`
    strict: false, // strip special characters except replacement, defaults to `false`
    trim: true, // trim leading and trailing replacement chars, defaults to `true`
  };

  const venueSlug = slugify(venue, slugifyOptions);
  const locationSlug = slugify(location, slugifyOptions);
  const dateSlug = slugify(
    new Date(date).toISOString().split("T")[0],
    slugifyOptions
  );
  const slotSlug = slugify(slotTime, slugifyOptions);

  return `${venueSlug}-${locationSlug}-${dateSlug}-${slotSlug}`;
}

module.exports = slugifyEvent;
