const express = require('express');
const router = express.Router();
const authController = require('./controllers/authController');
const { requireRole } = require('../middleware/shopContext');

router.post('/signup', authController.signup);                    // admin only (checked inside)
router.post('/login', authController.login);
router.post('/change-password', authController.changePassword);   // any logged-in user
router.get('/user', requireRole('admin', 'developer'), authController.getUsers);
router.put('/users/:id', requireRole('admin', 'developer'), authController.updateUser);
router.delete('/users/:id', requireRole('developer'), authController.deleteUser);
router.put('/users/:id/password', requireRole('admin', 'developer'), authController.resetPassword);

module.exports = router;
