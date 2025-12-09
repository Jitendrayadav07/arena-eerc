const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");
require("dotenv").config();
const db = require("./config/db.config");

const GOOGLE_CLIENT_USER_ID = process.env.GOOGLE_CLIENT_USER_ID;
const GOOGLE_CLIENT_USER_SECRET = process.env.GOOGLE_CLIENT_USER_SECRET;

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_USER_ID,
      clientSecret: GOOGLE_CLIENT_USER_SECRET,
      callbackURL: `${process.env.REDIRECT_URL}/v1/auth/google/callback`,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const google_id = profile.id;

        let user = await db.tbl_user_google_login.findOne({ where: { google_id } });

        if (!user) {
          user = await db.tbl_user_google_login.create({
            google_id,
            name: profile.displayName,
            email: profile.emails[0].value,
            profile_pic: profile.photos[0].value,
          });
        }

        return done(null, user);  // Return DB user
      } catch (err) {
        return done(err, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.tbl_user_google_login.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
