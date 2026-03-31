var express = require("express");
var router = express.Router();
let reservationModel = require('../schemas/reservation')
let cartModel = require('../schemas/carts')
let inventoryModel = require('../schemas/inventories')
let productModel = require('../schemas/products')
let { CheckLogin } = require('../utils/authHandler')
let mongoose = require('mongoose')

// GET / - Lấy toàn bộ reservation của user hiện tại
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let reservations = await reservationModel.find({
            user: req.user._id
        }).populate('items.product')
        res.send(reservations)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

// GET /:id - Lấy reservation theo ID
router.get('/:id', CheckLogin, async function (req, res, next) {
    try {
        let reservation = await reservationModel.findOne({
            _id: req.params.id,
            user: req.user._id
        }).populate('items.product')
        if (!reservation) {
            return res.status(404).send({ message: "Reservation không tồn tại" })
        }
        res.send(reservation)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

// POST / - Tạo reservation từ cart (Transaction: cart + inventory + reservation)
router.post('/', CheckLogin, async function (req, res, next) {
    let session = await mongoose.startSession()
    session.startTransaction()
    try {
        let user = req.user
        // Lấy cart của user
        let cart = await cartModel.findOne({ user: user._id }).session(session)
        if (!cart || cart.items.length === 0) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).send({ message: "Giỏ hàng trống" })
        }

        let reservationItems = []
        let totalAmount = 0

        // Kiểm tra tồn kho và xây dựng danh sách items
        for (const cartItem of cart.items) {
            let inventory = await inventoryModel.findOne({
                product: cartItem.product
            }).session(session)

            if (!inventory) {
                await session.abortTransaction()
                session.endSession()
                return res.status(404).send({ message: "Sản phẩm không tồn tại trong kho" })
            }

            let availableStock = inventory.stock - inventory.reserved
            if (availableStock < cartItem.quantity) {
                await session.abortTransaction()
                session.endSession()
                return res.status(400).send({ message: "Sản phẩm không đủ hàng" })
            }

            // Tăng số lượng reserved trong inventory
            inventory.reserved += cartItem.quantity
            await inventory.save({ session })

            // Lấy thông tin sản phẩm để lưu vào reservation
            let product = await productModel.findById(cartItem.product).session(session)
            let subtotal = product.price * cartItem.quantity
            totalAmount += subtotal

            reservationItems.push({
                product: cartItem.product,
                title: product.title,
                quantity: cartItem.quantity,
                price: product.price,
                subtotal: subtotal
            })
        }

        // Tạo reservation
        let expiredIn = new Date(Date.now() + 15 * 60 * 1000) // hết hạn sau 15 phút
        let newReservation = new reservationModel({
            user: user._id,
            items: reservationItems,
            status: "actived",
            expiredIn: expiredIn,
            amount: totalAmount
        })
        newReservation = await newReservation.save({ session })

        // Xóa cart sau khi tạo reservation
        cart.items = []
        await cart.save({ session })

        await session.commitTransaction()
        session.endSession()

        newReservation = await reservationModel
            .findById(newReservation._id)
            .populate('items.product')

        res.send(newReservation)
    } catch (error) {
        await session.abortTransaction()
        session.endSession()
        res.status(500).send({ message: error.message })
    }
})

// PATCH /:id/cancel - Hủy reservation (hoàn lại tồn kho)
router.patch('/:id/cancel', CheckLogin, async function (req, res, next) {
    let session = await mongoose.startSession()
    session.startTransaction()
    try {
        let reservation = await reservationModel.findOne({
            _id: req.params.id,
            user: req.user._id
        }).session(session)

        if (!reservation) {
            await session.abortTransaction()
            session.endSession()
            return res.status(404).send({ message: "Reservation không tồn tại" })
        }

        if (reservation.status !== "actived") {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).send({ message: "Chỉ có thể hủy reservation đang actived" })
        }

        // Hoàn lại reserved trong inventory
        for (const item of reservation.items) {
            await inventoryModel.findOneAndUpdate(
                { product: item.product },
                { $inc: { reserved: -item.quantity } },
                { session }
            )
        }

        reservation.status = "cancelled"
        await reservation.save({ session })

        await session.commitTransaction()
        session.endSession()

        reservation = await reservationModel
            .findById(reservation._id)
            .populate('items.product')

        res.send(reservation)
    } catch (error) {
        await session.abortTransaction()
        session.endSession()
        res.status(500).send({ message: error.message })
    }
})

// PATCH /:id/pay - Thanh toán reservation (giảm stock, giảm reserved, tăng soldCount)
router.patch('/:id/pay', CheckLogin, async function (req, res, next) {
    let session = await mongoose.startSession()
    session.startTransaction()
    try {
        let reservation = await reservationModel.findOne({
            _id: req.params.id,
            user: req.user._id
        }).session(session)

        if (!reservation) {
            await session.abortTransaction()
            session.endSession()
            return res.status(404).send({ message: "Reservation không tồn tại" })
        }

        if (reservation.status !== "actived") {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).send({ message: "Chỉ có thể thanh toán reservation đang actived" })
        }

        if (reservation.expiredIn < new Date()) {
            await session.abortTransaction()
            session.endSession()
            return res.status(400).send({ message: "Reservation đã hết hạn" })
        }

        // Cập nhật inventory: giảm stock, giảm reserved, tăng soldCount
        for (const item of reservation.items) {
            await inventoryModel.findOneAndUpdate(
                { product: item.product },
                {
                    $inc: {
                        stock: -item.quantity,
                        reserved: -item.quantity,
                        soldCount: item.quantity
                    }
                },
                { session }
            )
        }

        reservation.status = "paid"
        await reservation.save({ session })

        await session.commitTransaction()
        session.endSession()

        reservation = await reservationModel
            .findById(reservation._id)
            .populate('items.product')

        res.send(reservation)
    } catch (error) {
        await session.abortTransaction()
        session.endSession()
        res.status(500).send({ message: error.message })
    }
})

module.exports = router;
