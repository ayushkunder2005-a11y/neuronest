import express from "express";
import http from "http";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🧠 NeuroNest API Running");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is alive" });
});

const PORT = 5000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
});
