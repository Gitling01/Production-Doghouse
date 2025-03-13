
const https = require('https');
const fs = require('fs');
const dotEnv = require('dotenv').config(); //need for photo uploading stuff as well

//uncomment to use locally (also add path names)
// const certPathName = "";
// const keyPathName = "";
// // const options = {
// //     key: fs.readFileSync(keyPathName), //path to 'localhost-key.pem'
// //     cert: fs.readFileSync(certPathName) //path to 'localhost.pem'
// // };

//const connection = require('./db.js');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();

//Debugging SESSION_SECRET issue
console.log('Environment variables check:', {
    hasSessionSecret: !!process.env.SESSION_SECRET,
    sessionSecretLength: process.env.SESSION_SECRET?.length
  });

  console.log('Session secret check:', {
    firstChar: process.env.SESSION_SECRET?.charAt(0),
    lastChar: process.env.SESSION_SECRET?.charAt(process.env.SESSION_SECRET.length - 1),
    containsSpaces: process.env.SESSION_SECRET?.includes(' ')
});

app.use(express.json());
// app.use(cors({
//    origin: 'https://www.doghousecommunity.com',
//    credentials: true,
//    methods: ['*'],
//    allowedHeaders: ['*']
// }));

//Debugging: for SESSION_SECRET, checking cors
app.use(cors({
    origin: 'https://www.doghousecommunity.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
 }));

app.set('trust proxy', 1); //will deploy 

// Debugging SESSION_SECRET issue: Also add this before session middleware to see the full request
app.use((req, res, next) => {
    console.log('Incoming request:', {
        url: req.url,
        method: req.method,
        headers: {
            origin: req.headers.origin,
            cookie: !!req.headers.cookie
        }
    });
    next();
});

app.use(session({
    secret: 'hardcoded-secret-for-testing',
    resave: false,
    saveUninitialized: false,
    //Debugging SESSION_SECRET: comment out cookie for now, add back in one at a time
    // cookie:{
    //     secure: true, //set true in production (or when using https)
    //     maxAge: 1000 * 60 * 60, //1 hour
    //     httpOnly: true, //avoids xss (ok for https too)
    //     sameSite: 'lax' //mdn docs says if this is none, then secure must be true
    // }
}));

//Debugging: SESSION_SECRET
console.log('Module check:', {
    sessionModule: require.cache[require.resolve('express-session')] ? 'loaded once' : 'not found',
    expressModule: require.cache[require.resolve('express')] ? 'loaded once' : 'not found'
});


app.use(express.static(path.join(__dirname)));

app.get("/", function (req, res) {
  res.status(200).send("Health check passed");
});

// Handle requests for index.html
app.get('/index.html', function (req, res) {
    var options = {
        root: path.join(__dirname),
    };

    res.sendFile('index.html', options);
});

const port = process.env.PORT || 8081;

//CONNECT TO DB: local database *Uncomment to use local database*
// let db;
// connection().then(connection => {
//     db = connection;
// }).catch(err => {
//     console.error('Failed to connect to the database.',err);
// });

//CONNECT TO DB: Database in production *Uncomment to use production database*
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const db = pool;

pool.query('SELECT 1')
  .then(() => console.log('Database connection established'))
  .catch(err => console.error('Database connection failed:', err));

// //my alternate strategy configuration for Facebook login (add or find in my db)
// passport.use(new FacebookStrategy({
//     clientID: process.env['FACEBOOK_APP_ID'],
//     clientSecret: process.env['FACEBOOK_APP_SECRET'],
//     callbackURL: 'https://localhost:3000/oauth2/redirect/facebook'
//   },
//    function(accessToken, refreshToken, profile, cb) { 
//     db.execute('SELECT * FROM doghousedb.federated_credentials WHERE provider = ? AND profile_id = ?', [
//       'https://www.facebook.com',
//       profile.id //part of the profile object passed to the callback function during authentication
//     ], function(err, cred) { 
//       if (err) { return cb(err); } 
//       if (!cred || cred.length === 0) {
//         // The Facebook account has not logged in to this app before.  Create a
//         // new user record and link it to the Facebook account.
//         db.execute('INSERT INTO doghousedb.users (username) VALUES (?)', [
//           profile.displayName //when the username is inserted, it will automatically get a auto incremented user_id
//         ], function(err, results) {
//           if (err) { return cb(err); }
//       //LEFT OFF DEBUGGING RIGHT HERE 12/24/24 -- start by investigating result.insertId
//           const id = results.insertId; //sql2 version: part of the object returned when you execute the query

          
//           db.execute('INSERT INTO federated_credentials (user_id, provider, profile_id) VALUES (?, ?, ?)', [
//             id, //sql2's metadata from the "result" object that's created after insertion
//             'https://www.facebook.com',
//             profile.id //from profile object given after authentication
//           ], function(err) {
//             if (err) { return cb(err); }
//             var user = {
//               id: id.toString(), //here federated credentials is assigned the incremented id the user was assigned in the user table
//               name: profile.displayName //from profile object given after authentication
//             };
//             return cb(null, user);
//           });
//         });
//       } else { //existing credentials WERE found (logged in to this site before)(this is what i will get now with user Natty)
//         // The Facebook account has previously logged in to the app.  Get the
//         // user record linked to the Facebook account and log the user in.
//         db.execute('SELECT * FROM doghousedb.users WHERE id = ?', [ cred.user_id ], function(err, user) {
//           if (err) { return cb(err); }
//           if (!user) { return cb(null, false); }
//           return cb(null, user);
//         });
//       }
//     });
//   }
// ));

