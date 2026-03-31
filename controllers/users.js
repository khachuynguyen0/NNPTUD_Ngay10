let userModel = require("../schemas/users");
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let fs = require('fs')

module.exports = {
    CreateAnUser: async function (username, password, email, role, session, fullName, avatarUrl, status, loginCount) {
        let newItem = new userModel({
            username: username,
            password: password,
            email: email,
            fullName: fullName,
            avatarUrl: avatarUrl,
            status: status,
            role: role,
            loginCount: loginCount
        });
        await newItem.save({ session });
        return newItem;
    },
    GetAllUser: async function () {
        return await userModel
            .find({ isDeleted: false })
    },
    GetUserById: async function (id) {
        try {
            return await userModel
                .findOne({
                    isDeleted: false,
                    _id: id
                }).populate('role')
        } catch (error) {
            return false;
        }
    },
    GetUserByEmail: async function (email) {
        try {
            return await userModel
                .findOne({
                    isDeleted: false,
                    email: email
                })
        } catch (error) {
            return false;
        }
    },
    GetUserByToken: async function (token) {
        try {
            let user = await userModel
                .findOne({
                    isDeleted: false,
                    forgotPasswordToken: token
                })
            if (user.forgotPasswordTokenExp > Date.now()) {
                return user;
            }
            return false;
        } catch (error) {
            return false;
        }
    },
    QueryLogin: async function (username, password) {
        if (!username || !password) {
            return false;
        }
        let user = await userModel.findOne({
            username: username,
            isDeleted: false
        })
        if (user) {
            if (user.lockTime && user.lockTime > Date.now()) {
                return false;
            } else {
                if (bcrypt.compareSync(password, user.password)) {
                    user.loginCount = 0;
                    await user.save();
                    let token = jwt.sign({
                        id: user.id
                    }, 'secret', {
                        expiresIn: '1d'
                    })
                    return token;
                } else {
                    //sai pass
                    user.loginCount++;
                    if (user.loginCount == 3) {
                        user.loginCount = 0;
                        user.lockTime = Date.now() + 3_600_000;
                    }
                    await user.save();
                    return false;
                }
            }
        } else {
            return false;
        }
    },
    ChangePassword: async function (user, oldPassword, newPassword) {
        if (bcrypt.compareSync(oldPassword, user.password)) {
            user.password = newPassword;
            await user.save();
            return true;
        } else {
            return false;
        }
    }
}
