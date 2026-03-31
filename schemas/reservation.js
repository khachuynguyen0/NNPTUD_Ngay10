let mongoose = require('mongoose')
let reservationItemSchema = mongoose.Schema({
    product: {
        type: mongoose.Types.ObjectId,
        ref: 'product'
    },
    title: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        min: 1
    },
    price: {
        type: Number,
        min: 0
    },
    subtotal: {
        type: Number,
        min: 0
    }
})
let reservationSchema = mongoose.Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        required: true
    },
    items: {
        type: [reservationItemSchema],
        default: []
    },
    status: {
        type: String,
        enum: ["actived", "cancelled", "expired", "paid"],
        default: "actived"
    },
    expiredIn: Date,
    amount: {
        type: Number,
        min: 0
    }
}, {
    timestamps: true
})
module.exports = mongoose.model('reservation', reservationSchema)
