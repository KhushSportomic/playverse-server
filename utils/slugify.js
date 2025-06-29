function slugifyEvent(venue, location, date, slotTime) {
  // Helper to turn a string into a URL-friendly slug
  function slugify(str) {
    return str
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove special chars except space/hyphen
      .replace(/\s+/g, "-"); // Replace spaces with hyphens
  }
  return `${slugify(venue)}-${slugify(location)}-${slugify(date)}-${slugify(
    slotTime
  )}`;
}

module.exports = slugifyEvent;
