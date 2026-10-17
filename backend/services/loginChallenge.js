const crypto = require('crypto');

const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CHALLENGE_TTL_MS = 15 * 60 * 1000;
const LOGIN_CODE_RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_LOGIN_CODE_ATTEMPTS = 5;
const LOGIN_CODE_SELECT = '+loginCodeHash +loginCodeExpires +loginCodeAttempts +loginChallengeHash +loginChallengeExpires +loginCodeSentAt';

function hashLoginValue(value, userId) {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return crypto
    .createHash('sha256')
    .update(`${value}:${userId}:${secret}`)
    .digest('hex');
}

function secretsMatch(storedHash, candidateValue, userId) {
  if (!storedHash || candidateValue === undefined || candidateValue === null || candidateValue === '') {
    return false;
  }

  const candidateHash = hashLoginValue(candidateValue, userId);
  const stored = Buffer.from(String(storedHash), 'hex');
  const candidate = Buffer.from(candidateHash, 'hex');
  if (stored.length === 0 || stored.length !== candidate.length) {
    return false;
  }

  return crypto.timingSafeEqual(stored, candidate);
}

function generateLoginCode() {
  return crypto.randomInt(0, 10000).toString().padStart(4, '0');
}

function clearLoginChallenge(user) {
  user.loginCodeHash = null;
  user.loginCodeExpires = null;
  user.loginCodeAttempts = 0;
  user.loginChallengeHash = null;
  user.loginChallengeExpires = null;
  user.loginCodeSentAt = null;
}

function applyLoginChallenge(user, { rotateChallenge = true, existingChallengeExpires = null } = {}) {
  const code = generateLoginCode();
  const now = Date.now();
  let challengeToken = null;
  let challengeExpires = existingChallengeExpires ? new Date(existingChallengeExpires) : null;

  if (rotateChallenge) {
    challengeToken = crypto.randomBytes(32).toString('hex');
    challengeExpires = new Date(now + LOGIN_CHALLENGE_TTL_MS);
    user.loginChallengeHash = hashLoginValue(challengeToken, user._id);
    user.loginChallengeExpires = challengeExpires;
  }

  const maxExpiry = challengeExpires ? challengeExpires.getTime() : now + LOGIN_CODE_TTL_MS;
  user.loginCodeHash = hashLoginValue(code, user._id);
  user.loginCodeExpires = new Date(Math.min(now + LOGIN_CODE_TTL_MS, maxExpiry));
  user.loginCodeAttempts = 0;
  user.loginCodeSentAt = new Date(now);

  return { code, challengeToken };
}

module.exports = {
  LOGIN_CODE_TTL_MS,
  LOGIN_CHALLENGE_TTL_MS,
  LOGIN_CODE_RESEND_COOLDOWN_MS,
  MAX_LOGIN_CODE_ATTEMPTS,
  LOGIN_CODE_SELECT,
  secretsMatch,
  clearLoginChallenge,
  applyLoginChallenge,
};
