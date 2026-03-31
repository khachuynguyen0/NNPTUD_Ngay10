var express = require("express");
var router = express.Router();
let userController = require('../controllers/users')
let { RegisterValidator, validatedResult, ChangePasswordValidator } = require('../utils/validator')
let { CheckLogin } = require('../utils/authHandler')
let crypto = require('crypto')
let { sendMail } = require('../utils/sendMail')
let cartModel = require('../schemas/carts')
let mongoose = require('mongoose')
//login
router.post('/login', async function (req, res, next) {
    let { username, password } = req.body;
    let result = await userController.QueryLogin(username, password);
    if (!result) {
        res.status(404).send("thong tin dang nhap khong dung")
    } else {
        res.cookie("TOKEN_NNPTUD_C3", result, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: false
        })
        res.send(result)
    }
})
router.post('/register', RegisterValidator, validatedResult, async function (req, res, next) {
    try {
        let { username, password, email } = req.body;
        let newUser = await userController.CreateAnUser(
            username, password, email, '69b6231b3de61addb401ea26', null
        )
        let newCart = new cartModel({
            user: newUser._id
        })
        newCart = await newCart.save()
        newCart = await newCart.populate('user')
        res.send(newCart)
    } catch (error) {
        res.status(404).send(error.message)
    }
})
router.get('/me', CheckLogin, function (req, res, next) {
    res.send(req.user)
})
router.post('/changepassword', CheckLogin, ChangePasswordValidator, validatedResult, async function (req, res, next) {
    let { oldpassword, newpassword } = req.body;
    let user = req.user;
    let result = await userController.ChangePassword(user, oldpassword, newpassword);
    if (!result) {
        res.status(404).send("thong tin dang nhap khong dung")
    } else {
        res.send("doi thanh cong")
    }

})
router.post('/logout', CheckLogin, async function (req, res, next) {
    res.cookie("TOKEN_NNPTUD_C3", null, {
        maxAge: 0
    })
    res.send("logout")
})
router.post("/forgotpassword", async function (req, res, next) {
    let { email } = req.body;
    let user = await userController.GetUserByEmail(email);
    if (user) {
        user.forgotPasswordToken = crypto.randomBytes(32).toString('hex');
        user.forgotPasswordTokenExp = Date.now() + 1000 * 60 * 10;
        await user.save();
        let url = "http://localhost:3000/api/v1//auth/resetpassword/" + user.forgotPasswordToken;
        await sendMail(user.email, url);
    }
    res.send("kiem tra mail")
})
router.post('/resetpassword/:token', async function (req, res, next) {
    let { password } = req.body;
    let user = await userController.GetUserByToken(req.params.token);
    if (user) {
        user.password = password;
        user.forgotPasswordToken = null;
        user.forgotPasswordTokenExp = null;
        await user.save()
    }
    res.send("thanh cong")
})

//forgotpassword
//permission
module.exports = router;
