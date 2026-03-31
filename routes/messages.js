let express = require('express')
let router = express.Router()
let { CheckLogin } = require('../utils/authHandler')
let { uploadImage } = require('../utils/uploadHandler')
let messageModel = require('../schemas/messages')
let mongoose = require('mongoose')

// ============================================================
// GET /:userID
// Lấy toàn bộ message giữa user hiện tại và userID:
//   - from: currentUser, to: userID
//   - from: userID,      to: currentUser
// ============================================================
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUser = req.user._id
        let targetUser = req.params.userID

        // Kiểm tra userID có hợp lệ không
        if (!mongoose.Types.ObjectId.isValid(targetUser)) {
            return res.status(400).send({ message: "userID không hợp lệ" })
        }

        let messages = await messageModel.find({
            $or: [
                { from: currentUser, to: targetUser },
                { from: targetUser, to: currentUser }
            ]
        })
            .sort({ createdAt: 1 })   // sắp xếp theo thời gian tăng dần
            .populate('from', 'username avatarUrl')
            .populate('to', 'username avatarUrl')

        res.send(messages)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

// ============================================================
// POST /
// Gửi message đến userID
//   - Nếu có file đính kèm: type = "file", text = đường dẫn file
//   - Nếu là tin nhắn văn bản: type = "text", text = nội dung
//   Body: { to: userID, text: "nội dung" }  (hoặc kèm file)
// ============================================================
router.post('/', CheckLogin, uploadImage.single('file'), async function (req, res, next) {
    try {
        let currentUser = req.user._id
        let { to, text } = req.body

        if (!to) {
            return res.status(400).send({ message: "Thiếu trường 'to' (userID người nhận)" })
        }

        if (!mongoose.Types.ObjectId.isValid(to)) {
            return res.status(400).send({ message: "userID người nhận không hợp lệ" })
        }

        let messageContent

        if (req.file) {
            // Có file đính kèm
            messageContent = {
                type: "file",
                text: req.file.path   // đường dẫn đến file đã upload
            }
        } else {
            // Tin nhắn văn bản
            if (!text || text.trim() === '') {
                return res.status(400).send({ message: "Nội dung tin nhắn không được để trống" })
            }
            messageContent = {
                type: "text",
                text: text
            }
        }

        let newMessage = new messageModel({
            from: currentUser,
            to: to,
            messageContent: messageContent
        })

        newMessage = await newMessage.save()
        newMessage = await newMessage.populate('from', 'username avatarUrl')
        newMessage = await newMessage.populate('to', 'username avatarUrl')

        res.send(newMessage)
    } catch (error) {
        // Bắt lỗi multer (định dạng file không đúng)
        if (error.message === 'file khong dung dinh dang') {
            return res.status(400).send({ message: "File không đúng định dạng (chỉ hỗ trợ ảnh)" })
        }
        res.status(500).send({ message: error.message })
    }
})

// ============================================================
// GET /
// Lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện mà user
// hiện tại tham gia (gửi hoặc nhận)
// ============================================================
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUser = req.user._id

        // Dùng aggregation để gom nhóm theo "partner" (người còn lại trong cuộc trò chuyện)
        let lastMessages = await messageModel.aggregate([
            // Lọc những message có liên quan đến currentUser
            {
                $match: {
                    $or: [
                        { from: new mongoose.Types.ObjectId(currentUser) },
                        { to: new mongoose.Types.ObjectId(currentUser) }
                    ]
                }
            },
            // Tạo field "partner" = người còn lại (không phải currentUser)
            {
                $addFields: {
                    partner: {
                        $cond: {
                            if: { $eq: ["$from", new mongoose.Types.ObjectId(currentUser)] },
                            then: "$to",
                            else: "$from"
                        }
                    }
                }
            },
            // Sắp xếp theo thời gian mới nhất trước
            { $sort: { createdAt: -1 } },
            // Gom nhóm theo partner, lấy message đầu tiên (tức mới nhất)
            {
                $group: {
                    _id: "$partner",
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            // Bỏ field partner thừa bên trong
            {
                $replaceRoot: { newRoot: "$lastMessage" }
            },
            // Sắp xếp lại theo thời gian mới nhất
            { $sort: { createdAt: -1 } }
        ])

        // Populate from và to
        let result = await messageModel.populate(lastMessages, [
            { path: 'from', select: 'username avatarUrl' },
            { path: 'to', select: 'username avatarUrl' }
        ])

        res.send(result)
    } catch (error) {
        res.status(500).send({ message: error.message })
    }
})

module.exports = router
