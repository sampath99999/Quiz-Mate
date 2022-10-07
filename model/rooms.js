const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema({
    roomCode: String,
    playing: Boolean,
    questions: {
        type: Number,
        default: 0,
    }
})

module.exports = mongoose.model('room', roomSchema)