const express = require("express");
const app = express();
const hb = require("express-handlebars");
const db = require("./db");
const cookieSession = require("cookie-session");
const { hash, compare } = require("./bc");
const csurf = require("csurf");
const frameguard = require("frameguard");

// Middleware:

app.use(
    cookieSession({
        secret: `Grzegorz Brzęczyszczykiewicz`,
        maxAge: 1000 * 60 * 60 * 24 * 14,
    })
);

app.use(express.static("./public"));
app.use(express.urlencoded({ extended: false }));

app.use(csurf());
app.use(function (req, res, next) {
    res.set("x-frame-options", "DENY");
    res.locals.csrfToken = req.csrfToken();
    frameguard({ action: "SAMEORIGIN" });
    next();
});

app.use((req, res, next) => {
    console.log("-----------------");
    console.log(`${req.method} request coming in on route ${req.url}`);
    console.log("-----------------");
    next();
});

// template rendering engine
app.engine("handlebars", hb());
app.set("view engine", "handlebars");

// Routes:

// GET "/"
app.get("/", (req, res) => {
    res.redirect("/register");
});

// GET /register
app.get("/register", (req, res) => {
    if (req.session.userId !== true) {
        console.log(`user is requesting GET / route from "/petition"`);
        res.render("registration", {
            title: "register",
        });
    } else res.redirect("/login");
});

// POST /register
app.post("/register", (req, res) => {
    const { first, last, email, password } = req.body;
    console.log("register body: ", req.body);
    hash(password)
        .then((hashedPassword) => {
            db.addCredentials(
                first,
                last,
                email,
                hashedPassword,
                req.session.userId
            )
                .then(({ rows }) => {
                    console.log("New user added to table users");
                    req.session.userId = rows[0].id;
                    req.session.registered = true;
                    res.redirect("/profile");
                })
                .catch((err) => {
                    console.log("error creating user profile", err);
                    res.render("registration", {
                        title: "register",
                        message:
                            "You made an error while creating your user profile, please fill required fields again and submit to register",
                    });
                });
        })
        .catch((err) => {
            console.log("error creating user profile", err);
            res.render("registration", {
                title: "register",
                message:
                    "You made an error while creating your user profile, please fill required fields again and submit to register",
            });
        });
});

// GET /profile
app.get("/profile", (req, res) => {
    if (typeof req.session.userId === "number") {
        console.log(`GET request on route "/profile"`);
        res.render("profile", {
            title: "profile",
        });
    } else {
        res.redirect("/register");
    }
});

//POST /profile
app.post("/profile", (req, res) => {
    console.log("POST request was made. User profile submitted.");
    const { age, city, homepage } = req.body;
    //check if homepage starts with : 'http://' or 'https://
    if (
        homepage.startsWith("http://") ||
        homepage.startsWith("https://") ||
        homepage === ""
    ) {
        db.addProfile(age, city.toLowerCase(), homepage, req.session.userId)
            .then(() => {
                console.log("User profile added do DB");
                res.redirect("/petition");
            })
            .catch((err) => {
                console.log("Profile write to DB failed", err);
                res.render("profile", {
                    title: "profile",
                    message: "Something went wrong, please try again.",
                });
            });
    } else {
        res.render("profile", {
            title: "profile",
            message: "Please fill the fields again",
        });
    }
});

//GET /login
app.get("/login", (req, res) => {
    console.log(`GET request on route "/login"`);
    res.render("login", {
        title: "login",
    });
});

//POST /login
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.checkForUserEmail(email)
        .then(({ rows }) => {
            compare(password, rows[0].password).then(({ result }) => {
                if (result) {
                    req.session.userId = rows[0].id;
                    req.session.loggedIn = true;
                    db.checkForUserSignature(rows[0].id)
                        .then(({ rows }) => {
                            if (rows.length > 0) {
                                req.session.signatureId = rows[0].id;
                                res.redirect("/thanks");
                            } else res.redirect("/petition");
                        })
                        .catch((err) => {
                            console.log("signature not in DB", err);
                            res.render("login", {
                                title: "login",
                                message:
                                    "You have entered incorrect login or password.",
                            });
                        });
                }
            });
        })
        .catch((err) => {
            console.log("passwords don't match", err);
            res.render("login", {
                title: "login",
                message: "You have entered incorrect login or password.",
            });
        });
});

//GET /logout
app.get("/logout", (req, res) => {
    console.log("User redirected to logout");
    res.render("logout", {
        title: "logout",
    });
});

//POST /logout
app.post("/logout", (req, res) => {
    console.log("User has logged out");
    req.session = null;
});

// GET /petition
app.get("/petition", (req, res) => {
    if (typeof req.session.userId === "number") {
        if (req.session.signatureId !== true) {
            console.log(`user is requesting GET / route from "/petition"`);
            res.render("petition", {
                title: "Welcome to my petition",
            });
        } else res.redirect("/thanks");
    } else res.redirect("/login");
});

// 2 POST /petition
app.post("/petition", (req, res) => {
    console.log("POST request was made - signature submitted");
    const { signature } = req.body;
    db.addSignature(signature, req.session.userId)
        .then(({ rows }) => {
            req.session.signatureId = rows[0].id;
            res.redirect("/thanks");
        })
        .catch((err) => {
            console.log("POST/petition error writing to DataBase: ", err);
        });
});

// 3 GET /thanks
app.get("/thanks", (req, res) => {
    if (typeof req.session.signatureId !== "number") {
        res.redirect("/petition");
    } else {
        return Promise.all([
            db.getSignaturePic(req.session.userId),
            db.getSignatoriesNumber(),
        ])
            .then((result) => {
                let signature = result[0].rows[0].signature;
                console.log("signature: ", signature);
                let count = result[1].rows[0].count;
                console.log("total: ", count);
                res.render("thanks", {
                    title: "Thank you for signing",
                    count,
                    signature,
                });
            })
            .catch((err) => {
                console.log("error reading data from DB : ", err);
            });
    }
});

// 4 GET /signers
app.get("/signers", (req, res) => {
    if (typeof req.session.signatureId !== "number") {
        res.redirect("/petition");
    } else
        db.getSignatories()
            .then(({ rows }) => {
                res.render("signers", {
                    title: "Petition signatories",
                    rows,
                });
            })
            .catch((err) => {
                console.log("error reading signatories form DB : ", err);
            });
});

app.listen(process.env.PORT || 8080, () =>
    console.log("Petition test server listening on port 8080")
);
