const appleLogin = require('./appleStrategy');
const passportLogin = require('./localStrategy');
const googleLogin = require('./googleStrategy');
const githubLogin = require('./githubStrategy');
const discordLogin = require('./discordStrategy');
const facebookLogin = require('./facebookStrategy');
const yandexLogin = require('./yandexStrategy');
const setupOpenId = require('./openidStrategy');
const jwtLogin = require('./jwtStrategy');
const ldapLogin = require('./ldapStrategy');

module.exports = {
  appleLogin,
  passportLogin,
  googleLogin,
  githubLogin,
  discordLogin,
  jwtLogin,
  facebookLogin,
  yandexLogin,
  setupOpenId,
  ldapLogin,
};