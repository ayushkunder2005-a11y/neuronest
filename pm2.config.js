module.exports = {
  apps: [
    { name:"neuronest-backend", script:"server/src/server.js", watch:true },
    { name:"neuronest-ai", script:"ai_engine/api/ai_server.py", interpreter:"python3", watch:true }
  ]
};
