const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'developer'],
    default: 'user',
    required: true
  },
  // Shop of this user. 'user' role must have one; admin/developer can see all shops.
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// users are global (not filtered by shop)
userSchema.options.skipShopScope = true;

module.exports = mongoose.model('User', userSchema);
