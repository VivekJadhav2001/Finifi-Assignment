import express from "express"
import dotenv  from "dotenv"
import dbConnect from "./db/db.js"

dotenv.config()

const app = express()
dbConnect()




app.listen(process.env.PORT,()=>console.log(`SERVER RUNNING AT ${process.env.PORT}`))