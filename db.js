const spicedPg = require("spiced-pg");
const db = spicedPg(
    process.env.DATABASE_URL ||
        `postgres:postgres:postgres@localhost:5432/petitiondb`
);
//spicedPg("whoAreWeTalkingTo:whichDBUserWillRunMyCommands:theUserPasswordForOurDbUser@PostgrePort/nameOfDatabase")

// The object that is returned from the call above has a single method, query, that you can use to query your database.
// inserts are composed of INSERT INTO tableName (columnWeWantToAddValueInto, columnWeWantToAddValueInto)

// signatures table:
module.exports.addSignature = (signature, userId) => {
    const q = `INSERT INTO signatures (signature, user_id)
    VALUES ($1, $2) RETURNING id`;
    const params = [signature, userId];
    console.log("input is: ", params);
    console.log("Signature added");
    return db.query(q, params);
};

module.exports.getSignatoriesNumber = () => {
    return db.query("SELECT COUNT (id) FROM  signatures");
};

module.exports.getSignaturePic = (signatureId) => {
    return db.query("SELECT signature FROM signatures WHERE id = ($1)", [
        signatureId,
    ]);
};

// users table:
module.exports.addCredentials = (first, last, email, hashedPassword) => {
    const q = `INSERT INTO users (first, last, email, password)
    VALUES ($1, $2, $3, $4) RETURNING id`;
    const params = [first, last, email, hashedPassword];
    return db.query(q, params);
};

// module.exports.getSignatories = () => {
// return db.query("SELECT first, last FROM users");
// };

module.exports.getSignatories = () => {
    return db.query(
        "SELECT users.first, users.last, user_profiles.age, user_profiles.city, user_profiles.url FROM users LEFT JOIN user_profiles ON users.id = user_profiles.user_id INNER JOIN signatures on users.id = signatures.user_id"
    );
};

module.exports.getSignatoriesByCity = (city) => {
    return db.query(
        "SELECT users.first, users.last, user_profiles.age, user_profiles.city, user_profiles.url FROM users LEFT JOIN user_profiles ON users.id = user_profiles.user_id INNER JOIN signatures on users.id = signatures.user_id",
        [city]
    );
};

module.exports.checkForUserEmail = (email) => {
    return db.query("SELECT password FROM users WHERE id = ($1)", [email]);
};

module.exports.checkForUserSignature = (userId) => {
    return db.query("SELECT signature FROM signatures WHERE user_id = ($1)", [
        userId,
    ]);
};

//user_profiles table:
module.exports.addProfile = (age, city, homepage, userId) => {
    const q = `INSERT INTO user_profiles (age, city, url, user_id)
    VALUES ($1, $2, $3, $4)`;
    const params = [age, city, homepage, userId];
    console.log("Profile added");
    return db.query(q, params);
};
