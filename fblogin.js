//This file is not yet configured. Code here for storage.

//*PLACE* these two lines after const bcrypt = require('bcrypt'); and before const app = express();
var passport = require('passport');
var FacebookStrategy = require('passport-facebook');
//------------

//*PLACE* these 2 lines and passport.serializeUser and then passport.deserialiseUser after app.use(session...etc) 
//and before app.use(express.static...etc)
app.use(passport.initialize());
app.use(passport.session());

// user.id is saved in the session and is later used to retrieve the whole object via deserializeUser
// stored as req.session.passport.user = {id: 'whatever-the-id-is'}
//serializeUser gets called after login (in passport's code they call this somewhere 
//with the argument for user and then the done callback is a nested callback function that
//gets executed after the serialization takes place)
passport.serializeUser((user, done) => { 
    console.log('User to serialize:', user);
    done(null, user.user_id); //done is a callback function managed internally by passport
});

// id is the key used to deserialize the user from the session
//done is a callback function provided by Passport
passport.deserializeUser((id, done) => {
    db.execute('SELECT * FROM DoghouseDB.user WHERE user_id = ?', [id], (err, rows) => {
        if (err) { return done(err); }
        if (!rows.length) { return done(null, false); }
        done(null, rows[0]); // Attach the user object to `req.user`
    });
});
//------------

//*PLACE* after connection to database
// Helper to find existing federated credentials
async function findFederatedCredentials(db, provider, profileId) {
    const [credentials] = await db.execute(
        'SELECT * FROM DoghouseDB.federated_credentials WHERE provider = ? AND profile_id = ?',
        [provider, profileId]
        
    );
    
    return credentials[0]; // Return the first result if it exists
}

// Helper to create a new user
async function createUser(db, username) {
    const [result] = await db.execute(
        'INSERT INTO DoghouseDB.user (username) VALUES (?)',
        [username]
    );
    return result.insertId; // Return the new user's ID
}

// Helper to link federated credentials
async function linkFederatedCredentials(db, userId, provider, profileId) {
    await db.execute(
        'INSERT INTO DoghouseDB.federated_credentials (user_id, provider, profile_id) VALUES (?, ?, ?)',
        [userId, provider, profileId]
    );
}

// Refactored Facebook Strategy
passport.use(
    new FacebookStrategy(
        {
            clientID: process.env['FACEBOOK_APP_ID'],
            clientSecret: process.env['FACEBOOK_APP_SECRET'],
            callbackURL: 'https://localhost:3000/oauth2/redirect/facebook',
            profileFields: ['id','displayName']
        },
        async function (accessToken, refreshToken, profile, done) {
            try {
                const provider = 'https://www.facebook.com';
                const profileId = profile.id;
                console.log('Facebook Profile:', profile);
                // Step 1: Check for existing federated credentials
                const credentials = await findFederatedCredentials(db, provider, profileId);

                let user;

                if (!credentials) {
                    // Step 2: Create a new user if no credentials exist
                    const userId = await createUser(db, profile.displayName);

                    // Step 3: Link the new user to federated credentials
                    await linkFederatedCredentials(db, userId, provider, profileId);

                    user = { id: userId.toString(), name: profile.displayName };
                } else {
                    // Step 4: Fetch the existing user if credentials exist
                    const [users] = await db.execute(
                        'SELECT * FROM DoghouseDB.user WHERE user_id = ?',
                        [credentials.user_id]
                    );

                    if (!users.length) {
                        return done(null, false); // No user found
                    }

                    user = users[0]; // Existing user
                }

                // Step 5: Pass the user object to Passport
                console.log('User object after login:', user);
                return done(null, user);
            } catch (error) {
                console.error('Error in Facebook strategy:', error);
                return done(error);
            }
        }
    )
);

//Passport Facebook authentication
app.get('/login/facebook', passport.authenticate('facebook'));

//Passport Facebook redirect handling
app.get('/oauth2/redirect/facebook',
    passport.authenticate('facebook', { failureRedirect: '/login', failureMessage: true }),
    function(req, res) {
        if(session.returnTo){
            res.redirect(session.returnTo);
        }
        res.redirect('/'); 
    });
//--------