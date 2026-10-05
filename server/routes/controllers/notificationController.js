const Notification = require("../models/Notification")

// Get all notifications with optional filters
const getAllNotifications = async (req, res) => {
  try {
    const {
      type,
      isRead,
      startDate,
      endDate,
      limit = 50,
      page = 1,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query

    // Build filter object
    const filter = {}

    if (type) {
      filter.type = type
    }

    if (isRead !== undefined) {
      filter.isRead = isRead === "true"
    }

    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate)
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate)
      }
    }

    // Calculate pagination
    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    // Build sort object
    const sort = {}
    sort[sortBy] = sortOrder === "desc" ? -1 : 1

    // Get notifications with pagination
    const notifications = await Notification.find(filter).sort(sort).limit(Number.parseInt(limit)).skip(skip)

    // Get total count for pagination
    const totalCount = await Notification.countDocuments(filter)
    const totalPages = Math.ceil(totalCount / Number.parseInt(limit))

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: Number.parseInt(page) < totalPages,
        hasPrevPage: Number.parseInt(page) > 1,
      },
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    })
  }
}

// Get a specific notification by ID
const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params

    const notification = await Notification.findById(id)

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      })
    }

    res.status(200).json({
      success: true,
      data: notification,
    })
  } catch (error) {
    console.error("Error fetching notification:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching notification",
      error: error.message,
    })
  }
}

// Create a new notification
const createNotification = async (req, res) => {
  try {
    const { type, title, message, priority, relatedId, relatedModel } = req.body

    // Validate required fields
    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Type, title, and message are required",
      })
    }

    const notification = new Notification({
      type,
      title,
      message,
      priority: priority || "medium",
      relatedId,
      relatedModel,
      isRead: false,
      createdAt: new Date(),
    })

    const savedNotification = await notification.save()

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: savedNotification,
    })
  } catch (error) {
    console.error("Error creating notification:", error)
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message,
    })
  }
}

// Update a notification
const updateNotification = async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    const notification = await Notification.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    )

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      data: notification,
    })
  } catch (error) {
    console.error("Error updating notification:", error)
    res.status(500).json({
      success: false,
      message: "Error updating notification",
      error: error.message,
    })
  }
}

// Mark a notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params

    const notification = await Notification.findByIdAndUpdate(
      id,
      {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    )

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    })
  } catch (error) {
    console.error("Error marking notification as read:", error)
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message,
    })
  }
}

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { isRead: false },
      {
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      },
    )

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    })
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    res.status(500).json({
      success: false,
      message: "Error marking all notifications as read",
      error: error.message,
    })
  }
}

// Get count of unread notifications
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ isRead: false })

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    })
  } catch (error) {
    console.error("Error getting unread count:", error)
    res.status(500).json({
      success: false,
      message: "Error getting unread count",
      error: error.message,
    })
  }
}

// Delete a specific notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params

    const notification = await Notification.findByIdAndDelete(id)

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
      data: notification,
    })
  } catch (error) {
    console.error("Error deleting notification:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message,
    })
  }
}

// Delete all notifications
const deleteAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({})

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} notifications deleted`,
      data: {
        deletedCount: result.deletedCount,
      },
    })
  } catch (error) {
    console.error("Error deleting all notifications:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting all notifications",
      error: error.message,
    })
  }
}

module.exports = {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteAllNotifications,
}
