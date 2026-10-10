const User = require('../models/User');
const Shop = require('../models/Shop');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const VALID_ROLES = ['user', 'admin', 'developer'];
const isAdmin = (req) => req.user && ['admin', 'developer'].includes(req.user.role);

exports.signup = async (req, res) => {
  try {
    const { username, email, password, role, shopId } = req.body;

    // Only an admin/developer can create users. (Exception: very first user of a fresh database.)
    const totalUsers = await User.countDocuments();
    if (totalUsers > 0 && !isAdmin(req)) {
      return res.status(403).json({ message: 'Sirf admin naya user bana sakta hai' });
    }

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password kam az kam 6 characters ka ho' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const finalRole = role || 'user';

    let finalShop = null;
    if (finalRole === 'user') {
      if (!shopId || !mongoose.isValidObjectId(shopId) || !(await Shop.findById(shopId))) {
        return res.status(400).json({ message: 'Shop select karo (user ke liye shop zaroori hai)' });
      }
      finalShop = shopId;
    }

    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    if (await User.findOne({ username })) return res.status(400).json({ message: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: hashedPassword, role: finalRole, shopId: finalShop });

    res.status(201).json({
      message: 'User created successfully',
      role: user.role,
      userId: user._id,
      shopId: user.shopId
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    const isMatch = await bcrypt.compare(password || '', user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    let shop = null;
    if (user.shopId) shop = await Shop.findById(user.shopId);
    if (user.role === 'user' && (!shop || shop.isActive === false)) {
      return res.status(403).json({ message: 'Is user ki shop active nahi hai' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, shopId: user.shopId ? String(user.shopId) : null },
      process.env.SECURE_KEY,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      role: user.role,
      userId: user._id,
      username: user.username,
      shopId: user.shopId || null,
      shopName: shop ? shop.name : null
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

// admin: list users (with shop name)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password').populate('shopId', 'name').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// logged-in user changes OWN password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Old aur new password dono do' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Naya password kam az kam 6 characters ka ho' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      return res.status(400).json({ message: 'Old password galat hai' });
    }
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password change ho gaya' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: error.message });
  }
};

// admin: reset ANY user's password (no old password needed)
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Naya password kam az kam 6 characters ka ho' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: `${user.username} ka password change ho gaya` });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

// admin: change a user's shop / active status
exports.updateUser = async (req, res) => {
  try {
    const { shopId, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (shopId !== undefined) {
      if (shopId && !(mongoose.isValidObjectId(shopId) && (await Shop.findById(shopId)))) {
        return res.status(400).json({ message: 'Invalid shop' });
      }
      if (user.role === 'user' && !shopId) return res.status(400).json({ message: 'User ke liye shop zaroori hai' });
      user.shopId = shopId || null;
    }
    if (isActive !== undefined) {
      if (String(user._id) === String(req.user.userId) && !isActive) {
        return res.status(400).json({ message: 'Apna account deactivate nahi kar sakte' });
      }
      user.isActive = !!isActive;
    }
    await user.save();
    res.json({ message: 'User updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};
