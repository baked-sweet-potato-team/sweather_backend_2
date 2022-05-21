const express = require('express')
const app = express()
const port = 5000
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const cookieParser = require('cookie-parser');
const config = require('./config/key');
const {auth} = require('./middleware/auth');
const {User} = require("./models/User");


//application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: true}));
//application/json
app.use(bodyParser.json());
app.use(cookieParser());

const mongoose = require('mongoose');
const req = require('express/lib/request');
const res = require('express/lib/response');
mongoose.connect(config.mongoURI)
    .then(()=>console.log('MongoDB Connected...'))
    .catch(err => console.log(err))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post('/api/users/register', (req, res) => {
    //회원 가입 할때 필요한 정보들을 client에서 가져오면 그것들을 데베에 넣어준다.
    const user = new User(req.body)

    user.save((err,userInfo) => {
        if(err) return res.json({success: false, err})
        return res.status(200).json({
            success: true
        })
    })
})

app.post('/api/users/login', (req,res) => {
  //요청된 이메일을 디비에 있는지 찾는다.
  User.findOne({email: req.body.email}, (err, user) => {
    if(!user) {
      return res.json({
        loginSuccess: false,
        message: "제공된 이메일에 해당하는 유저가 없습니다."
      })
    }
    //요청된 이메일이 디비에 있다면 비밀번호 맞는지 확인
    user.comparePassword(req.body.password, (err, isMatch) => {
      if(!isMatch)
        return res.json({ loginSuccess: false, message: "비밀번호가 틀렸습니다."})
      
      //비밀번호 맞다면 토큰 생성하기
      user.generateToken((err,user) => {
        if(err) return res.status(400).send(err);

        //토큰을 저장한다. 어디에? 쿠키, 로컬스토리지
        res.cookie("x_auth", user.token)
        .status(200)
        .json({loginSuccess: true, userId: user._id})

      })
    })
  })
})

app.get('/api/users/auth',auth, (req,res) => {
  //여기까지 미들웨어를 통과해 왔다는 얘기는 Authentication이 true라는 말
  res.status(200).json({
    _id: req.user._id,
    isAdmin: req.user.role === 0 ?false : true,
    isAuth: true,
    email: req.user.email,
    name: req.user.name,
    age: req.user.age,
    gender: req.user.gender,
    style: req.user.style,
    color: req.user.color,
    role: req.user.role,
    image: req.user.image

  })
}) 

app.get('/api/users/logout', auth, (req,res)=> {
  User.findOneAndUpdate({_id: req.user._id}, 
    {token: ""},
    (err, user) => {
      if(err) return res.json({success: false, err})
      return res.status(200).send({
        success: true
      })
    })
})

app.post('/api/users/update', auth, (req,res) => {
  var body = req.body;
  var name = body.name;
  var age = body.age;
  var style = body.style;
  var color = body.color;

  User.findOneAndUpdate({_id: req.user._id}, 
    {
      $set: {
          name: name,
          age: age,
          style: style,
          color: color
      }
    }, (err, user) => {
      if(err) return res.status(400).send(err)
      return res.status(200).send({
        update: true
      })
    })
})

app.post('/api/users/changepw', auth, (req,res) => {
  var password = req.body.password;
  bcrypt.genSalt(saltRounds, function (err, salt) {
    if (err) return req.json(err) 
    else {
      bcrypt.hash(password, salt, function(err, hash) {
        if (err) return req.json(err)
        else {
          console.log(hash)
          //$2a$10$FEBywZh8u9M0Cec/0mWep.1kXrwKeiWDba6tdKvDfEBjyePJnDT7K
          User.findOneAndUpdate({_id: req.user._id}, {password: hash},(err,user) => {
            if(err) return res.status(400).send(err)
            return res.status(200).send({
              change_password: true
            })
          })
        }
      })
    }
  })
})

app.post('/api/users/delete', auth, (req,res) => {
  User.findOneAndDelete({_id: req.user._id},
    (err, user) => {
      if(err) return res.json({delete: false, err})
      return res.json({delete: true})
    })
})


app.get('/api/users/find', auth, (req,res) => {
  User.find({_id: req.user._id}, {"_id": 0, "name": 1, 
  "age": 1, "style": 1, "color": 1}, (err, user) => {
    if(err) return res.status(400).send({message: "정보 찾기 실패"})
    return res.json(user)
  })
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})