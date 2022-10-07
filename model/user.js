const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username: String,
    socketid: String,
    roomid: String,
    admin: Boolean,
    score: Number
})

module.exports = mongoose.model("user", userSchema)