"use client"

import { useState, useEffect } from "react"
import ApiHandler from "../../Api/apihandle"

const Notifications = ({ onNotificationUpdate }) => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [filters, setFilters] = useState({
    type: "",
    isRead: "",
    limit: 20,
    page: 1,
  })

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await ApiHandler.getAllNotifications(filters)
      setNotifications(response.data)
      setError(null)

      // Update parent component if callback provided
      if (onNotificationUpdate) {
        onNotificationUpdate(response.data)
      }
    } catch (err) {
      setError(err.message)
      console.error("Error fetching notifications:", err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await ApiHandler.getUnreadNotificationsCount()
      setUnreadCount(response.data.unreadCount)
    } catch (err) {
      console.error("Error fetching unread count:", err)
    }
  }

  // Initial load
  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [filters])

  // Mark notification as read
  const handleMarkAsRead = async (id) => {
    try {
      await ApiHandler.markNotificationAsRead(id)
      setNotifications((prev) =>
        prev.map((notification) =>
          notification._id === id ? { ...notification, isRead: true, readAt: new Date() } : notification,
        ),
      )
      fetchUnreadCount()
    } catch (err) {
      setError(err.message)
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await ApiHandler.markAllNotificationsAsRead()
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: new Date(),
        })),
      )
      setUnreadCount(0)
    } catch (err) {
      setError(err.message)
    }
  }

  // Delete notification
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        await ApiHandler.deleteNotification(id)
        setNotifications((prev) => prev.filter((notification) => notification._id !== id))
        fetchUnreadCount()
      } catch (err) {
        setError(err.message)
      }
    }
  }

  // Delete all notifications
  const handleDeleteAll = async () => {
    if (window.confirm("Are you sure you want to delete all notifications?")) {
      try {
        await ApiHandler.deleteAllNotifications()
        setNotifications([])
        setUnreadCount(0)
      } catch (err) {
        setError(err.message)
      }
    }
  }

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }))
  }

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case "lowStock":
        return "⚠️"
      case "sale":
        return "💰"
      case "purchase":
        return "📦"
      case "expense":
        return "💸"
      case "warning":
        return "⚠️"
      case "info":
        return "ℹ️"
      case "success":
        return "✅"
      case "error":
        return "❌"
      default:
        return "📢"
    }
  }

  // Get notification color based on type and priority
  const getNotificationColor = (type, priority) => {
    if (priority === "urgent") return "bg-red-100 border-red-500 text-red-800"
    if (priority === "high") return "bg-orange-100 border-orange-500 text-orange-800"

    switch (type) {
      case "lowStock":
      case "warning":
      case "error":
        return "bg-red-50 border-red-200 text-red-700"
      case "sale":
      case "success":
        return "bg-green-50 border-green-200 text-green-700"
      case "purchase":
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-700"
      case "expense":
        return "bg-yellow-50 border-yellow-200 text-yellow-700"
      default:
        return "bg-gray-50 border-gray-200 text-gray-700"
    }
  }

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date()
    const diff = now - new Date(date)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
    return "Just now"
  }

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <h2 className="text-xl font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{unreadCount}</span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={handleDeleteAll}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Clear All
          </button>
          <button
            onClick={fetchNotifications}
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange("type", e.target.value)}
            className="w-full p-2 border rounded-md text-sm"
          >
            <option value="">All Types</option>
            <option value="lowStock">Low Stock</option>
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="expense">Expense</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filters.isRead}
            onChange={(e) => handleFilterChange("isRead", e.target.value)}
            className="w-full p-2 border rounded-md text-sm"
          >
            <option value="">All</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange("limit", e.target.value)}
            className="w-full p-2 border rounded-md text-sm"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <p>No notifications found.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              className={`p-4 rounded-lg border-l-4 ${getNotificationColor(notification.type, notification.priority)} ${
                !notification.isRead ? "border-l-4" : "opacity-75"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                    <h3 className="font-medium text-sm">{notification.title}</h3>
                    {!notification.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                    {notification.priority === "urgent" && (
                      <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">URGENT</span>
                    )}
                    {notification.priority === "high" && (
                      <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded">HIGH</span>
                    )}
                  </div>
                  <p className="text-sm mb-2">{notification.message}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatTimeAgo(notification.createdAt)}</span>
                    <span className="capitalize">{notification.type}</span>
                    {notification.isRead && <span>Read {formatTimeAgo(notification.readAt)}</span>}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {!notification.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notification._id)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notification._id)}
                    className="text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Notifications
