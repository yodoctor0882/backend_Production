const express = require("express");
const router = express.Router();

const { submitContactForm } = require("../controllers/enquiryController");

router.post("/", submitContactForm);

module.exports = router;