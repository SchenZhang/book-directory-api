const dotenv = require("dotenv");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const expressasync = require("express-async-handler");
const session = require("express-session");
const MongoStore = require("connect-mongo");

dotenv.config();

// mongoose
//   .connect(
//     ""
//   )
//   .then(() => {
//     console.log("DB connected");
//   })
//   .catch((error) => {
//     console.log("Error is ${error.message}");
//   });
const dbconnect = async () => {
  try {
    await mongoose.connect(process.env.mongourl);
    console.log("DB connected");
  } catch (error) {
    console.log(`DB failed ${error.message}`);
  }
};
dbconnect();

//configure session
app.use(
  session({
    secret: process.env.sessionkey,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
      mongoUrl:
        "mongodb+srv://Sichen:lVRwvi7Teg6TTsLx@bookdirectory-api.dkv89sm.mongodb.net/bookdirectory-api?retryWrites=true&w=majority",
      ttl: 1 * 60 * 60, //1hour expiration
    }),
  })
);

//user model
const userschema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    books: [
      {
        type: Object,
      },
    ],
  },
  {
    timestamps: true,
  }
);
const User = mongoose.model("User", userschema);
//book schema
const bookschema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    isbn: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      required: true,
    },
    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
const Book = mongoose.model("Book", bookschema);

app.use(express.json());
//------
//user
//register
app.post(
  "/api/users/register",
  expressasync(async (req, res) => {
    //check if already registered
    const founduser = await User.findOne({ email: req.body.email });
    if (founduser) {
      throw new Error("User already registered");
    }
    //console.log(req.body);
    //hash userpassword
    const salt = await bcrypt.genSalt(10);
    const hashedpassword = await bcrypt.hash(req.body.password, salt);

    try {
      const user = await User.create({
        fullname: req.body.fullname,
        email: req.body.email,
        password: hashedpassword,
      });
      res.json({
        message: "user registered",
        user,
      });
    } catch (error) {
      res.json(error);
    }
  })
);

//login
app.post(
  "/api/users/login",
  expressasync(async (req, res) => {
    try {
      //check if exist
      const userfound = await User.findOne({ email: req.body.email });
      if (!userfound) {
        return res.status(404).json({
          message: "User does not exist",
        });
      }
      const ismatched = await bcrypt.compare(
        req.body.password,
        userfound.password
      );
      if (!ismatched) {
        return res.status(400).json({
          msg: "Password Invalid",
        });
      }
      //put the user into session
      req.session.authUser = userfound;
      res.json({
        message: "Login successfully",
      });
    } catch (error) {
      res.json(error);
    }
  })
);

//logout
app.get("/api/users/logout", (req, res) => {
  req.session.destroy(() => {
    res.json("logged out!");
  });
});

//fecth all users
app.get("/api/users", async (req, res) => {
  console.log(req.session);
  try {
    const allusers = await User.find();
    res.json({
      allusers,
    });
  } catch (error) {
    res.json(error);
  }
});

//fecth a user
app.get("/api/users/:id", async (req, res) => {
  //console.log(req.params);
  try {
    const singleuser = await User.findById(req.params.id);
    res.json({
      singleuser,
    });
  } catch (error) {
    res.json(error);
  }
});

//user profile
app.get("/api/users/profile/:id", async (req, res) => {
  //req.session.user = "fang";
  //check if logined
  if (!req.session.authUser) {
    return res.json("Access denied");
  }
  console.log(req.session);
  try {
    const singleuser = await User.findById(req.params.id);
    res.json({
      singleuser,
    });
  } catch (error) {
    res.json(error);
  }
});

//update user
app.put("/api/users/update/:id", async (req, res) => {
  try {
    res.json({
      msg: "update a user endpoint",
    });
  } catch (error) {
    res.json(error);
  }
});

//books
//books
//create a book
app.post(
  "/api/books",
  expressasync(async (req, res) => {
    //check if exist
    if (!req.session.authUser) {
      throw new Error("Not logged in");
    }

    const bookfound = await Book.findOne({ title: req.body.title });
    if (bookfound) {
      throw new Error(`This book ${req.body.title} already existed`); //fan dan yin hao
    }
    //check if logged in

    try {
      const book = await Book.create({
        title: req.body.title,
        author: req.body.author,
        isbn: req.body.isbn,
        desc: req.body.desc,
        createdby: req.session.authUser._id,
      });
      const theuser = await User.findById(req.session.authUser._id);
      //push theuser into the field of logged in user
      theuser.books.push(book);
      await theuser.save();
      res.json(book);
    } catch (error) {
      res.json(error);
    }
  })
);

//fetch all books
app.get(
  "/api/books",
  expressasync(async (req, res) => {
    try {
      const booksall = await Book.find().populate("createdby");
      res.json(booksall);
    } catch (error) {
      res.json(error);
    }
  })
);

//fecth a book
app.get(
  "/api/books/:id",
  expressasync(async (req, res) => {
    try {
      const abook = await Book.findById(req.params.id);
      res.json(abook);
    } catch (error) {
      res.json(error);
    }
  })
);

//delete
app.delete(
  "/api/books/delete/:id",
  expressasync(async (req, res) => {
    try {
      await Book.findByIdAndDelete(req.params.id);
      res.json("deleted a book successfully");
    } catch (error) {
      res.json(error);
    }
  })
);

//update a book
app.put(
  "/api/books/update/:id",
  expressasync(async (req, res) => {
    try {
      const bookupdated = await Book.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );
      res.json(bookupdated);
    } catch (error) {
      res.json(error);
    }
  })
);
//not found
const notfound = (req, res, next) => {
  const error = new Error("Not found endpoint");
  res.status(404);
  next(error);
};

//error handler middleware
const errorhandler = (err, req, res, next) => {
  res.json({
    message: err.message,
    stack: err.stack,
  });
};

app.use(notfound);
app.use(errorhandler);

app.listen(7000, () => {
  console.log("Server is up");
});
