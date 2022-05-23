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


//메인페이지
app.get('/', auth, (req, res) => {
  User.findOne({_id: req.user._id}, (err, user) => {
    console.log(user.token)
    return res.json({isAuth: true, userid: user._id})
  })
})


// 마이페이지: 회원 조회
app.get('/api/my', auth, (req,res) => {
  User.find({_id: req.user._id}, {"_id": 0, "nickname": 1, "gender": 1,
  "age": 1, "style": 1, "color": 1}, (err, user) => {
    if(err) return res.status(400).send({message: "정보 찾기 실패"})
    return res.json(user)
  })
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
    name: req.user.nickname,
    age: req.user.age,
    gender: req.user.gender,
    style: req.user.style,
    color: req.user.color,
    role: req.user.role,
    image: req.user.image

  })
}) 

// 로그아웃
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

// 수정
app.post('/api/users/update', auth, (req,res) => {
  var body = req.body;
  var name = body.nickname;
  var age = body.age;
  var style = body.style;
  var color = body.color;

  User.findOneAndUpdate({_id: req.user._id}, 
    {
      $set: {
          nickname: name,
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

// 비번 변경
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

// 회원 탈퇴
app.get('/api/users/delete', auth, (req,res) => {
  User.findOneAndDelete({_id: req.user._id},
    (err, user) => {
      if(err) return res.json({delete: false, err})
      return res.json({delete: true})
    })
})


//메인페이지 날씨 옷
app.post('/api/main/weather', auth, (req, res) => {
  User.findOne({_id: req.user._id}, (err, user) => {
    if (err) return res.status(400).send({message: "없는 아이디"})
    var gender = req.user.gender;
    var style = req.user.style;
    var weather = req.body.weather;
    var image = "image 경로";
    console.log(req.body);

    //성별
    if(gender == "여") {
      //계절
      if(weather <= 8) { //겨울
          //스타일
          if(style == "casual") {image = "asdf";}
          else if(style == "basic") {image = "image path";}
          else if(style == "lovely") {image = "image path";}
          else if(style == "office") {image = "image path";}
          else{return res.status(400).send("error : style not match");}
      }
      else if( 9<=weather && weather < 16) { //가을 
          if(style == "casual") {image = "image path";}
          else if(style == "basic") {image = "image path";}
          else if(style == "lovely") {image = "image path";}
          else if(style == "office") {image = "image path";}
          else{return res.status(400).send("error : style not match");}
      }
      else if(23<=weather) { //여름
          if(style == "casual") {image = "image path";}
          else if(style == "basic") {image = "image path";}
          else if(style == "lovely") {image = "image path";}
          else if(style == "office") {image = "image path";}
          else{return res.status(400).send("error : style not match");}
      }
      else if( 16<=weather && weather <23) { //봄
          if(style == "casual") {image = "image path";}
          else if(style == "basic") {image = "image path";}
          else if(style == "lovely") {image = "image path";}
          else if(style == "office") {image = "image path";}
          else{return res.status(400).send("error : style not match");}
      }
      return res.status(200).send({image});
    }
    else if(gender =="남") {
      if(weather <= 8) { //겨울
          //스타일
          if(style == "casual") {image = "image path";}
          else if(style == "basic") {image = "image path";}
          else if(style == "lovely") {image = "image path";}
          else if(style == "office") {image = "image path";}
          else{return res.status(400).send("error : style not match");}
      }
      else if( 9<=weather && weather < 16) { //가을 
          if(style == "casual") {image = "image path";}
          else if(style == "basic") {image = "image path";}
          else if(style == "lovely") {image = "image path";}
          else if(style == "office") {image = "image path";}
          else{return res.status(400).send("error : style not match");}
      }
      else if(23<=weather) { //여름
          if(style == "casual") {image = "image path";}
          else if(style == "basic") {image = "image path";}
          else if(style == "lovely") {image = "image path";}
          else if(style == "office") {image = "image path";}
          else{return res.status(400).send("error : style not match");}
      }
      else if( 16<=weather && weather <23) { //봄
          if(style == "casual") {image = "남자 봄 캐주얼";}
          else if(style == "basic") {image = "남자 봄 베이직";}
          else if(style == "lovely") {image = "남자 봄 러블리";}
          else if(style == "office") {image = "남자 봄 오피스";}
          else{return res.status(400).send("error : style not match");}
      }
      return res.status(200).send({image});
    }
    else {
      return res.status(400).send("error : gender not match");
    }
  })
})

//메인페이지 퍼스널컬러 옷
app.get('/api/main/personal', auth, (req,res) => {
  User.findOne({_id:req.user._id}, (err, user) => {
    if(err) return res.status(400).send({personal: "회원정보 오류"})
    var color = req.user.color;
    var image = "퍼스널진단표 경로";

    if(color == "봄 웜 라이트") {image = "봄라이트 경로"}
    else if(color == "봄 웜 브라이트") {image = "봄브라이트 경로"}
    else if(color == "여름 쿨 라이트") {image = "여름라이트 경로"}
    else if(color == "여름 쿨 뮤트") {image = "여름뮤트 경로"}
    else if(color == "가을 웜 뮤트") {image = "가을뮤트 경로"}
    else if(color == "가을 웜 딥") {image = "가을딥 경로"}
    else if(color == "겨울 쿨 브라이트") {image = "겨울브라이트 경로"}
    else if(color == "겨울 쿨 다크") {image = "겨울다크 경로"}
    else {return res.status(400).send({error: "퍼스널 컬러 없음"})}
    return res.status(200).send({image});
  })

})

//퍼스널컬러 진단표
app.post('/api/personal/diagnostic', auth, (req,res) => {
  var color = req.body.color;
  var image = "퍼스널진단표 경로";
  console.log(req.body);
  
  User.findOneAndUpdate({_id:req.user._id}, 
    {color: color},
    (err, user) => {
      if(err) return res.status(400).send({error: "퍼스널 컬러 오류"})
      if(color == "봄 웜 라이트") {image = "봄라이트 경로"}
      else if(color == "봄 웜 브라이트") {image = "봄브라이트 경로"}
      else if(color == "여름 쿨 라이트") {image = "여름라이트 경로"}
      else if(color == "여름 쿨 뮤트") {image = "여름뮤트 경로"}
      else if(color == "가을 웜 뮤트") {image = "가을뮤트 경로"}
      else if(color == "가을 웜 딥") {image = "가을딥 경로"}
      else if(color == "겨울 쿨 브라이트") {image = "겨울브라이트 경로"}
      else if(color == "겨울 쿨 다크") {image = "겨울다크 경로"}
      else {return res.status(400).send({error: "컬러 입력 잘못 됨"})}
      return res.status(200).send({image});
    }
  )
  
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})