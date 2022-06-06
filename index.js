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
app.use(express.static('views'));

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

//마이페이지: 퍼스널컬러 진단표
app.get('/api/my/color', auth, (req,res) => {
  var image = "퍼스널진단표 경로";
  
  User.findOne({_id:req.user._id}, (err, user) => {
      if(err) return res.status(400).send({error: "퍼스널 컬러 오류"})
      var color = req.user.color;

      if(color == "봄 웜 라이트") {image = "퍼스널컬러진단/봄웜라이트.jpg"}
      else if(color == "봄 웜 브라이트") {image = "퍼스널컬러진단/봄웜브라이트.jpg"}
      else if(color == "여름 쿨 라이트") {image = "퍼스널컬러진단/여름쿨라이트.jpg"}
      else if(color == "여름 쿨 뮤트") {image = "퍼스널컬러진단/여름쿨뮤트.jpg"}
      else if(color == "가을 웜 뮤트") {image = "퍼스널컬러진단/가을웜뮤트.jpg"}
      else if(color == "가을 웜 딥") {image = "퍼스널컬러진단/가을웜딥.jpg"}
      else if(color == "겨울 쿨 브라이트") {image = "퍼스널컬러진단/겨울쿨브라이트.jpg"}
      else if(color == "겨울 쿨 딥") {image = "퍼스널컬러진단/겨울쿨딥.jpg"}
      else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}

      return res.status(200).send({image});
    }
  )  
})

//회원가입
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

//로그인
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

//auth 확인
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


//비밀번호 찾기
app.post('/api/users/pwfind', (req,res) => {
  User.findOne({email: req.body.email}, (err, user) => {
    if(!user) {
      return res.json({
        message: "제공된 이메일에 해당하는 유저가 없습니다."
      })
    }
    else {
      var password = req.body.password;
      bcrypt.genSalt(saltRounds, function (err, salt) {
        if (err) return req.json(err) 
        else {
          bcrypt.hash(password, salt, function(err, hash) {
            if (err) return req.json(err)
            else {
              console.log(hash)
              //$2a$10$FEBywZh8u9M0Cec/0mWep.1kXrwKeiWDba6tdKvDfEBjyePJnDT7K
              User.findOneAndUpdate({_id: user._id}, {password: hash},(err,user) => {
                if(err) return res.status(400).send(err)
                return res.status(200).send({
                  change_password: true
                })
              })
            }
          })
        }
      })
    }
  })
})

/*
//아이디 찾기
app.post('/api/users/idfind', (req,res) => {
  User.findOne({nickname: req.body.nickname}, {"_id": 0, "email": 1}, (err, user) => {
    if(!user) {
      return res.json({
        message: "닉네임이 없습니다."
      })
    }
    return res.json({user})
  })
})
*/

