import express from 'express';
import axios from 'axios';
const router = express.Router();

// simple proxy route to hit AI engine
router.get('/status', async (req,res)=>{
  try{
    const url = process.env.AI_SERVER_URL || 'http://localhost:8000';
    const r = await axios.get(url + '/');
    res.json(r.data);
  }catch(err){
    res.status(502).json({ message: 'AI engine unreachable', error: err.message });
  }
});

export default router;
