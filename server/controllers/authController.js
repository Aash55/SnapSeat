const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const v = require('../utils/validate');
const { jwtSecret, jwtExpiresIn } = require('../config');

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt only uses the first 72 bytes
// Compared against when the email doesn't exist, so both cases take about the same time.
const DUMMY_HASH = bcrypt.hashSync('snapseat-timing-equaliser', 10);

const generateToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });

const userDto = (u) => ({ id: u.id, email: u.email, role: u.role, orgName: u.org_name || null });

function readPasswords(body) {
  const { password, confirmPassword } = body || {};
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new AppError(`Password must be at least ${MIN_PASSWORD} characters`, 400, 'VALIDATION_ERROR', { field: 'password' });
  }
  if (password.length > MAX_PASSWORD) {
    throw new AppError(`Password must be at most ${MAX_PASSWORD} characters`, 400, 'VALIDATION_ERROR', { field: 'password' });
  }
  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400, 'VALIDATION_ERROR', { field: 'confirmPassword' });
  }
  return password;
}

async function createUser({ email, password, role, orgName }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS', { field: 'email' });
  const user = await User.create({
    email,
    password_hash: await bcrypt.hash(password, 10),
    role,
    org_name: orgName || null,
  });
  return user;
}

exports.register = async (req, res, next) => {
  try {
    const email = v.email(req.body?.email);
    const password = readPasswords(req.body);
    const user = await createUser({ email, password, role: 'attendee' });
    res.status(201).json({ token: generateToken(user), user: userDto(user) });
  } catch (err) {
    next(err);
  }
};

exports.organizerRegister = async (req, res, next) => {
  try {
    const orgName = v.string(req.body?.orgName, 'orgName', { max: 120 });
    const email = v.email(req.body?.email);
    const password = readPasswords(req.body);
    const user = await createUser({ email, password, role: 'organizer', orgName });
    res.status(201).json({ token: generateToken(user), user: userDto(user) });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (typeof req.body?.email !== 'string' || typeof password !== 'string' || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
    }
    const email = req.body.email.trim().toLowerCase();
    const user = await User.findOne({ where: { email } });
    // Same message and similar timing whether the email exists or not.
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new AppError('Incorrect email or password', 401, 'INVALID_CREDENTIALS');

    res.json({ token: generateToken(user), user: userDto(user) });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) throw new AppError('Account not found', 401, 'UNAUTHORIZED');
    res.json({ user: userDto(user) });
  } catch (err) {
    next(err);
  }
};
