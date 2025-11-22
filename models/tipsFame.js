const mongoose = require('mongoose')
const Schema = mongoose.Schema

const tipsFameSchema = new Schema({
    time: {
        type: String,
    },
    siku: {
        type: String
    },
    league: {
        type: String
    },
    match: {
        type: String
    },
    league: {
        type: String
    },
    tip: {
        type: String,
    },
    nano: {
        type: String,
    },
    matokeo: {
        type: String,
        default: '-:-'
    },
    status: {
        type: String,
        default: 'pending'
    }, 
    UTC3: {
        type: Number
    }
}, {strict: false, timestamps: true })

const ya_uhakika = mongoose.connection.useDb('mikeka-ya-uhakika')
let tipsFameModel = ya_uhakika.model('fametips', tipsFameSchema)
module.exports = tipsFameModel