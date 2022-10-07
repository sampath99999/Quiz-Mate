const express = require('express')
const router = express.Router()

router.get('/', (req, res) => {
    res.render("index")   
})

router.get('/createRoom', (req, res) => {
    res.render("createRoom")   
})

router.get('/room', (req, res) => {
    res.render("room")   
})

router.get('/joinRoom', (req, res) => {
    res.render("joinRoom")   
})

router.get('/join', (req, res) => {
    res.render("join")   
})
module.exports = router