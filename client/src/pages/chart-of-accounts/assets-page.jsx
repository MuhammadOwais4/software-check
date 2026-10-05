"use client"
import { useState, useEffect } from "react"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

function AssetsPage({ onBack }) {
  const [assets, setAssets] = useState([])
  const [editingAsset, setEditingAsset] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "CASH ACCOUNT", // Updated to match backend enum values
  })

  // Load assets from API on first render
  useEffect(() => {
    loadAssets()
  }, [])

  const loadAssets = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await ApiHandler.getAssets()
      setAssets(response.data || [])
    } catch (err) {
      setError(err.message)
      console.error("Error loading assets:", err)
    } finally {
      setLoading(false)
    }
  }

  // Function to get next account code
  const getNextAccountCode = () => {
    if (assets.length === 0) return "1001"
    const codes = assets.map((a) => Number.parseInt(a.code, 10))
    const maxCode = Math.max(...codes)
    return (maxCode + 1).toString()
  }

  // Auto-fill account code when adding a new asset
  useEffect(() => {
    if (!editingAsset) {
      setFormData((prev) => ({
        ...prev,
        code: getNextAccountCode(),
      }))
    }
  }, [assets, editingAsset])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")

      const dataToSubmit = { ...formData }
      if (!editingAsset) {
        try {
          const codeResponse = await ApiHandler.getNextAssetCode()
          dataToSubmit.code = codeResponse.nextCode
        } catch (codeError) {
          console.warn("Failed to get next code from server, using client-generated:", codeError)
        }
      }

      if (editingAsset) {
        await ApiHandler.updateAsset(editingAsset._id, dataToSubmit)
        setEditingAsset(null)
      } else {
        await ApiHandler.createAsset(dataToSubmit)
      }

      // Reload assets after successful operation
      await loadAssets()
      setFormData({ code: getNextAccountCode(), name: "", type: "CASH ACCOUNT" })
    } catch (err) {
      setError(err.message)
      console.error("Error saving asset:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (asset) => {
    setEditingAsset(asset)
    setFormData({
      code: asset.code,
      name: asset.name,
      type: asset.type,
    })
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this asset?")) return

    try {
      setLoading(true)
      setError("")
      await ApiHandler.deleteAsset(id)
      await loadAssets()
    } catch (err) {
      setError(err.message)
      console.error("Error deleting asset:", err)
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
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Assets</h2>
        <p className="text-gray-600">Manage your business asset accounts</p>
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
          {editingAsset ? "Edit Asset Account" : "Add Child Account"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Account</label>
              <input
                type="text"
                value="Assets"
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
                required
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
                <option value="CASH ACCOUNT">Cash Account</option>
                <option value="BANK ACCOUNT">Bank Account</option>
                <option value="RECEIVABLES">Receivables</option>
                <option value="Stock">Stock</option>
                {/* <option value="Purchases">Purchases</option> */}
                <option value="General Account">General Account</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Processing..." : editingAsset ? "Update Account" : "Add Account"}
            </button>
            {editingAsset && (
              <button
                type="button"
                onClick={() => {
                  setEditingAsset(null)
                  setFormData({ code: getNextAccountCode(), name: "", type: "CASH ACCOUNT" }) // Updated default type
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
            <div className="px-6 py-8 text-center text-gray-500">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No child accounts found. Add your first account above.
            </div>
          ) : (
            assets.map((asset) => (
              <div key={asset._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="text-sm font-medium text-gray-900">{asset.code}</div>
                  <div className="text-sm text-gray-900">{asset.name}</div>
                  <div className="text-sm text-gray-500">{asset.type}</div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(asset)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded"
                      title="Edit Account"
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(asset._id)}
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
        {assets.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">Total Accounts: {assets.length}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AssetsPage
