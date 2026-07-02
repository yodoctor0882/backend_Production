const db = require("../config/db");

exports.submitContactForm = async (req, res) => {
  try {
    const {
      concern,
      subConcern,
      name,
      number,
      email,
      text,
    } = req.body;

    // ✅ validation
    if (!concern || !subConcern || !name || !number) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    // ✅ insert into DB
    await db.query(
      `INSERT INTO contact_requests 
      (concern, sub_concern, name, mobile, email, message)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [concern, subConcern, name, number, email || null, text || null]
    );

    res.status(200).json({
      success: true,
      message: "Request submitted successfully",
    });

  } catch (error) {
    console.error("CONTACT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};