"use client"
import { useState, useEffect } from "react"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

function RevenuePage({ onBack }) {
  const [revenue, setRevenue] = useState([])
  const [editingRevenue, setEditingRevenue] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "INCOME ACCOUNT",
  })

  useEffect(() => {
    loadRevenue()
  }, [])

  const loadRevenue = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await ApiHandler.getRevenue()
      setRevenue(response.data || [])
    } catch (err) {
      setError(err.message)
      console.error("Error loading revenue:", err)
    } finally {
      setLoading(false)
    }
  }

  // Function to get the next available account code
  function getNextAccountCode() {
    if (revenue.length === 0) return "4001"
    const maxCode = Math.max(...revenue.map((acc) => Number.parseInt(acc.code)))
    return String(maxCode + 1)
  }

  useEffect(() => {
    if (!editingRevenue) {
      setFormData((prev) => ({
        ...prev,
        code: getNextAccountCode(),
      }))
    }
  }, [revenue, editingRevenue])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")

      const dataToSubmit = { ...formData }
      if (!editingRevenue) {
        try {
          const codeResponse = await ApiHandler.getNextRevenueCode()
          dataToSubmit.code = codeResponse.nextCode
        } catch (codeError) {
          console.warn("Failed to get next code from server, using client-generated:", codeError)
        }
      }

      if (editingRevenue) {
        await ApiHandler.updateRevenue(editingRevenue._id, dataToSubmit)
        setEditingRevenue(null)
      } else {
        await ApiHandler.createRevenue(dataToSubmit)
      }

      await loadRevenue()
      setFormData({ code: getNextAccountCode(), name: "", type: "INCOME ACCOUNT" })
    } catch (err) {
      setError(err.message)
      console.error("Error saving revenue:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (rev) => {
    setEditingRevenue(rev)
    setFormData({
      code: rev.code,
      name: rev.name,
      type: rev.type,
    })
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this revenue account?")) return

    try {
      setLoading(true)
      setError("")
      await ApiHandler.deleteRevenue(id)
      await loadRevenue()
    } catch (err) {
      setError(err.message)
      console.error("Error deleting revenue:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Chart of Accounts
            </button>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Revenue</h2>
        <p className="text-gray-600">Manage your business revenue accounts</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {editingRevenue ? "Edit Revenue Account" : "Add Child Account"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Account</label>
              <input
                type="text"
                value="Revenue"
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Child Account</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter account name"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Code</label>
              <input
                type="text"
                value={formData.code}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Type
</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="INCOME ACCOUNT">Income Account</option>
                <option value="SALE ACCOUNT">Sale Account</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Processing..." : editingRevenue ? "Update Account" : "Add Account"}
            </button>
            {editingRevenue && (
              <button
                type="button"
                onClick={() => {
                  setEditingRevenue(null)
                  setFormData({ code: getNextAccountCode(), name: "", type: "INCOME ACCOUNT" })
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                disabled={loading}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Child Accounts</h3>
        </div>
        <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Code</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">Loading revenue accounts...</div>
          ) : revenue.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No child accounts found. Add your first account above.
            </div>
          ) : (
            revenue.map((rev) => (
              <div key={rev._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="text-sm font-medium text-gray-900">{rev.code}</div>
                  <div className="text-sm text-gray-900">{rev.name}</div>
                  <div className="text-sm text-gray-500">{rev.type}</div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(rev)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded"
                      title="Edit Account"
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rev._id)}
                      className="text-red-600 hover:text-red-900 p-1 rounded"
                      title="Delete Account"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {revenue.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">Total Accounts: {revenue.length}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RevenuePage
