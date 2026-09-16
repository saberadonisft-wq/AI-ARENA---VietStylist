import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "viet_phuc_remix.db"))
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Get saberadonisft ID
c.execute("SELECT id FROM accounts WHERE email = 'saberadonisft@gmail.com'")
row = c.fetchone()
if not row:
    print("Error: saberadonisft@gmail.com not found!")
    exit(1)
target_id = row[0]

# Reassign all outfits, lookbooks, media_assets to target_id
c.execute("UPDATE outfits SET owner_id = ?", (target_id,))
c.execute("UPDATE lookbooks SET owner_id = ?", (target_id,))
c.execute("UPDATE media_assets SET owner_id = ?", (target_id,))

# Ensure target_id has all 4 roles
c.execute("DELETE FROM user_roles WHERE user_id = ?", (target_id,))
for r in ['admin', 'stylist', 'editor', 'user']:
    c.execute("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", (f"ur_{target_id}_{r}", target_id, r))

# Delete everything else
c.execute("DELETE FROM user_roles WHERE user_id != ?", (target_id,))
c.execute("DELETE FROM profiles WHERE user_id != ?", (target_id,))
c.execute("DELETE FROM accounts WHERE id != ?", (target_id,))

conn.commit()

# Verify
c.execute("SELECT id, email, display_name FROM accounts")
accs = c.fetchall()
c.execute("SELECT user_id, role FROM user_roles")
roles = c.fetchall()

print(f"SUCCESS: Remaining accounts: {len(accs)}")
for a in accs:
    print(f" - ID: {a[0]}, Email: {a[1]}, Name: {a[2]}")
print(f"SUCCESS: Roles for target admin: {len(roles)}")
for r in roles:
    print(f" - Role: {r[1]}")

conn.close()