//POST LISTING
app.post('/listings', async (req,res) => {
    if (!db || !db.query) {
        console.error("Database connection not available");
        return res.status(503).json({ error: 'Database service unavailable' });
    }
    console.log("Request body: ", req.body);
    try{
        const streetAddress = req.body.street_address;
        const city = req.body.city;
        const zipcode = req.body.zipcode;
        const price = req.body.price;
        const bedroomQuantity = req.body.bedroom_quantity;
        const bathroomQuantity = req.body.bathroom_quantity;
        const photoUrl = req.body.photo_url;
        const size = req.body.size;
        console.log("In post route: " + streetAddress + " " + city + " " + zipcode + " " + price + " " +
            + bedroomQuantity + " " + bathroomQuantity + " " + size + " " + photoUrl);
        const query = "INSERT INTO doghousedb.listing (street_address, city, zipcode, price, bedroom_quantity, bathroom_quantity, photo_url, size) VALUES (?,?,?,?,?,?,?,?)";
        await db.execute(query,[streetAddress, city, zipcode, price, bedroomQuantity, bathroomQuantity, photoUrl, size]);
        res.status(201).json({ message: "Listing created successfully!"});
    } catch(err){
        console.error("Error creating listing in post route", err);
        res.status(500).json({ error: err.message });
    }
});

//DELETE A LISTING (will add user_id info)
app.delete('/listings', async (req,res) => {
    if(!db){
        return res.status(500).json({ error: 'Database connection not made'});
    }
    const { listing_id } = req.query;
    try{
        const query = "DELETE FROM doghousedb.listing WHERE listing_id = ?"; 
        await db.execute(query, [listing_id]);
        //can also check if listing with that id exists (could use result.affectedRows > 0)
        res.status(200).json({ message: "Deletion successful" });
    }catch(error){
        console.error("Error trying to delete listing", error);
        res.status(500).json({ error: error.message });
    }
});

//WIP: Search by params (for the search bar and the rental type dropdown)
app.get('/listings', async (req, res) => {
    if(!db){
        return res.status(500).json({ error: 'Database connection not made.' });  
    }
    const { listing_id, rental_type, street_address, borough, city, zipcode } = req.query;
    
    let query = 'SELECT * FROM doghousedb.listing WHERE 1=1'; 
    const params = [];

    if (listing_id) {
        query += ' AND listing_id = ?';
        params.push(listing_id);
    }
    if (rental_type) {
        query += ' AND rental_type = ?';
        params.push(rental_type);
    }
    if (street_address) {
        query += ' AND street_address = ?';
        params.push(street_address);
    }
    if (borough) {
        query += ' AND borough = ?';
        params.push(borough);
    }
    if (city) {
        query += ' AND city = ?';
        params.push(city);
    }
    if (zipcode) {
        query += ' AND zipcode = ?';
        params.push(zipcode);
    }
   
    try {
        const [rows] = await db.execute(query, params);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No matching listings found.' });
        }
        res.json(rows);
    } catch (error) {
        console.log("error: ", error)
        res.status(500).json({ error: 'Database query failed' });
    }
});


//SESSIONS RELATED
const isAuthenticated = (req,res,next) => {
    console.log(`isAuthenticated: ${req.session.id}`);
    console.log(req.session);
    if(req.session.userId){ 
        console.log("User is logged in");
        return next(); //return
    } else {
        console.log("Unauthorized");
        res.status(401).json({message: "Not authorized to view this page - login"});
    }
};

//Protected Route for Add a Listing Link
app.get('/protected/add-listing', isAuthenticated, (req, res) => {
    console.log("isAuthenticated finished and I was called to send a file");
    res.status(200).json({message: "from /protected/add-listing: user passed isAuthenticated"});
});

