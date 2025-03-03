const express = require("express");
const router = express.Router();
const Message = require("../models/message");

router.get("/", async (req, res, next) => {
  res.render("main");
});

/* Get all messages. */
router.get("/api/messages", async (req, res, next) => {
  Message.find()
    .populate("user")
    .exec(function (err, results) {
      if (err) {
        return next(err);
      }

      res.status(201).send(results);
    });
});

module.exports = router;
