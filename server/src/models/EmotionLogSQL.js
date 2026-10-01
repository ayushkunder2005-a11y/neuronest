import { DataTypes } from "sequelize";
import { sequelize } from "../config/sqlDb.js";

const EmotionLogSQL = sequelize.define(
  "EmotionLogSQL",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    emotion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "emotion_logs",
    timestamps: false,
  }
);

export default EmotionLogSQL;