//Get specific user-related data -- if the user is logged in (thus also has a session.userId)
app.get('/protected/users', isAuthenticated, async (req,res) => {
    if(!db){
        return res.status(500).json({ error: 'Database connection not made.' });  
    }
      const userId  = req.session.userId; 
      const userInfoQuery = "SELECT photo_url, username, user_id FROM doghousedb.user WHERE user_id = ?";
      const listingsQuery = "SELECT street_address, listing_id FROM doghousedb.listing WHERE user_id = ?"
    try{
       const [userInfoResults] = await db.execute(userInfoQuery, [userId]); 
       const [listingsResults] = await db.execute(listingsQuery, [userId]);
       console.log(userInfoResults);
       console.log(listingsResults);
       res.json({ userInfoResults: userInfoResults[0], listingsResults: listingsResults}); 
    } catch(err) {
         res.status(500).json({ error: err.message });
    }
});

//Get specific user-related favorite listings
app.get('/protected/favorites', isAuthenticated, async(req,res) => {
    if(!db){
        return res.status(500).json({ error: 'Database connection not made' });
    }
    const userId = req.session.userId;
    const query = "SELECT f.listing_id, street_address FROM doghousedb.favorite f JOIN doghousedb.listing l ON l.listing_id = f.listing_id WHERE f.user_id = ?";
    try{
        const [listings] = await db.execute(query, [userId]); 
        res.json(listings);
    } catch(error){
        console.error("Error getting favorites from database", error);
        res.status(500).json({ error: "Error getting favorites from database"});
    }
});

//add a listing to favorites
app.post('/protected/favorites', isAuthenticated, async (req, res) => {
    if (!db) {
        return res.status(500).json({ error: 'Database connection not made' });
    }
    const userId = req.session.userId; 
    const { listing_id } = req.body;
    if (!listing_id) {
        return res.status(400).json({ error: 'Listing ID is required' });
    }
    const query = `INSERT INTO doghousedb.favorite (user_id, listing_id) VALUES (?, ?)`;
    try {
        await db.execute(query, [userId, listing_id]);
        res.status(200).json({ message: 'Listing added to favorites' });
    } catch (error) {
        console.error("Error adding to favorites:", error);
        res.status(500).json({ error: "Error adding to favorites" });
    }
});


//LOGIN RELATED ROUTES
app.post('/users', async(req,res) => { //TODO: REVIEW
    if(!db){
        return res.status(500).json({ error: 'Database connection not made.' });  
      }
      console.log("Request body received: ", req.body);
    try{
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(req.body.password,salt);
        const username = req.body.username; 
        const email = req.body.email;
        const query = "INSERT INTO doghousedb.user (username, user_password, email) VALUES (?,?,?)";
        await db.execute(query,[username,hashedPassword,email]);     
        res.status(201).json({ message: "User added successfully!"});     
    } catch(error){
        console.error("Error adding user", error);
        res.status(500).send();
    }
});

app.post('/set-return-url', (req, res) => {
    const { returnTo } = req.body;
    req.session.returnTo = returnTo;  
    res.status(200).send();
});


//On login: returns a redirect url to the original intended page, 
//if there is one (in req.session.returnTo), otherwise it returns the home page url
app.post('/users/login', async (req,res) => {
    if(!db){
        return res.status(500).json({ error: 'Database connection not made.' });  
    }
    try{
        const request_username = req.body.username;
        const request_password = req.body.password;
        const query = "SELECT user_id, user_password FROM doghousedb.user WHERE username = ?";
        const [result] = await db.execute(query,[request_username]);
        if (result.length === 0) {
            return res.status(404).json({ message: "User not found!" });
        }
        const { user_id, user_password } = result[0];
        const match = await bcrypt.compare(request_password,user_password);
        if(match){
            //the user is logged in
            req.session.userId = user_id;
            console.log(`Logged in!: ${request_username}`);
            let redirectUrl = "/index.html";
            if(req.session.returnTo){
                redirectUrl = req.session.returnTo;
                delete req.session.returnTo;
            }
            return res.status(200).json({ redirectUrl });
        } else {
            //deny login
            console.log("Not logged in!");
            return res.status(500).json({ message: "Did not log in successfully!"});
        }
    }  catch(error){
        console.error("Error logging in", error);
        res.status(500).send();
    }
});

//logout
app.post('/logout',(req,res) => {
    req.session.destroy((err) => {
        if(err){
            console.log("logout error", err);
            res.status(500).json( {message: "error logging out"} );
        }
        res.clearCookie('connect.sid');
        res.status(200).json( {message: "logout successful"} );
    });
});

app.listen(port, () => {
   console.log(`App listening on port ${port}`)
})

//MORE HTTPS SETUP: uncomment out https.createServer code directly below to use locally
//AWS handles SSL termination, but retain createServer for local environments

// https.createServer(options, app).listen(port, () => {
//   console.log('HTTPS server running on https://localhost:3000');
// });

//********************************************************************************** 
