const express = require("express")
const router = express.Router()
const {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteAllNotifications,
} = require("./controllers/notificationController.js")

// GET /api/notifications - Get all notifications with optional filters
router.get("/", getAllNotifications)

// GET /api/notifications/unread-count - Get count of unread notifications
router.get("/unread-count", getUnreadCount)

// GET /api/notifications/:id - Get a specific notification
router.get("/:id", getNotificationById)

// POST /api/notifications - Create a new notification
router.post("/", createNotification)

// PUT /api/notifications/:id - Update a notification
router.put("/:id", updateNotification)

// PATCH /api/notifications/:id/read - Mark a notification as read
router.patch("/:id/read", markAsRead)

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch("/mark-all-read", markAllAsRead)

// DELETE /api/notifications/:id - Delete a specific notification
router.delete("/:id", deleteNotification)

// DELETE /api/notifications - Delete all notifications
router.delete("/", deleteAllNotifications)

module.exports = router
