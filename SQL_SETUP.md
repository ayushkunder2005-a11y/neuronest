# SQL Setup Guide for NeuroNest

## ✅ What's Been Set Up

Your project now supports **both MongoDB and PostgreSQL**:

### Files Created/Modified:
1. **`src/config/sqlDb.js`** - PostgreSQL connection module
2. **`src/models/UserSQL.js`** - Example SQL User model
3. **`src/models/EmotionLogSQL.js`** - Example SQL EmotionLog model
4. **`src/server.js`** - Updated to initialize both connections
5. **`.env`** - Added PostgreSQL configuration variables

---

## 🔧 Prerequisites

### Install PostgreSQL
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- **Mac**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql`

### Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE neuronest;

# Exit
\q
```

---

## 📝 Environment Variables (.env)

Update your `.env` file with your PostgreSQL credentials:

```properties
# PostgreSQL Configuration
SQL_HOST=localhost
SQL_PORT=5432
SQL_USER=postgres
SQL_PASSWORD=your_password_here
SQL_DB=neuronest
```

---

## 📦 Using SQL Models

### Example: Create a User

```javascript
import UserSQL from "./models/UserSQL.js";

// Create
const user = await UserSQL.create({
  name: "John Doe",
  email: "john@example.com",
  password: "hashedPassword",
});

// Read
const user = await UserSQL.findByPk(1);

// Update
await user.update({ name: "Jane Doe" });

// Delete
await user.destroy();
```

### Example: Log Emotion

```javascript
import EmotionLogSQL from "./models/EmotionLogSQL.js";

const log = await EmotionLogSQL.create({
  userId: 1,
  emotion: "happy",
  confidence: 0.95,
});

// Get all emotions for a user
const emotions = await EmotionLogSQL.findAll({
  where: { userId: 1 },
});
```

---

## 🚀 Running Your Server

```bash
cd server
npm run dev
```

You should see:
```
✅ MongoDB connected
✅ PostgreSQL connected
✅ Database tables synced
🚀 Server+WS @5000
```

---

## 📚 Sequelize Queries

```javascript
// Find
const user = await UserSQL.findOne({ where: { email: "john@example.com" } });

// Count
const count = await UserSQL.count();

// Filter
const emotions = await EmotionLogSQL.findAll({
  where: { emotion: "happy" },
  limit: 10,
});

// Raw SQL
const results = await sequelize.query("SELECT * FROM users");
```

---

## ⚠️ Notes

- Both **MongoDB** and **PostgreSQL** will run in parallel
- Use **MongoDB models** for existing code (User.js, EmotionLog.js)
- Use **SQL models** for new features (UserSQL.js, EmotionLogSQL.js)
- You can migrate data between them as needed

---

## 🐛 Troubleshooting

**Connection refused?**
- Ensure PostgreSQL service is running
- Check credentials in `.env`
- Verify database exists

**Table sync issues?**
- Delete and recreate the database
- Check model definitions

Need help? Ask! 🚀
