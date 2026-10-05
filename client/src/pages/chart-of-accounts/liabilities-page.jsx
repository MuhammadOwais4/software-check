"use client"
import { useState, useEffect } from "react"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import ApiHandler from "../../Api/apihandle"

function LiabilitiesPage({ onBack }) {
  const [liabilities, setLiabilities] = useState([])
  const [editingLiability, setEditingLiability] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "PAYABLES",
  })

  useEffect(() => {
    loadLiabilities()
  }, [])

  const loadLiabilities = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await ApiHandler.getLiabilities()
      setLiabilities(response.data || [])
    } catch (err) {
      setError(err.message)
      console.error("Error loading liabilities:", err)
    } finally {
      setLoading(false)
    }
  }

  const getNextAccountCode = async () => {
    try {
      const response = await ApiHandler.getNextLiabilityCode()
      return response.nextCode
    } catch (error) {
      console.error("Error getting next code:", error)
      return "2001" // fallback
    }
  }

  useEffect(() => {
    const updateCode = async () => {
      if (!editingLiability) {
        const nextCode = await getNextAccountCode()
        setFormData((prev) => ({
          ...prev,
          code: nextCode,
        }))
      }
    }
    updateCode()
  }, [liabilities, editingLiability])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")

      if (editingLiability) {
        await ApiHandler.updateLiability(editingLiability._id, formData)
        setEditingLiability(null)
      } else {
        await ApiHandler.createLiability(formData)
      }

      await loadLiabilities()
      const nextCode = await getNextAccountCode()
      setFormData({ code: nextCode, name: "", type: "PAYABLES" })
    } catch (err) {
      setError(err.message)
      console.error("Error saving liability:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (liability) => {
    setEditingLiability(liability)
    setFormData({
      code: liability.code,
      name: liability.name,
      type: liability.type,
    })
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this liability?")) return

    try {
      setLoading(true)
      setError("")
      await ApiHandler.deleteLiability(id)
      await loadLiabilities()
    } catch (err) {
      setError(err.message)
      console.error("Error deleting liability:", err)
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
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Liabilities</h2>
        <p className="text-gray-600">Manage your business liabilities and obligations</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Child Account Creation Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {editingLiability ? "Edit Liability Account" : "Add Child Account"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Account</label>
              <input
                type="text"
                value="Liabilities"
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
                placeholder="Auto-generated"
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
                <option value="PAYABLES">Payables</option>
                <option value="Accurued-Payment">Accurued-Payment</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Processing..." : editingLiability ? "Update Account" : "Add Account"}
            </button>
            {editingLiability && (
              <button
                type="button"
                onClick={() => {
                  setEditingLiability(null)
                  setFormData({ code: getNextAccountCode(), name: "", type: "PAYABLES" })
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

      {/* Child Accounts List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Child Accounts</h3>
        </div>

        {/* Table Header */}
        <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Code</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">Loading liabilities...</div>
          ) : liabilities.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No child accounts found. Add your first account above.
            </div>
          ) : (
            liabilities.map((liability) => (
              <div key={liability._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="text-sm font-medium text-gray-900">{liability.code}</div>
                  <div className="text-sm text-gray-900">{liability.name}</div>
                  <div className="text-sm text-gray-500">{liability.type}</div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(liability)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded"
                      title="Edit Account"
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(liability._id)}
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

        {/* Table Footer */}
        {liabilities.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">Total Accounts: {liabilities.length}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LiabilitiesPage
