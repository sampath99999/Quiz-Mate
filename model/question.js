const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema({
    roomCode: String,
    answer: Number,
    answered: {
        type: Number,
        default: 0
    }
})

module.exports = mongoose.model('question', questionSchema)