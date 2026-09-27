const { User } = require('../models');
const AppError = require('../utils/AppError');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

exports.register = async (req, res, next) => {
  try {
    const { email, password, confirmPassword } = req.body;
    
    if (!email || !email.includes('@')) {
      return next(new AppError('Valid email is required', 400));
    }
    if (!password || password.length < 8) {
      return next(new AppError('Password must be at least 8 characters', 400));
    }
    if (password !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return next(new AppError('Email already registered', 409, 'EMAIL_EXISTS'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password_hash: hashedPassword,
      role: 'attendee'
    });

    const token = generateToken(user);
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

exports.organizerRegister = async (req, res, next) => {
  try {
    const { email, password, confirmPassword, orgName } = req.body;
    
    if (!email || !email.includes('@')) {
      return next(new AppError('Valid email is required', 400));
    }
    if (!password || password.length < 8) {
      return next(new AppError('Password must be at least 8 characters', 400));
    }
    if (password !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }
    if (!orgName || orgName.trim() === '') {
      return next(new AppError('Organization name is required', 400));
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return next(new AppError('Email already registered', 409, 'EMAIL_EXISTS'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password_hash: hashedPassword,
      role: 'organizer',
      org_name: orgName.trim()
    });

    const token = generateToken(user);
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, email: user.email, role: user.role, orgName: user.org_name }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return next(new AppError('Email and password are required', 400));
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    const token = generateToken(user);
    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};
