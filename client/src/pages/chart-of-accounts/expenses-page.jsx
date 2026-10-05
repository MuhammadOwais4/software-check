"use client"
import { useState, useEffect } from "react"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

function ExpensesPage({ onBack }) {
  const [expenses, setExpenses] = useState([])
  const [editingExpense, setEditingExpense] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "EXPENSE ACCOUNT",
  })

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await ApiHandler.getChartExpenses()
      console.log("Full API Response:", response)
      
      // Handle different response structures
      let expenseData = []
      if (response.data?.data) {
        expenseData = response.data.data
      } else if (response.data) {
        expenseData = response.data
      } else if (Array.isArray(response)) {
        expenseData = response
      }
      
      console.log("Parsed expenses:", expenseData)
      setExpenses(expenseData)
    } catch (err) {
      setError(err.message)
      console.error("Error loading expenses:", err)
    } finally {
      setLoading(false)
    }
  }

  // Get next account code
  const deriveNextCodeFromLocal = () => {
    if (expenses.length === 0) return "5001"
    const codes = expenses
      .map((e) => parseInt(e.code, 10))
      .filter((c) => !isNaN(c))
    if (codes.length === 0) return "5001"
    const maxCode = Math.max(...codes)
    return (maxCode + 1).toString()
  }

  const fetchNextCodeThatFallsBack = async () => {
    try {
      const res = await ApiHandler.getNextChartExpenseCode()
      console.log("Next code API response:", res)
      
      // Handle different response structures
      if (res?.data?.nextCode) {
        return String(res.data.nextCode)
      }
      if (res?.nextCode) {
        return String(res.nextCode)
      }
    } catch (e) {
      console.log("Next-code API failed, falling back:", e?.message)
    }
    return deriveNextCodeFromLocal()
  }

  // When not editing, auto-generate code
  useEffect(() => {
    let isMounted = true
    const run = async () => {
      if (!editingExpense) {
        const code = await fetchNextCodeThatFallsBack()
        if (isMounted) {
          setFormData((prev) => ({ ...prev, code }))
        }
      }
    }
    run()
    return () => {
      isMounted = false
    }
  }, [expenses, editingExpense])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate
    if (!formData.name.trim()) {
      setError("Account name is required")
      return
    }

    try {
      setLoading(true)
      setError("")

      console.log("Submitting:", formData)

      if (editingExpense) {
        const response = await ApiHandler.updateChartExpense(editingExpense._id, formData)
        console.log("Update response:", response)
        setEditingExpense(null)
      } else {
        const response = await ApiHandler.createChartExpense(formData)
        console.log("Create response:", response)
      }

      // Reload expenses after successful operation
      await loadExpenses()
      
      // Reset form with next code
      const next = await fetchNextCodeThatFallsBack()
      setFormData({ code: next, name: "", type: "EXPENSE ACCOUNT" })
    } catch (err) {
      setError(err.message)
      console.error("Error saving expense:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
    setFormData({
      code: expense.code,
      name: expense.name,
      type: expense.type,
    })
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this expense account?")) return

    try {
      setLoading(true)
      setError("")
      await ApiHandler.deleteChartExpense(id)
      await loadExpenses()
      
      // Reset form with next code after deletion
      const next = await fetchNextCodeThatFallsBack()
      setFormData({ code: next, name: "", type: "EXPENSE ACCOUNT" })
    } catch (err) {
      setError(err.message)
      console.error("Error deleting expense:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setEditingExpense(null)
    const next = await fetchNextCodeThatFallsBack()
    setFormData({ code: next, name: "", type: "EXPENSE ACCOUNT" })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Chart of Accounts
          </button>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Expenses</h2>
        <p className="text-gray-600">Manage your business expense accounts</p>
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
          {editingExpense ? "Edit Expense Account" : "Add Child Account"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Parent Account</label>
              <input
                type="text"
                value="Expenses"
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Child Account *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Code *</label>
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
                <option value="EXPENSE ACCOUNT">Expense Account</option>
                <option value="Purchases">Purchases</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Processing..." : editingExpense ? "Update Account" : "Add Account"}
            </button>
            {editingExpense && (
              <button
                type="button"
                onClick={handleCancel}
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
            <div className="px-6 py-8 text-center text-gray-500">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No child accounts found. Add your first account above.
            </div>
          ) : (
            expenses.map((expense) => (
              <div key={expense._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div className="text-sm font-medium text-gray-900">{expense.code}</div>
                  <div className="text-sm text-gray-900">{expense.name}</div>
                  <div className="text-sm text-gray-500">{expense.type}</div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded"
                      title="Edit Account"
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense._id)}
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
        {expenses.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">Total Accounts: {expenses.length}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExpensesPage