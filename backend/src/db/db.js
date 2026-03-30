import mongoose from "mongoose"

async function dbConnect(){
    try {
        const conn = await mongoose.connect(process.env.DB_URI)
        console.log(`DATABASE CONNECTED SUCCESSFULLY`)
    } catch (error) {
        console.error("ERROR CONNECTING DATABASE:", error)
        process.exit(1)
    }
}


export default dbConnect