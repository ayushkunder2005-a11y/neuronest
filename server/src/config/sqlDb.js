import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(
  process.env.SQL_DB || "neuronest",
  process.env.SQL_USER || "postgres",
  process.env.SQL_PASSWORD || "password",
  {
    host: process.env.SQL_HOST || "localhost",
    port: process.env.SQL_PORT || 5432,
    dialect: "postgres",
    logging: false, // Set to console.log to see SQL queries
  }
);

const connectSQL = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ PostgreSQL connected");
    // Sync all models (create tables if they don't exist)
    await sequelize.sync({ alter: false });
    console.log("✅ Database tables synced");
  } catch (err) {
    console.warn("⚠️ PostgreSQL connection failed:", err.message);
    console.warn("   Continuing with MongoDB only. Set up PostgreSQL when ready.");
    // Don't exit - allow MongoDB to work
  }
};

export { sequelize, connectSQL };