//메인페이지 날씨 옷
//선호 스타일: 여(로맨틱 캠퍼스 베이직 오피스), 남 (포멀 베이직 캠퍼스 스포츠)
app.post('/api/main/weather', auth, (req, res) => {
  User.findOne({_id: req.user._id}, (err, user) => {
    if (err) return res.status(400).send({message: "없는 아이디"})
    var gender = req.user.gender;
    var style = req.user.style;
    var weather = req.body.weather;
    var image = "image 경로";
    var num = Math.floor(Math.random() *(8-1)) + 1;

    //성별
    if(gender == "여") {
      //계절
      //겨울
      if(weather <= 8) {
          //스타일
          if(style == "romantic") {image = '여자코디/겨울/여자겨울로맨틱' + num +'.jpg';}
          else if(style == "basic") {image = '여자코디/겨울/여자겨울빈티지' + num +'.jpg';}
          else if(style == "campus") {image = '여자코디/겨울/여자겨울캠퍼스' + num +'.jpg';}
          else if(style == "office") {image = '여자코디/겨울/여자겨울오피스' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      //가을
      else if( 9<=weather && weather < 16) {
          if(style == "romantic") {image = '여자코디/가을/여자가을로맨틱' + num +'.jpg';}
          else if(style == "basic") {image = '여자코디/가을/여자가을베이직' + num +'.jpg';}
          else if(style == "campus") {image = '여자코디/가을/여자가을캠퍼스' + num +'.jpg';}
          else if(style == "office") {image = '여자코디/가을/여자가을오피스' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      //여름
      else if(23<=weather) { 
          if(style == "romantic") {image = '여자코디/여름/여자여름로맨틱' + num +'.jpg';}
          else if(style == "basic") {image = '여자코디/여름/여자여름베이직' + num +'.jpg';}
          else if(style == "campus") {image = '여자코디/여름/여자여름캠퍼스' + num +'.jpg';}
          else if(style == "office") {image = '여자코디/여름/여자여름오피스' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      //봄
      else if( 16<=weather && weather <23) { 
          if(style == "romantic") {image = '여자코디/봄/여자봄로맨틱' + num +'.jpg';}
          else if(style == "basic") {image = '여자코디/봄/여자봄베이직' + num +'.jpg';}
          else if(style == "campus") {image = '여자코디/봄/여자봄캠퍼스' + num +'.jpg';}
          else if(style == "office") {image = '여자코디/봄/여자봄오피스' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      else return res.status(400).send({error: "날씨 오류"})

      return res.status(200).send({image});
    }
    else if(gender =="남") {
      //겨울
      if(weather <= 8) {
          //스타일
          if(style == "formal") {image = '남자코디/겨울/남자겨울포멀' + num +'.jpg';}
          else if(style == "basic") { image = '남자코디/겨울/남자겨울베이직' + num +'.jpg';}
          else if(style == "campus") {image = '남자코디/겨울/남자겨울캠퍼스' + num +'.jpg';}
          else if(style == "sports") {image = '남자코디/겨울/남자겨울스포츠' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      //가을
      else if( 9<=weather && weather < 16) {
          if(style == "formal") {image = '남자코디/가을/남자가을포멀' + num +'.jpg';}
          else if(style == "basic") { image = '남자코디/가을/남자가을베이직' + num +'.jpg';}
          else if(style == "campus") {image = '남자코디/가을/남자가을캠퍼스' + num +'.jpg';}
          else if(style == "sports") {image = '남자코디/가을/남자가을스포츠' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      //여름
      else if(23<=weather) { 
          if(style == "formal") {image = '남자코디/여름/남자여름포멀' + num +'.jpg';}
          else if(style == "basic") {image = '남자코디/여름/남자여름베이직' + num +'.jpg';}
          else if(style == "campus") {image = '남자코디/여름/남자여름캠퍼스' + num +'.jpg';}
          else if(style == "sports") {image = '남자코디/여름/남자여름스포츠' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      //봄
      else if( 16<=weather && weather <23) {
          if(style == "formal") {image = '남자코디/봄/남자봄포멀' + num +'.jpg';}
          else if(style == "basic") {image = '남자코디/봄/남자봄베이직' + num +'.jpg';}
          else if(style == "campus") {image = '남자코디/봄/남자봄캠퍼스' + num +'.jpg';}
          else if(style == "sports") {image = '남자코디/봄/남자봄스포츠' + num +'.jpg';}
          else return res.status(400).send({error : "스타일 오류"})
      }
      else return res.status(400).send({error: "날씨 오류"})

      return res.status(200).send({image});
    }
    else {
      return res.status(400).send({error : "성별 오류"});
    }
  })
})


//메인페이지 TPO 
//P = 친구, 애인, 가족, 직장, 처음 보는 사람
//O = 경사, 운동, 직장, 여행, 데이트, 데일리
// 경사(결혼식 돌잔치 등 모두포함)
// 여행(계곡, 바다, 수영장, 스키장 등 갈 때 입는 것)
// 데이트(연인이나 소개팅(첨본사람) 포함), 데일리(기본외출, 간단한 외출)
app.post('/api/main/tpo', auth, (req, res) => {
  var date = new Date();
  var nowMonth = date.getMonth()+1;

  User.findOne({_id: req.user._id}, (err, user) => {
    if (err) return res.status(400).send({message: "없는 아이디"})
    var gender = req.user.gender;
    var people = req.body.people;
    var occasion = req.body.occasion;
    var image = "image 경로";
    var num = Math.floor(Math.random() *(8-1)) + 1;

    if(gender == "여") {
      //계절
      //겨울
      if (nowMonth == 12 || nowMonth == 1 ||nowMonth == 2) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '여자코디/TPO/겨울친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/겨울친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/겨울친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/겨울친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/겨울친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/겨울친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '여자코디/TPO/겨울가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/겨울가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/겨울가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/겨울가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/겨울가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/겨울가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '여자코디/TPO/겨울연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/겨울연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/겨울연인여행' + num +'.jpg';}    
          else if(occasion == "운동") {image = '여자코디/TPO/겨울연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/겨울연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/겨울연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '여자코디/TPO/겨울직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/겨울직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/겨울직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/겨울직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/겨울직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/겨울직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '여자코디/TPO/겨울처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/겨울처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/겨울처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/겨울처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/겨울처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/겨울처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
        
        return res.status(200).send({image});
      }
      //봄
      else if(nowMonth == 3 || nowMonth == 4 || nowMonth ==5) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '여자코디/TPO/봄친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/봄친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/봄친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/봄친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/봄친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/봄친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '여자코디/TPO/봄가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/봄가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/봄가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/봄가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/봄가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/봄가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '여자코디/TPO/봄연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/봄연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/봄연인여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/봄연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/봄연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/봄연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '여자코디/TPO/봄직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/봄직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/봄직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/봄직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/봄직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/봄직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '여자코디/TPO/봄처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/봄처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/봄처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/봄처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/봄처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/봄처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
      
        return res.status(200).send({image});
      }
      //여름
      else if(nowMonth == 6 || nowMonth == 7 || nowMonth ==8) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '여자코디/TPO/여름친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/여름친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/여름친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/여름친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/여름친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/여름친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '여자코디/TPO/여름가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/여름가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/여름가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/여름가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/여름가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/여름가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '여자코디/TPO/여름연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/여름연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/여름연인여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/여름연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/여름연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/여름연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '여자코디/TPO/여름직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/여름직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/여름직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/여름직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/여름직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/여름직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '여자코디/TPO/여름처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/여름처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/여름처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/여름처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/여름처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/여름처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
        
        return res.status(200).send({image});
      }
      //가을
      else if(nowMonth == 9 || nowMonth == 10 || nowMonth == 11) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '여자코디/TPO/가을친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/가을친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/가을친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/가을친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/가을친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/가을친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '여자코디/TPO/가을가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/가을가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/가을가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/가을가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/가을가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/가을가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '여자코디/TPO/가을연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/가을연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/가을연인여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/가을연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/가을연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/가을연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '여자코디/TPO/가을직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/가을직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/가을직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/가을직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/가을직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/가을직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '여자코디/TPO/가을처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '여자코디/TPO/가을처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '여자코디/TPO/가을처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '여자코디/TPO/가을처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '여자코디/TPO/가을처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '여자코디/TPO/가을처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
        
        return res.status(200).send({image});
      }
      else return res.status(400).send({error: "날짜 오류"})
    }
    
    else if(gender == "남") {
      //계절
      //겨울
      if (nowMonth == 12 || nowMonth == 1 ||nowMonth == 2) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '남자코디/TPO/겨울친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/겨울친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/겨울친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/겨울친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/겨울친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/겨울친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '남자코디/TPO/겨울가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/겨울가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/겨울가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/겨울가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/겨울가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/겨울가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '남자코디/TPO/겨울연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/겨울연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/겨울연인여행' + num +'.jpg';}    
          else if(occasion == "운동") {image = '남자코디/TPO/겨울연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/겨울연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/겨울연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '남자코디/TPO/겨울직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/겨울직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/겨울직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/겨울직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/겨울직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/겨울직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '남자코디/TPO/겨울처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/겨울처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/겨울처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/겨울처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/겨울처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/겨울처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
        
        return res.status(200).send({image});
      }
      //봄
      else if(nowMonth == 3 || nowMonth == 4 || nowMonth ==5) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '남자코디/TPO/봄친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/봄친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/봄친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/봄친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/봄친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/봄친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '남자코디/TPO/봄가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/봄가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/봄가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/봄가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/봄가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/봄가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '남자코디/TPO/봄연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/봄연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/봄연인여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/봄연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/봄연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/봄연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '남자코디/TPO/봄직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/봄직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/봄직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/봄직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/봄직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/봄직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '남자코디/TPO/봄처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/봄처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/봄처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/봄처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/봄처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/봄처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
      
        return res.status(200).send({image});
      }
      //여름
      else if(nowMonth == 6 || nowMonth == 7 || nowMonth ==8) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '남자코디/TPO/여름친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/여름친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/여름친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/여름친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/여름친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/여름친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '남자코디/TPO/여름가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/여름가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/여름가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/여름가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/여름가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/여름가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '남자코디/TPO/여름연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/여름연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/여름연인여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/여름연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/여름연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/여름연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '남자코디/TPO/여름직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/여름직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/여름직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/여름직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/여름직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/여름직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '남자코디/TPO/여름처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/여름처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/여름처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/여름처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/여름처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/여름처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
        
        return res.status(200).send({image});
      }
      //가을
      else if(nowMonth == 9 || nowMonth == 10 || nowMonth == 11) {
        if(people == "친구") { // People
          //occasion
          if(occasion == "경사") {image = '남자코디/TPO/가을친구경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/가을친구데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/가을친구여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/가을친구운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/가을친구직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/가을친구데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="가족") { // People
          if(occasion == "경사") {image = '남자코디/TPO/가을가족경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/가을가족데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/가을가족여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/가을가족운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/가을가족직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/가을가족데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="연인") { // People
          if(occasion == "경사") {image = '남자코디/TPO/가을연인경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/가을연인데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/가을연인여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/가을연인운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/가을연인직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/가을연인데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="직장") { // People
          if(occasion == "경사") {image = '남자코디/TPO/가을직장경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/가을직장데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/가을직장여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/가을직장운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/가을직장직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/가을직장데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else if(people =="처음 보는 사람") { // People
          if(occasion == "경사") {image = '남자코디/TPO/가을처음경사' + num +'.jpg';}
          else if(occasion == "데이트") {image = '남자코디/TPO/가을처음데이트' + num +'.jpg';}
          else if(occasion == "여행") {image = '남자코디/TPO/가을처음여행' + num +'.jpg';}
          else if(occasion == "운동") {image = '남자코디/TPO/가을처음운동' + num +'.jpg';}
          else if(occasion == "직장") {image = '남자코디/TPO/가을처음직장' + num +'.jpg';}
          else if(occasion == "데일리") {image = '남자코디/TPO/가을처음데일리' + num +'.jpg';}
          else return res.status(400).send({error : "occasion 오류"})
        }
        else return res.status(400).send({error: "people 오류"})
        
        return res.status(200).send({image});
      }
      else return res.status(400).send({error: "날짜 오류"})
    }
      
    else {
      return res.status(400).send({error: "성별 오류"})
    }
  })
})

//메인페이지 퍼스널컬러 옷
//남,여 나누고, 계절로 나누기
app.get('/api/main/personal', auth, (req,res) => {
  var date = new Date();
  var nowMonth = date.getMonth()+1;
  
  User.findOne({_id:req.user._id}, (err, user) => {
    if(err) return res.status(400).send({personal: "회원정보 오류"})
    var color = req.user.color;
    var gender = req.user.gender;
    var image = "퍼스널진단표 경로";
    var num = Math.floor(Math.random() *(8-1)) + 1;

    if(gender == "여") 
    {
      //겨울
      if(nowMonth == 12 || nowMonth == 1 ||nowMonth == 2) {
        if(color == "봄 웜 라이트") {image = '여자코디/퍼스널컬러/겨울봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '여자코디/퍼스널컬러/겨울봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '여자코디/퍼스널컬러/겨울여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '여자코디/퍼스널컬러/겨울여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '여자코디/퍼스널컬러/겨울가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '여자코디/퍼스널컬러/겨울가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '여자코디/퍼스널컬러/겨울겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '여자코디/퍼스널컬러/겨울겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      //봄
      else if(nowMonth == 3 || nowMonth ==4 || nowMonth ==5) {
        if(color == "봄 웜 라이트") {image = '여자코디/퍼스널컬러/봄봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '여자코디/퍼스널컬러/봄봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '여자코디/퍼스널컬러/봄여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '여자코디/퍼스널컬러/봄여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '여자코디/퍼스널컬러/봄가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '여자코디/퍼스널컬러/봄가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '여자코디/퍼스널컬러/봄겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '여자코디/퍼스널컬러/봄겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      //여름
      else if (nowMonth == 6 || nowMonth == 7 || nowMonth ==8) {
        if(color == "봄 웜 라이트") {image = '여자코디/퍼스널컬러/여름봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '여자코디/퍼스널컬러/여름봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '여자코디/퍼스널컬러/여름여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '여자코디/퍼스널컬러/여름여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '여자코디/퍼스널컬러/여름가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '여자코디/퍼스널컬러/여름가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '여자코디/퍼스널컬러/여름겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '여자코디/퍼스널컬러/여름겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      //가을
      else if (nowMonth == 9|| nowMonth == 10 || nowMonth == 11) {
        if(color == "봄 웜 라이트") {image = '여자코디/퍼스널컬러/가을봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '여자코디/퍼스널컬러/가을봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '여자코디/퍼스널컬러/가을여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '여자코디/퍼스널컬러/가을여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '여자코디/퍼스널컬러/가을가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '여자코디/퍼스널컬러/가을가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '여자코디/퍼스널컬러/가을겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '여자코디/퍼스널컬러/가을겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      else return res.status(400).send({error: "날짜 오류"})
    }

    else if(gender == "남") 
    {
      //겨울
      if(nowMonth == 12 || nowMonth == 1 ||nowMonth == 2) {
        if(color == "봄 웜 라이트") {image = '남자코디/퍼스널컬러/겨울봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '남자코디/퍼스널컬러/겨울봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '남자코디/퍼스널컬러/겨울여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '남자코디/퍼스널컬러/겨울여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '남자코디/퍼스널컬러/겨울가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '남자코디/퍼스널컬러/겨울가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '남자코디/퍼스널컬러/겨울겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '남자코디/퍼스널컬러/겨울겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      //봄
      else if(nowMonth == 3 || nowMonth ==4 || nowMonth ==5) {
        if(color == "봄 웜 라이트") {image = '남자코디/퍼스널컬러/봄봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '남자코디/퍼스널컬러/봄봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '남자코디/퍼스널컬러/봄여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '남자코디/퍼스널컬러/봄여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '남자코디/퍼스널컬러/봄가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '남자코디/퍼스널컬러/봄가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '남자코디/퍼스널컬러/봄겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '남자코디/퍼스널컬러/봄겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      //여름
      else if (nowMonth == 6 || nowMonth == 7 || nowMonth ==8) {
        if(color == "봄 웜 라이트") {image = '남자코디/퍼스널컬러/여름봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '남자코디/퍼스널컬러/여름봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '남자코디/퍼스널컬러/여름여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '남자코디/퍼스널컬러/여름여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '남자코디/퍼스널컬러/여름가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '남자코디/퍼스널컬러/여름가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '남자코디/퍼스널컬러/여름겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '남자코디/퍼스널컬러/여름겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      //가을
      else if (nowMonth == 9|| nowMonth == 10 || nowMonth == 11) {
        if(color == "봄 웜 라이트") {image = '남자코디/퍼스널컬러/가을봄웜라이트' + num +'.jpg'}
        else if(color == "봄 웜 브라이트") {image = '남자코디/퍼스널컬러/가을봄웜브라이트' + num +'.jpg'}
        else if(color == "여름 쿨 라이트") {image = '남자코디/퍼스널컬러/가을여름쿨라이트' + num +'.jpg'}
        else if(color == "여름 쿨 뮤트") {image = '남자코디/퍼스널컬러/가을여름쿨뮤트' + num +'.jpg'}
        else if(color == "가을 웜 뮤트") {image = '남자코디/퍼스널컬러/가을가을웜뮤트' + num +'.jpg'}
        else if(color == "가을 웜 딥") {image = '남자코디/퍼스널컬러/가을가을웜딥' + num +'.jpg'}
        else if(color == "겨울 쿨 브라이트") {image = '남자코디/퍼스널컬러/가을겨울쿨브라이트' + num +'.jpg'}
        else if(color == "겨울 쿨 딥") {image = '남자코디/퍼스널컬러/가을겨울쿨딥' + num +'.jpg'}
        else {return res.status(200).send({message: "퍼스널 컬러 없습니다."})}
        return res.status(200).send({image});
      }
      else return res.status(400).send({error: "날짜 오류"})
    }
    else return res.status(400).send({error: "성별 오류"})
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
      if(color == "봄 웜 라이트") {image = "퍼스널컬러진단/봄웜라이트.jpg"}
      else if(color == "봄 웜 브라이트") {image = "퍼스널컬러진단/봄웜브라이트.jpg"}
      else if(color == "여름 쿨 라이트") {image = "퍼스널컬러진단/여름쿨라이트.jpg"}
      else if(color == "여름 쿨 뮤트") {image = "퍼스널컬러진단/여름쿨뮤트.jpg"}
      else if(color == "가을 웜 뮤트") {image = "퍼스널컬러진단/가을웜뮤트.jpg"}
      else if(color == "가을 웜 딥") {image = "퍼스널컬러진단/가을웜딥.jpg"}
      else if(color == "겨울 쿨 브라이트") {image = "퍼스널컬러진단/겨울쿨브라이트.jpg"}
      else if(color == "겨울 쿨 딥") {image = "퍼스널컬러진단/겨울쿨딥.jpg"}
      else {return res.status(400).send({error: "컬러 입력 잘못 됨"})}
      return res.status(200).send({image});
    }
  )  
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})