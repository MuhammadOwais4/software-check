"use client"
import { useState, useEffect } from "react"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

function EquityPage({ onBack }) {
  const [equity, setEquity] = useState([])
  const [editingEquity, setEditingEquity] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "EQUITY ACCOUNT",
    description: "",
  })

  useEffect(() => {
    loadEquity()
  }, [])

  const loadEquity = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await ApiHandler.getEquity()
      console.log("Loaded equity:", response)
      setEquity(response.data || [])
    } catch (err) {
      setError(err.message)
      console.error("Error loading equity:", err)
    } finally {
      setLoading(false)
    }
  }

  // Get next account code
  const getNextAccountCode = () => {
    if (equity.length === 0) return "3001"
    const codes = equity.map((e) => Number.parseInt(e.code, 10)).filter((c) => !isNaN(c))
    const maxCode = Math.max(...codes)
    return (maxCode + 1).toString()
  }

  // When not editing, auto-generate code
  useEffect(() => {
    if (!editingEquity) {
      setFormData((prev) => ({ 
        ...prev, 
        code: getNextAccountCode() 
      }))
    }
  }, [equity, editingEquity])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.name.trim()) {
      setError("Account name is required")
      return
    }

    try {
      setLoading(true)
      setError("")

      console.log("Submitting equity data:", formData)

      if (editingEquity) {
        const response = await ApiHandler.updateEquity(editingEquity._id, formData)
        console.log("Update response:", response)
        setEditingEquity(null)
      } else {
        const response = await ApiHandler.createEquity(formData)
        console.log("Create response:", response)
      }

      // Reload equity list
      await loadEquity()
      
      // Reset form
      setFormData({ 
        code: getNextAccountCode(), 
        name: "", 
        type: "EQUITY ACCOUNT",
        description: ""
      })
    } catch (err) {
      setError(err.message)
      console.error("Error saving equity:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (equityItem) => {
    setEditingEquity(equityItem)
    setFormData({
      code: equityItem.code,
      name: equityItem.name,
      type: equityItem.type,
      description: equityItem.description || "",
    })
  }

  const handleCancel = () => {
    setEditingEquity(null)
    setFormData({ 
      code: getNextAccountCode(), 
      name: "", 
      type: "EQUITY ACCOUNT",
      description: ""
    })
    setError("")
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this equity account?")) return

    try {
      setLoading(true)
      setError("")
      await ApiHandler.deleteEquity(id)
      await loadEquity()
    } catch (err) {
      setError(err.message)
      console.error("Error deleting equity:", err)
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
            <button 
              onClick={onBack} 
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Chart of Accounts
            </button>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Equity</h2>
        <p className="text-gray-600">Manage owner's equity and retained earnings</p>
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
          {editingEquity ? "Edit Equity Account" : "Add Child Account"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Account
              </label>
              <input
                type="text"
                value="Equity"
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Child Account <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Code
              </label>
              <input
                type="text"
                value={formData.code}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                required
              >
                <option value="EQUITY ACCOUNT">Equity Account</option>
                <option value="Capital">Capital</option>
                <option value="Drawings">Drawings</option>
                <option value="Retained Earnings">Retained Earnings</option>
              </select>
            </div>
          </div>

         

          <div className="flex space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={loading}
            >
              {loading ? "Processing..." : editingEquity ? "Update Account" : "Add Account"}
            </button>
            {editingEquity && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 disabled:opacity-50 transition-colors"
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

        {/* Table Header */}
        <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
          <div className="grid grid-cols-5 gap-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Code</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {loading && equity.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Loading equity accounts...
            </div>
          ) : equity.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No child accounts found. Add your first account above.
            </div>
          ) : (
            equity.map((equityItem) => (
              <div key={equityItem._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="grid grid-cols-5 gap-4 items-center">
                  <div className="text-sm font-medium text-gray-900">{equityItem.code}</div>
                  <div className="text-sm text-gray-900">{equityItem.name}</div>
                  <div className="text-sm text-gray-500">{equityItem.type}</div>
                  <div className="text-sm text-gray-900">
                    {equityItem.balance?.toLocaleString() || '0'}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(equityItem)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                      title="Edit Account"
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(equityItem._id)}
                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
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
        {equity.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total Accounts: <span className="font-semibold">{equity.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EquityPage