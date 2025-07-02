const Contact = require("../models/ContactUs");

exports.createContact = async (req, res) => {
  try {
    const { name, phone, subject, email, message } = req.body;

    // Validate phone number
    const phoneRegex = /^\d{10}$/; // Regex to match 10 digits
    if (!phoneRegex.test(phone)) {
      // If phone number doesn't match the regex, return an error response
      return res
        .status(400)
        .json({ message: "Phone number must be a 10-digit number" });
    }

    if (!name || !email || !message || !phone || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const contact = new Contact({
      name,
      email,
      phone,
      subject,
      message,
      isRead: false,
    });

    await contact.save();
    res.status(201).json({
      message: `Contact request submitted successfully`,
      contact,
    });
  } catch (error) {
    const errorMessage = error.message || "Server Error";
    console.error(errorMessage);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({
      createdAt: -1,
    });
    res.status(200).json({
      total: contacts.length,
      contacts,
    });
  } catch (error) {
    const errorMessage = error.message || "Server Error";
    console.error(errorMessage);
    res.status(500).json({ message: errorMessage });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    res.status(200).json({ message: "Contact marked as read", contact });
  } catch (error) {
    const errorMessage = error.message || "Server Error";
    console.error(errorMessage);
    res.status(500).json({ message: errorMessage });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findByIdAndDelete(id);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.status(200).json({ message: "Contact deleted successfully", contact });
  } catch (error) {
    const errorMessage = error.message || "Server Error";
    console.error(errorMessage);
    res.status(500).json({ message: errorMessage });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Contact.countDocuments({ isRead: false });
    res.status(200).json({ unreadCount });
  } catch (error) {
    const errorMessage = error.message || "Server Error";
    console.error(errorMessage);
    res.status(500).json({ message: errorMessage });
  }
};
