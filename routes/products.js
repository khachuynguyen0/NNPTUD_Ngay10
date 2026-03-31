var express = require('express');
var router = express.Router();
let productModel = require('../schemas/products');//dbContext
let inventoryModel = require('../schemas/inventories')
const { default: slugify } = require('slugify');
let mongoose = require('mongoose')

/* GET users listing. */
router.get('/', async function (req, res, next) {
  let queries = req.query;
  let minPrice = queries.minprice ? queries.minprice : 0;
  let maxPrice = queries.maxprice ? queries.maxprice : 10000;
  let titleQ = queries.title ? queries.title : '';
  let result = await productModel.find({
    isDeleted: false,
    title: new RegExp(titleQ, 'i'),
    price: {
      $gte: minPrice,
      $lte: maxPrice
    }
  }).populate({
    path: 'category',
    select: 'name'
  })
  res.send(result);
});

router.get('/:id', async function (req, res, next) {
  try {
    let id = req.params.id;
    let result = await productModel.findOne({
      isDeleted: false,
      _id: id
    })
    if (result) {
      res.send(result);
    } else {
      res.status(404).send({ message: "ID NOT FOUND" });
    }
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
});

router.post('/', async function (req, res, next) {
  let session = await mongoose.startSession();
  session.startTransaction()
  try {
    let newProduct = new productModel({
      title: req.body.title,
      slug: slugify(req.body.title, {
        replacement: '-',
        remove: undefined,
        lower: true,
        strict: false,
      }),
      price: req.body.price,
      description: req.body.description,
      category: req.body.category,
      images: req.body.images
    });
    newProduct = await newProduct.save({ session });
    let newInventory = new inventoryModel({
      product: newProduct._id
    })
    newInventory = await newInventory.save({ session });
    newInventory = await newInventory.populate('product')
    session.commitTransaction();
    session.endSession()
    res.send(newInventory)
  } catch (error) {
    session.abortTransaction();
    session.endSession()
    res.send(error.message)
  }
})
router.put('/:id', async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await productModel.findByIdAndUpdate(id, req.body, {
      new: true
    });
    res.send(updatedItem)
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
});

router.delete('/:id', async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await productModel.findByIdAndUpdate(id, {
      isDeleted: true
    }, {
      new: true
    });
    res.send(updatedItem)
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
});

module.exports = router;
