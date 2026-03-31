let express = require('express')
let router = express.Router()
let inventoryModel = require('../schemas/inventories')
let { CheckLogin, checkRole } = require('../utils/authHandler')

// GET / - Lấy toàn bộ danh sách tồn kho
router.get('/', async function (req, res, next) {
    try {
        let inventories = await inventoryModel.find().populate('product')
        res.send(inventories)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

// GET /:id - Lấy tồn kho theo ID
router.get('/:id', async function (req, res, next) {
    try {
        let inventory = await inventoryModel.findById(req.params.id).populate('product')
        if (!inventory) {
            return res.status(404).send({ message: "ID NOT FOUND" })
        }
        res.send(inventory)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

// PUT /:id - Cập nhật tồn kho (chỉ ADMIN)
router.put('/:id', CheckLogin, checkRole("ADMIN"), async function (req, res, next) {
    try {
        let { stock, soldCount } = req.body
        let update = {}
        if (stock !== undefined) update.stock = stock
        if (soldCount !== undefined) update.soldCount = soldCount

        let updated = await inventoryModel.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        ).populate('product')

        if (!updated) {
            return res.status(404).send({ message: "ID NOT FOUND" })
        }
        res.send(updated)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

module.exports = router
