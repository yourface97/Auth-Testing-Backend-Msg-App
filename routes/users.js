const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Message = require("../models/message");
const createError = require("http-errors");
const { getAuth } = require("firebase-admin/auth");

//using firebase admin sdk to validate user token
router.use(function (req, res, next) {
  console.log("user - 1st middleware");
  const userIdToken = req.headers.useridtoken || req.body.useridtoken;
  const isAdmin = req.headers.isAdmin || req.body.isAdmin;
  console.log(userIdToken, isAdmin);

  try {
    getAuth()
      .verifyIdToken(userIdToken)
      .then((decodedToken) => {
        const uid = decodedToken.uid;

        //attach the uid from firebase admin sdk to the req
        req.firebaseuid = uid;
        req.firebaseIsAdmin = isAdmin;
        next();
      });
  } catch (error) {
    next(createError(403, error));
  }
});

//middleware to check if user is admin
router.use(function (req, res, next) {
  const uid = req.firebaseuid;
  const isAdmin = req.firebaseIsAdmin;

  User.findOne({ uid }).exec(function (err, result) {
    if (err) {
      return next(err);
    }
    //check if isAdmin is passed through client or user is already admin in db then attach admin value to request
    if ((result && result.isAdmin) || isAdmin) {
      req.firebaseIsAdmin = true;
    } else {
      req.firebaseIsAdmin = false;
    }

    next();
  });
});

// Update user's display name or create an entry for the user if not in db
router.patch("/:uid", async (req, res, next) => {
  console.log("updating user");
  const uid = req.firebaseuid;
  const { displayName, email } = req.body;
  const isAdmin = req.firebaseIsAdmin;

  if (!displayName) {
    return next(createError(400, "Display Name Cannot Be Empty"));
  }

  if (isAdmin === undefined) {
    isAdmin = false;
  }

  try {
    const updatedUser = await User.findOneAndUpdate(
      { uid },
      { displayName, email, isAdmin },
      { new: true, upsert: true }
    );

    res.status(201).send(); //this just sends status code of 201 to acknowledge success but no data
  } catch (error) {
    return next(createError(500, "Internal server error"));
  }
});

router.post("/api/message/add", (req, res, next) => {
  const { uid, _id, message, image } = req.body;
  const timestamp = new Date();
  console.log("api/essage/add");

  if (req.firebaseuid === uid) {
    User.findOne({ uid }).exec(function (err, result) {
      if (err) {
        return next(err);
      }
      console.log(result);

      const newMsg = new Message({
        uid,
        body: message,
        user: result._id,
        image,
        timestamp,
      });

      newMsg.save((err) => {
        if (err) {
          return next(err);
        }
      });

      res.status(201).send();
    });
  } else {
    return next(createError(403, "Access Forbidden - User Not Matched"));
  }
});

router.delete("/api/message/delete", (req, res, next) => {
  const { messageid, uid, method } = req.headers || {};

  if (req.firebaseuid === uid) {
    if (method === "all") {
      if (req.firebaseIsAdmin) {
        Message.deleteMany({ uid }).exec(function (err, result) {
          if (err) {
            return next(err);
          }
        });
      } else {
        return next(createError(403, "Access Forbidden - Admin Only"));
      }
    } else if (messageid) {
      Message.deleteOne({ _id: messageid }).exec(function (err, result) {
        if (err) {
          return next(err);
        }
      });
    }
  } else {
    return next(createError(403, "Access Forbidden - User Not Matched"));
  }

  res.status(201).send();
});

module.exports = router;
