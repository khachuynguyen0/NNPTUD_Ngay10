let mongoose = require('mongoose');
let productSchema = new mongoose.Schema({
    sku: {
        type: String,
        unique: [true, "sku khong duoc trung"],
        required: [true, "sku khong duoc rong"]
    },
    title: {
        type: String,
        unique: [true, "title khong duoc trung"],
        required: [true, "title khong duoc rong"]
    },
    slug: {
        type: String,
        unique: [true, "slug khong duoc trung"],
        required: [true, "slug khong duoc rong"]
    },
    price: {
        type: Number,
        default: 0,
        min: [0, "gia khong duoc nho hon 0"],
    },
    description: {
        type: String,
        default: ""
    },
    images: {
        type: [String],
        default: ["https://i.imgur.com/ZANVnHE.jpeg"]
    },
    category: {
        type: mongoose.Types.ObjectId,
        ref: 'category',
        required: true
    }
    ,
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

//hook
productSchema.pre('save', async function () {
    //this.slug = this.slug + "-1"
    let Product = this.constructor;
    let products = await Product.find({
        slug: new RegExp(this.slug, 'i')
    });
    if (products.length > 0) {
        this.slug = this.slug + "-" + products.length
    }
})
module.exports = new mongoose.model(
    'product', productSchema
)
