const express = require('express')
const router = express.Router();
const adminAuth = require('../middleware/adminAuthMiddleware');
const crypto = require('crypto');


router.post('/login',(req,res)=>{
  const {password} = req.body;

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

 
})