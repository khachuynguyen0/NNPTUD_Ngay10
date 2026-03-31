var express = require('express');
var router = express.Router();
let categoryModel = require('../schemas/categories');//dbContext
const { default: slugify } = require('slugify');

/* GET users listing. */
router.get('/', async function (req, res, next) {
  let result = await categoryModel.find({
    isDeleted: false
  })
  res.send(result);
});

router.get('/:id', async function (req, res, next) {
  try {
    let id = req.params.id;
    let result = await categoryModel.findOne({
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
  let newCate = new categoryModel({
    name: req.body.name,
    slug: slugify(req.body.name, {
      replacement: '-',
      remove: undefined,
      lower: true,
      strict: false,
    })
  });
  await newCate.save();
  res.send(newCate)
})
router.put('/:id', async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await categoryModel.findByIdAndUpdate(id, req.body, {
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
    let updatedItem = await categoryModel.findByIdAndUpdate(id, {
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
