# Multi-shop setup

1. Copy these files over your project (same paths). `cd server && npm i` (no new packages needed).
2. ONE-TIME migration (puts all your current data into the FIRST shop and fixes unique indexes):
   cd server
   node scripts/migrate-shops.js "Shop A" "Shop B"
3. Deploy server + client.
4. Login as admin -> "Users & Shops" tab -> create users (test -> Shop A, demo -> Shop B), each with own password.
5. Top bar: admin picks "Shop A / Shop B / All Shops". Shop users are locked to their own shop.

Rules
- admin/developer: can switch shops. "All Shops" = read-only combined view (saving needs a shop selected).
- user: sees only own shop's data, can't change it.
- Passwords: each user has own; "Change Password" button (own) / admin can reset anyone in Users & Shops.
- Every /api route now needs login (token). Signup is admin-only.

Journal Voucher
- New table layout (AccountCode, Account, Bill Reference, Debit, Credit, Cheque No, Cheque Date, Remarks).
- Total Debit must equal Total Credit: Save/Print stay disabled until equal; the server also rejects unbalanced JVs.
- "Add More" pre-fills the remaining difference on the opposite side.
- Print = compact A5 landscape.
