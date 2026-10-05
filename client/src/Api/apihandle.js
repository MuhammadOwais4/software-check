import axios from "axios"

// const API_BASE_URL = "http://localhost:5000/api"
const API_BASE_URL="https://debug-nxby.vercel.app/api"

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 55000, // Increased timeout
  headers: {
    "Content-Type": "application/json",
  },
})

// Request interceptor for adding auth tokens if needed
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem("authToken")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    console.log(`Making ${config.method?.toUpperCase()} request to:`, config.url)
    return config
  },
  (error) => {
    console.error("Request interceptor error:", error)
    return Promise.reject(error)
  },
)

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => {
    console.log(`Response from ${response.config.url}:`, response.status)
    return response
  },
  (error) => {
    console.error("API Error Details:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    })

    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      console.error("Server connection failed. Please check if the server is running.")
    }

    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem("authToken")
    }
    return Promise.reject(error)
  },
)

const emitVoucherChanged = (detail) => {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("voucher:changed", {
          detail: { ...detail, at: Date.now() },
        }),
      )
    } catch (_) {}
  }
}

// Normalizes fromDate/toDate -> startDate/endDate, ensures endDate is end-of-day,
// and applies default sorting (voucherDate desc) when not provided.
const normalizeVoucherFilters = (rawFilters = {}) => {
  const normalized = { ...(rawFilters || {}) }

  const toISO = (dateStr, endOfDay = false) => {
    if (!dateStr) return dateStr
    const isDateOnly = typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    const d = isDateOnly ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    if (endOfDay) d.setHours(23, 59, 59, 999)
    else if (isDateOnly) d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }

  // Map synonyms
  if (normalized.fromDate && !normalized.startDate) {
    normalized.startDate = toISO(normalized.fromDate, false)
    delete normalized.fromDate
  }
  if (normalized.toDate && !normalized.endDate) {
    normalized.endDate = toISO(normalized.toDate, true)
    delete normalized.toDate
  }

  // Normalize YYYY-MM-DD passed directly to start/end
  if (typeof normalized.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(normalized.startDate)) {
    normalized.startDate = toISO(normalized.startDate, false)
  }
  if (typeof normalized.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(normalized.endDate)) {
    normalized.endDate = toISO(normalized.endDate, true)
  }

  if (!normalized.sortBy) normalized.sortBy = "voucherDate"
  if (!normalized.sortOrder) normalized.sortOrder = "desc"
  if (!normalized.page) normalized.page = 1
  if (!normalized.limit) normalized.limit = 1000

  return normalized
}

const ApiHandler = {
  // Test server connection
  testConnection: async () => {
    try {
      const response = await apiClient.get("/health")
      return response.data
    } catch (error) {
      throw new Error("Server connection failed. Please check if the server is running on " + API_BASE_URL)
    }
  },

  // ============ PRODUCT ENDPOINTS ============

  // Get all products
  getProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/products?${params.toString()}` : "/products"
      console.log("Fetching products from:", url)
      const response = await apiClient.get(url)

      console.log("Products response:", response.data)

      // Handle different response structures
      if (response.data) {
        // If response has a success property and data property
        if (response.data.success !== undefined) {
          return response.data
        }
        // If response.data is directly an array
        if (Array.isArray(response.data)) {
          return { success: true, data: response.data }
        }
        // If response.data has a data property that's an array
        if (response.data.data && Array.isArray(response.data.data)) {
          return response.data
        }
        // Otherwise return as is
        return response.data
      }

      return { success: true, data: [] }
    } catch (error) {
      console.error("Error fetching products:", error)
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch products")
    }
  },

  // Get single product by ID
  getProduct: async (id) => {
    try {
      const response = await apiClient.get(`/products/${id}`)
      console.log("Single product response:", response.data)
      return response.data
    } catch (error) {
      console.error("Error fetching product:", error)
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch product")
    }
  },

  // Create new product
  createProduct: async (productData) => {
    try {
      console.log("Creating product:", productData)
      const response = await apiClient.post("/products", productData)
      console.log("Create product response:", response.data)
      return response.data
    } catch (error) {
      console.error("Error creating product:", error)
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      const errorMessage = error.response?.data?.error
        ? Array.isArray(error.response.data.error)
          ? error.response.data.error.join(", ")
          : error.response.data.error
        : error.response?.data?.message || error.message || "Failed to create product"
      throw new Error(errorMessage)
    }
  },

  // Update existing product
  updateProduct: async (id, productData) => {
    try {
      console.log("Updating product:", id, productData)
      const response = await apiClient.put(`/products/${id}`, productData)
      console.log("Update product response:", response.data)
      return response.data
    } catch (error) {
      console.error("Error updating product:", error)
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      const errorMessage = error.response?.data?.error
        ? Array.isArray(error.response.data.error)
          ? error.response.data.error.join(", ")
          : error.response.data.error
        : error.response?.data?.message || error.message || "Failed to update product"
      throw new Error(errorMessage)
    }
  },

  // Delete product
  deleteProduct: async (id) => {
    try {
      console.log("Deleting product:", id)
      const response = await apiClient.delete(`/products/${id}`)
      console.log("Delete product response:", response.data)
      return response.data
    } catch (error) {
      console.error("Error deleting product:", error)
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete product")
    }
  },

  // Update stock (add/remove quantity)
  updateStock: async (id, quantity) => {
    try {
      console.log("Updating stock:", id, quantity)
      const response = await apiClient.patch(`/products/${id}/stock`, { quantity })
      console.log("Update stock response:", response.data)
      return response.data
    } catch (error) {
      console.error("Error updating stock:", error)
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update stock")
    }
  },
  // RETURN PRODUCTS

  returnProduct: async (returnData) => {
    try {
      console.log("Returning product with data:", returnData)
      const response = await apiClient.post("/products/return", returnData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      let errorMessage = "Failed to return product"
      if (error.response?.data?.error) {
        if (Array.isArray(error.response.data.error)) {
          errorMessage = error.response.data.error.join(", ")
        } else {
          errorMessage = error.response.data.error
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }
      throw new Error(errorMessage)
    }
  },
//  getPurchaseReturns
getPurchaseReturns: async (id) => {
  try {
    const response = await apiClient.get(`/products/returns/${id}`)
    return response.data
  } catch (error) {
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.")
    }

    throw new Error(
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch purchase returns"
    )
  }
},


  // Get products by category
  getProductsByCategory: async (category, filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString()
        ? `/products/category/${category}?${params.toString()}`
        : `/products/category/${category}`

      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch products by category")
    }
  },

  // Get products by vendor
  getProductsByVendor: async (vendorName, filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString()
        ? `/products/vendor/${vendorName}?${params.toString()}`
        : `/products/vendor/${vendorName}`

      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch products by vendor")
    }
  },

  // Get low stock products
  getLowStockProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/products/low-stock?${params.toString()}` : "/products/low-stock"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch low stock products")
    }
  },

  // Get expiring products
  getExpiringProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/products/expiring?${params.toString()}` : "/products/expiring"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch expiring products")
    }
  },

  // Get expired products
  getExpiredProducts: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/products/expired?${params.toString()}` : "/products/expired"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch expired products")
    }
  },

  // Get product categories
  getProductCategories: async () => {
    try {
      const response = await apiClient.get("/products/categories")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch product categories")
    }
  },

  // Get vendors
  getVendors: async () => {
    try {
      const response = await apiClient.get("/products/vendors")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch vendors")
    }
  },

  // Get purchase types
  getPurchaseTypes: async () => {
    try {
      const response = await apiClient.get("/products/purchase-types")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch purchase types")
    }
  },
  // purchase discounts
  getPurchaseDiscounts: async () => {
    try {
      const response = await apiClient.get('/purchases-discount');
      return response.data;
    } catch (error) {
      console.error('Error fetching purchase discounts:', error);
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch purchase discounts");
    }
  },
  getPurchaseDiscountById: async (id) => {
    try {
      const response = await apiClient.get(`/purchases-discount/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching purchase discount by ID:', error);
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch purchase discount");
    }
  },
  createPurchaseDiscount: async (data) => {
    try {
      const response = await apiClient.post('/purchases-discount', data);
      return response.data;
    } catch (error) {
      console.error('Error creating purchase discount:', error);
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create purchase discount");
    }
  },
  updatePurchaseDiscount: async (id, data) => {
    try {
      const response = await apiClient.put(`/purchases-discount/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating purchase discount:', error);
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update purchase discount");
    }
  },
  deletePurchaseDiscount: async (id) => {
    try {
      const response = await apiClient.delete(`/purchases-discount/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting purchase discount:', error);
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete purchase discount");
    }
  },
  getTotalPurchaseDiscount: async () => {
    try {
      const response = await apiClient.get('/purchases-discount/total/amount');
      return response.data;
    } catch (error) {
      console.error('Error fetching total purchase discount:', error);
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch total purchase discount");
    }
  },

  // ============ SALES ENDPOINTS ============

  // Get all sales with optional filters
  getSales: async (filters = {}) => {
    try {
      const params = new URLSearchParams()

      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/sales?${params.toString()}` : "/sales"
      const response = await apiClient.get(url)

      if (response.data) {
        return response.data
      }

      return { success: true, data: [] }
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch sales")
    }
  },

  // Get sales statistics
  getSalesStats: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/sales/stats?${params.toString()}` : "/sales/stats"
      const response = await apiClient.get(url)

      if (response.data && response.data.success) {
        return response.data
      }

      return {
        success: true,
        data: {
          totalSales: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalOrders: 0,
          averageSaleValue: 0,
          profitMargin: 0,
        },
      }
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch sales statistics")
    }
  },

  createSale: async (saleData) => {
    try {
      console.log("Creating sale with data:", saleData)
      const response = await apiClient.post("/sales", saleData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }

      let errorMessage = "Failed to create sale"

      if (error.response?.data?.error) {
        if (Array.isArray(error.response.data.error)) {
          errorMessage = error.response.data.error.join(", ")
        } else {
          errorMessage = error.response.data.error
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }

      throw new Error(errorMessage)
    }
  },

  // Update existing sale
  updateSale: async (id, saleData) => {
    try {
      const response = await apiClient.put(`/sales/${id}`, saleData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      const errorMessage = error.response?.data?.error
        ? Array.isArray(error.response.data.error)
          ? error.response.data.error.join(", ")
          : error.response.data.error
        : error.response?.data?.message || error.message || "Failed to update sale"
      throw new Error(errorMessage)
    }
  },
returnSale: async (returnData) => {
  try {
    const response = await apiClient.post("/sales/return", returnData)
    return response.data
  } catch (error) {
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.")
    }
    const errorMessage = error.response?.data?.error
      ? Array.isArray(error.response.data.error)
        ? error.response.data.error.join(", ")
        : error.response.data.error
      : error.response?.data?.message || error.message || "Failed to process sale return"
    throw new Error(errorMessage)
  }
},

// Sale Discounts APIs
getSaleDiscounts: async () => {
  try {
    const response = await apiClient.get('/sale-discount');
    return response.data;
  } catch (error) {
    console.error('Error fetching sale discounts:', error);
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.");
    }
    throw new Error(error.response?.data?.message || error.message || "Failed to fetch sale discounts");
  }
},

getSaleDiscountById: async (id) => {
  try {
    const response = await apiClient.get(`/sale-discount/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching sale discount by ID:', error);
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.");
    }
    throw new Error(error.response?.data?.message || error.message || "Failed to fetch sale discount");
  }
},

