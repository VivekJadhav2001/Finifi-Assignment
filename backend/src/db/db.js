import mongoose from "mongoose"

async function dbConnect(){
    try {
        const conn = await mongoose.connect(process.env.DB_URI)
        console.log(`MongoDB Connected: ${conn.connection.host}`)
    } catch (error) {
        console.error("ERROR CONNECTING DATABASE:", error)
        process.exit(1)
    }
}


export default dbConnect