createSaleDiscount: async (data) => {
  try {
    const response = await apiClient.post('/sale-discount', data);
    return response.data;
  } catch (error) {
    console.error('Error creating sale discount:', error);
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.");
    }
    throw new Error(error.response?.data?.message || error.message || "Failed to create sale discount");
  }
},

updateSaleDiscount: async (id, data) => {
  try {
    const response = await apiClient.put(`/sale-discount/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating sale discount:', error);
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.");
    }
    throw new Error(error.response?.data?.message || error.message || "Failed to update sale discount");
  }
},

deleteSaleDiscount: async (id) => {
  try {
    const response = await apiClient.delete(`/sale-discount/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting sale discount:', error);
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.");
    }
    throw new Error(error.response?.data?.message || error.message || "Failed to delete sale discount");
  }
},
  
// Add this function to fetch returns:
getReturns: async (filters = {}) => {
  try {
    const params = new URLSearchParams()
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
        params.append(key, filters[key])
      }
    })

    const url = params.toString() ? `/sales/return?${params.toString()}` : "/sales/return"
    const response = await apiClient.get(url)
    
    if (response.data && response.success !== false) {
      return response.data
    }
    
    return { success: true, data: [] }
  } catch (error) {
    if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to server. Please check if the server is running.")
    }
    console.error("Error fetching returns:", error)
    return { success: true, data: [] }
  }
},// Delete sale
  deleteSale: async (id) => {
    try {
      const response = await apiClient.delete(`/sales/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete sale")
    }
  },

  
  // ============ NOTIFICATION ENDPOINTS ============

  // Get all notifications with optional filters
  getAllNotifications: async (filters = {}) => {
    try {
      const params = new URLSearchParams()

      // Add filters to params
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/notifications?${params.toString()}` : "/notifications"
      const response = await apiClient.get(url)

      // Handle different response structures
      if (response.data) {
        return response.data
      }

      return { data: [] }
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch notifications")
    }
  },

  // Get notification by ID
  getNotificationById: async (id) => {
    try {
      const response = await apiClient.get(`/notifications/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch notification")
    }
  },

  // Create new notification
  createNotification: async (notificationData) => {
    try {
      const response = await apiClient.post("/notifications", notificationData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create notification")
    }
  },

  // Update notification
  updateNotification: async (id, notificationData) => {
    try {
      const response = await apiClient.put(`/notifications/${id}`, notificationData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update notification")
    }
  },

  // Mark notification as read
  markNotificationAsRead: async (id) => {
    try {
      const response = await apiClient.patch(`/notifications/${id}/read`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to mark notification as read")
    }
  },

  // Mark all notifications as read
  markAllNotificationsAsRead: async () => {
    try {
      const response = await apiClient.patch("/notifications/mark-all-read")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to mark all notifications as read")
    }
  },

  // Get unread notifications count
  getUnreadNotificationsCount: async () => {
    try {
      const response = await apiClient.get("/notifications/unread-count")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch unread count")
    }
  },

  // Delete notification
  deleteNotification: async (id) => {
    try {
      const response = await apiClient.delete(`/notifications/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete notification")
    }
  },

  // Delete all notifications
  deleteAllNotifications: async () => {
    try {
      const response = await apiClient.delete("/notifications")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete all notifications")
    }
  },

  // Get recent notifications
  getRecentNotifications: async (limit = 10) => {
    try {
      const response = await apiClient.get(`/notifications/recent?limit=${limit}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch recent notifications")
    }
  },

  // Get notifications by type
  getNotificationsByType: async (type, filters = {}) => {
    try {
      const params = new URLSearchParams()
      params.append("type", type)

      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const response = await apiClient.get(`/notifications/by-type?${params.toString()}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch notifications by type")
    }
  },

  // Get notifications by priority
  getNotificationsByPriority: async (priority, filters = {}) => {
    try {
      const params = new URLSearchParams()
      params.append("priority", priority)

      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const response = await apiClient.get(`/notifications/by-priority?${params.toString()}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch notifications by priority")
    }
  },

  // ============ DASHBOARD ENDPOINTS ============

  // Get complete dashboard data
  getDashboardData: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/dashboard?${params.toString()}` : "/dashboard"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch dashboard data")
    }
  },

  // Get key performance indicators
  getKPIs: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/dashboard/kpis?${params.toString()}` : "/dashboard/kpis"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch KPIs")
    }
  },

  // Get chart data
  getChartData: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/dashboard/charts?${params.toString()}` : "/dashboard/charts"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch chart data")
    }
  },

  // Get recent activities
  getRecentActivities: async () => {
    try {
      const response = await apiClient.get("/dashboard/recent")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch recent activities")
    }
  },

  // ============ FILE UPLOAD ENDPOINTS ============

  // Upload file
  uploadFile: async (file, folder = "uploads") => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", folder)

      const response = await apiClient.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to upload file")
    }
  },

  // Delete file
  deleteFile: async (fileUrl) => {
    try {
      const response = await apiClient.delete("/upload", {
        data: { fileUrl },
      })
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete file")
    }
  },

  // ============ CHART OF ACCOUNTS ENDPOINTS ============

  // Assets endpoints
  getAssets: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/assets")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch assets")
    }
  },

  getAssetById: async (id) => {
    try {
      const response = await apiClient.get(`/chart-of-accounts/assets/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch asset")
    }
  },

  createAsset: async (assetData) => {
    try {
      const response = await apiClient.post("/chart-of-accounts/assets", assetData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create asset")
    }
  },

  updateAsset: async (id, assetData) => {
    try {
      const response = await apiClient.put(`/chart-of-accounts/assets/${id}`, assetData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update asset")
    }
  },

  deleteAsset: async (id) => {
    try {
      const response = await apiClient.delete(`/chart-of-accounts/assets/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete asset")
    }
  },

  getNextAssetCode: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/assets/next-code")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to get next asset code")
    }
  },

  // Liabilities endpoints
  getLiabilities: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/liabilities")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch liabilities")
    }
  },

  getLiabilityById: async (id) => {
    try {
      const response = await apiClient.get(`/chart-of-accounts/liabilities/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch liability")
    }
  },

  createLiability: async (liabilityData) => {
    try {
      const response = await apiClient.post("/chart-of-accounts/liabilities", liabilityData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create liability")
    }
  },

  updateLiability: async (id, liabilityData) => {
    try {
      const response = await apiClient.put(`/chart-of-accounts/liabilities/${id}`, liabilityData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update liability")
    }
  },

  deleteLiability: async (id) => {
    try {
      const response = await apiClient.delete(`/chart-of-accounts/liabilities/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete liability")
    }
  },

  getNextLiabilityCode: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/liabilities/next-code")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to get next liability code")
    }
  },

  // Equity endpoints
  getEquity: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/equity")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch equity")
    }
  },

  getEquityById: async (id) => {
    try {
      const response = await apiClient.get(`/chart-of-accounts/equity/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch equity")
    }
  },

  createEquity: async (equityData) => {
    try {
      const response = await apiClient.post("/chart-of-accounts/equity", equityData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create equity")
    }
  },

  updateEquity: async (id, equityData) => {
    try {
      const response = await apiClient.put(`/chart-of-accounts/equity/${id}`, equityData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update equity")
    }
  },

  deleteEquity: async (id) => {
    try {
      const response = await apiClient.delete(`/chart-of-accounts/equity/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete equity")
    }
  },

  getNextEquityCode: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/equity/next-code")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to get next equity code")
    }
  },

  // Revenue endpoints
  getRevenue: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/revenue")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch revenue")
    }
  },

  getRevenueById: async (id) => {
    try {
      const response = await apiClient.get(`/chart-of-accounts/revenue/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch revenue")
    }
  },

  createRevenue: async (revenueData) => {
    try {
      const response = await apiClient.post("/chart-of-accounts/revenue", revenueData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create revenue")
    }
  },

  updateRevenue: async (id, revenueData) => {
    try {
      const response = await apiClient.put(`/chart-of-accounts/revenue/${id}`, revenueData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update revenue")
    }
  },

  deleteRevenue: async (id) => {
    try {
      const response = await apiClient.delete(`/chart-of-accounts/revenue/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete revenue")
    }
  },

  getNextRevenueCode: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/revenue/next-code")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to get next revenue code")
    }
  },

  // Chart of Accounts Expenses endpoints (different from regular expenses)
  getChartExpenses: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/expenses")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch chart expenses")
    }
  },

  getChartExpenseById: async (id) => {
    try {
      const response = await apiClient.get(`/chart-of-accounts/expenses/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch chart expense")
    }
  },

  createChartExpense: async (expenseData) => {
    try {
      const response = await apiClient.post("/chart-of-accounts/expenses", expenseData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create chart expense")
    }
  },

  updateChartExpense: async (id, expenseData) => {
    try {
      const response = await apiClient.put(`/chart-of-accounts/expenses/${id}`, expenseData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update chart expense")
    }
  },

  deleteChartExpense: async (id) => {
    try {
      const response = await apiClient.delete(`/chart-of-accounts/expenses/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete chart expense")
    }
  },

  getNextChartExpenseCode: async () => {
    try {
      const response = await apiClient.get("/chart-of-accounts/expenses/next-code")
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to get next chart expense code")
    }
  },


getAllAccounts: async () => {
  const response = await apiClient.get("/ledgers/accounts")  
  return response.data
},

getAccountLedger: async ({ accountCode, accountName, fromDate, toDate }) => {
  const params = new URLSearchParams({
    accountCode: accountCode || "",
    accountName: accountName || "",
    fromDate,
    toDate,
  })
  const response = await apiClient.get(`/ledgers/account-ledger?${params}`) 
  return response.data
},

  // ============ VOUCHER ENDPOINTS ============

  // Get all vouchers with optional filters
  getVouchers: async (filters = {}) => {
    try {
      const normalized = normalizeVoucherFilters(filters)

      const params = new URLSearchParams()
      Object.keys(normalized).forEach((key) => {
        const val = normalized[key]
        if (val !== undefined && val !== null && val !== "") {
          params.append(key, val)
        }
      })

      const url = params.toString() ? `/vouchers?${params.toString()}` : "/vouchers"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch vouchers")
    }
  },

  // Get single voucher by ID
  getVoucher: async (id) => {
    try {
      const response = await apiClient.get(`/vouchers/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch voucher")
    }
  },

  getVoucherFull: async (voucherOrId) => {
    try {
      const id = typeof voucherOrId === "string" ? voucherOrId : voucherOrId?._id
      if (!id) throw new Error("Missing voucher id")
      const res = await apiClient.get(`/vouchers/${id}`)
      return res.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch full voucher")
    }
  },

  // Create new voucher
  createVoucher: async (voucherData) => {
    try {
      console.log("Creating voucher with data:", voucherData)
      const response = await apiClient.post("/vouchers", voucherData)
      try {
        emitVoucherChanged({
          action: "create",
          id: response?.data?.data?._id ?? response?.data?._id ?? response?.data?.id,
        })
      } catch (_) {}
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      const errorMessage = error.response?.data?.error
        ? Array.isArray(error.response.data.error)
          ? error.response.data.error.join(", ")
          : error.response.data.error
        : error.response?.data?.message || error.message || "Failed to create voucher"
      throw new Error(errorMessage)
    }
  },

  // Update existing voucher
  updateVoucher: async (id, voucherData) => {
    try {
      const response = await apiClient.put(`/vouchers/${id}`, voucherData)
      emitVoucherChanged({ action: "update", id })
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      const errorMessage = error.response?.data?.error
        ? Array.isArray(error.response.data.error)
          ? error.response.data.error.join(", ")
          : error.response.data.error
        : error.response?.data?.message || error.message || "Failed to update voucher"
      throw new Error(errorMessage)
    }
  },

  // Delete voucher
  deleteVoucher: async (id) => {
    try {
      const response = await apiClient.delete(`/vouchers/${id}`)
      emitVoucherChanged({ action: "delete", id })
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete voucher")
    }
  },

  // Get vouchers by type (CPV, BPV, BRV, CRV, JV)
  getVouchersByType: async (type, filters = {}) => {
    try {
      const normalized = normalizeVoucherFilters(filters)
      const params = new URLSearchParams()
      params.append("type", type)

      Object.keys(normalized).forEach((key) => {
        const val = normalized[key]
        if (val !== undefined && val !== null && val !== "") {
          params.append(key, val)
        }
      })

      const response = await apiClient.get(`/vouchers/by-type?${params.toString()}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch vouchers by type")
    }
  },

  // Get next voucher number for a specific type
  getNextVoucherNumber: async (type) => {
    try {
      const response = await apiClient.get(`/vouchers/next-number/${type}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to get next voucher number")
    }
  },

  // Get voucher statistics
  getVoucherStats: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/vouchers/stats?${params.toString()}` : "/vouchers/stats"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch voucher statistics")
    }
  },

  // ============ ACCOUNT ENDPOINTS ============

  // Get all accounts
  getAccounts: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })

      const url = params.toString() ? `/accounts?${params.toString()}` : "/accounts"
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch accounts")
    }
  },

  // Get single account by ID
  getAccount: async (id) => {
    try {
      const response = await apiClient.get(`/accounts/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch account")
    }
  },

  // Create new account
  createAccount: async (accountData) => {
    try {
      const response = await apiClient.post("/accounts", accountData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create account")
    }
  },

  // Update existing account
  updateAccount: async (id, accountData) => {
    try {
      const response = await apiClient.put(`/accounts/${id}`, accountData)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update account")
    }
  },

  // Delete account
  deleteAccount: async (id) => {
    try {
      const response = await apiClient.delete(`/accounts/${id}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete account")
    }
  },

  // Get accounts by type (asset, liability, equity, revenue, expense)
  getAccountsByType: async (type) => {
    try {
      const response = await apiClient.get(`/accounts/by-type/${type}`)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch accounts by type")
    }
  },
// "//  Vendorpaymentvoucherroutes ========"
// ============================================

  // ============ VENDOR PAYMENT VOUCHER ENDPOINTS ============
  
  // Get Cash/Bank Accounts
  getVendorPaymentCashBankAccounts: async () => {
    try {
      const response = await apiClient.get('/vendor-payment-vouchers/cash-bank-accounts');
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch cash/bank accounts");
    }
  },

  // Get Vendors
  getVendorPaymentVendors: async () => {
    try {
      const response = await apiClient.get('/vendor-payment-vouchers/vendors');
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch vendors");
    }
  },

  // Get Vendor Purchase Details
  getVendorPurchaseDetails: async (vendorId) => {
    try {
      const response = await apiClient.get(`/vendor-payment-vouchers/vendor-purchases/${vendorId}`);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch vendor purchase details");
    }
  },

  // Create Vendor Payment Voucher
  createVendorPaymentVoucher: async (voucherData) => {
    try {
      const response = await apiClient.post('/vendor-payment-vouchers', voucherData);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to create vendor payment voucher");
    }
  },

  // Get All Vendor Payment Vouchers
  getAllVendorPaymentVouchers: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key]);
        }
      });

      const url = params.toString() 
        ? `/vendor-payment-vouchers?${params.toString()}` 
        : '/vendor-payment-vouchers';
      
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch vendor payment vouchers");
    }
  },

  // Get Single Vendor Payment Voucher
  getVendorPaymentVoucher: async (id) => {
    try {
      const response = await apiClient.get(`/vendor-payment-vouchers/${id}`);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to fetch vendor payment voucher");
    }
  },

  // Update Vendor Payment Voucher
  updateVendorPaymentVoucher: async (id, voucherData) => {
    try {
      const response = await apiClient.put(`/vendor-payment-vouchers/${id}`, voucherData);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to update vendor payment voucher");
    }
  },

  // Delete Vendor Payment Voucher
  deleteVendorPaymentVoucher: async (id) => {
    try {
      const response = await apiClient.delete(`/vendor-payment-vouchers/${id}`);
      return response.data;
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.");
      }
      throw new Error(error.response?.data?.message || error.message || "Failed to delete vendor payment voucher");
    }
  },
 // ============ STOCK LEDGER ENDPOINTS ============
 
  /**
   * Get full FIFO stock ledger (all products, date-filtered)
   *
   * @param {Object} filters
   * @param {string} [filters.startDate]  - "YYYY-MM-DD"
   * @param {string} [filters.endDate]    - "YYYY-MM-DD"
   * @param {string} [filters.productId]  - MongoDB ObjectId
   * @param {string} [filters.category]   - product category string
   * @param {string} [filters.type]       - "IN" | "OUT"
   * @param {number} [filters.page]       - page number (default 1)
   * @param {number} [filters.limit]      - items per page (default 50)
   *
   * @returns {Promise<{ success, data, summary, pagination }>}
   */
  getStockLedger: async (filters = {}) => {
    try {
      const params = new URLSearchParams()
      Object.keys(filters).forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
          params.append(key, filters[key])
        }
      })
 
      const url = params.toString()
        ? `/stock-ledger?${params.toString()}`
        : "/stock-ledger"
 
      const response = await apiClient.get(url)
 
      if (response.data) {
        return response.data
      }
      return { success: true, data: [], summary: {}, pagination: {} }
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(
        error.response?.data?.message || error.message || "Failed to fetch stock ledger"
      )
    }
  },
 
  /**
   * Get FIFO ledger for a single product (full history, no date filter)
   *
   * @param {string} productId - MongoDB ObjectId of the product
   * @returns {Promise<{ success, product, data, summary }>}
   */
  getProductLedger: async (productId) => {
    try {
      const response = await apiClient.get(`/stock-ledger/product/${productId}`)
 
      if (response.data) {
        return response.data
      }
      return { success: true, product: null, data: [], summary: {} }
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(
        error.response?.data?.message || error.message || "Failed to fetch product ledger"
      )
    }
  },
 

  // ============ END OF VENDOR PAYMENT VOUCHER ENDPOINTS ============
  // ============ UTILITY METHODS ============

  // Generic GET request
  get: async (endpoint, params = {}) => {
    try {
      const queryParams = new URLSearchParams()
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
          queryParams.append(key, params[key])
        }
      })

      const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint
      const response = await apiClient.get(url)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || `Failed to fetch ${endpoint}`)
    }
  },

  // Generic POST request
  post: async (endpoint, data = {}) => {
    try {
      const response = await apiClient.post(endpoint, data)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || `Failed to post to ${endpoint}`)
    }
  },

  // Generic PUT request
  put: async (endpoint, data = {}) => {
    try {
      const response = await apiClient.put(endpoint, data)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || `Failed to update ${endpoint}`)
    }
  },

  // Generic DELETE request
  delete: async (endpoint) => {
    try {
      const response = await apiClient.delete(endpoint)
      return response.data
    } catch (error) {
      if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        throw new Error("Cannot connect to server. Please check if the server is running.")
      }
      throw new Error(error.response?.data?.message || error.message || `Failed to delete ${endpoint}`)
    }
  },

  // Set API base URL
  setBaseURL: (url) => {
    apiClient.defaults.baseURL = url
  },

  // Get API base URL
  getBaseURL: () => {
    return apiClient.defaults.baseURL
  },

  // Set auth token
  setAuthToken: (token) => {
    localStorage.setItem("authToken", token)
  },

  // Get auth token
  getAuthToken: () => {
    return localStorage.getItem("authToken")
  },

  // Clear auth token
  clearAuthToken: () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("user")
  },
}

export default ApiHandler
