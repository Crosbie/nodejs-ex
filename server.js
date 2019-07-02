//  OpenShift sample Node application
var express = require('express'),
    fs      = require('fs'),
    app     = express(),
    eps     = require('ejs'),
    morgan  = require('morgan');
    bodyParser = require('body-parser'),
    _ = require('underscore'),
    atob = require("atob"),
    request = require('request'),
    CronJob = require('cron').CronJob,
    ibmOffice = {},
    siteAquarium = {};

Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(express.static('public'))
// app.use(bodyParser.urlencoded({ extended: true }));


var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  console.log('mongoURL not set');
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'] || "127.0.0.1",
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'] || "27017",
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

    //connection string 'mongodb://demo:demo@127.0.0.1:27017/test'
  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  console.log('in DB init', mongoURL);
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURL;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render('index.html', {
        pageCountMessage : count,
        dbInfo: dbDetails
      });
    });
  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});

var testValue = 1;
ibmOffice = {
    ts: 'DUMMY',
    co2: 1200,
    cAlert: testValue
  };
siteAquarium = {
    ts: 'DUMMY',
    co2: 1100,
    cAlert: 1
  }
app.get('/populate', function (req,res){
  res.json({ibmOffice: ibmOffice, siteAquarium: siteAquarium});
})

app.get('/break',function(req,res){
  console.log('\n\nTEST BREAK IBM OFFICE\n\n');
  testValue = 2;
  switchLightIBM(1);
  res.end();
});

app.get('/fix',function(req,res){
  console.log('\n\nTEST FIX IBM OFFICE\n\n');
  testValue = 1;
  switchLightIBM(0);
  res.end();
});


// Switch light on/off depending on value (1/0)
function switchLightAquarium(value){
  console.log('Switching Aquarium Light to ', value);

  // baseURL: http://192.168.224.109
  // 3scaleURL: http://apicast-route-2-sensor-monitor.apps.rhlab.ch
  var url = 'http://apicast-route-2-sensor-monitor.apps.rhlab.ch';
  var userKey = '08e5d05247abc78871cf3e715fcfb6fb';

  request(url+'/relay?user_key='+userKey+'&state='+ value,function(err, response){
    if(err || response.statusCode > 299){
      console.error('error switching Aquarium',err || response.body);
    } else {
      console.log('turned Aquarium switch to ', value);
    }
  });
}

// Switch light on/off depending on value (1/0)
function switchLightIBM(value){
  console.log('Switching IBM Light to ', value);

  // base URL: http://192.168.224.110
  // 3scale URL: http://apicast-sensor-monitor.apps.rhlab.ch
  var url = 'http://apicast-sensor-monitor.apps.rhlab.ch';
  var userKey = '469880d3292e52e000f5d6a14bf8ef4b';

  request(url+'/relay?user_key='+userKey+'&state='+ value,function(err, response){
    if(err || response.statusCode > 299){
      console.error('error switching IBM',err || response.body);
    } else {
      console.log('turned IBM switch to ', value);
    }

  });
}


// Temperature Threshold
function tempThreshold(temp){
  if(temp >= 19 && temp <= 23.9){
    return 0;
  } else if(temp >= 15.1 && temp <=25.9){
    return 1;
  } else
    return 2;
}

function co2Threshold(value){
  if(value <= 799){
    return 0;
  } else if(value <= 1199){
    return 1;
  } else
    return 2;
}


// ---- Conversion
// var indata = "AQmpCVAEEQ==";

function base64toHEX(base64) {
  var raw = atob(base64);
  var HEX = '';

  for ( i = 0; i < raw.length; i++ ) {
    var _hex = raw.charCodeAt(i).toString(16)
    HEX += (_hex.length==2?_hex:'0'+_hex);
  }
  return HEX.toUpperCase();
}

// out = 01 09 A9 09 50 04 11
// ------------

app.post('/datain',function(req,res){
  console.log('data-in',req.body);
  res.json({status:'ok'});

  try{
    // body = req.body;
    body = req.body;
  } catch(err){
    console.error('Error parsing JSON:',body, err);
  }

  _.each(body, function(item,index){
    if(item.device_id === "siteaquarium" || item.device_id === "officeibm"){
      processData(item);
      return item;
    }
  })
});

function processData(data){
   console.log('processData',data);

  var rawPayload = data.raw || 'AQmpCVAEEQ==';
  var site = data.device_id;
  var data = base64toHEX(rawPayload);

  /*  example data: 01 09 A9 09 50 04 11
      data format TT XXXX YYYY ZZZZ
      TT = device type
      XXXX = temperature
      YYYY = humidity
      ZZZZ = CO2 ppm

  */

  var type = data.slice(0,2);
  var temp = parseInt(data.slice(2,6),16);
  var humid = parseInt(data.slice(6,10),16);
  var co2 = parseInt(data.slice(10,14),16);

  var tempAlert = tempThreshold(temp/100);
  var cAlert = co2Threshold(co2);


  var obj = {
    site: site,
    type: type,
    temperature: temp/100 + 'c',
    humidity: humid/100 + ' %',
    co2: co2 + ' PPM',
    tempAlert: tempAlert,
    co2Alert: cAlert
  }
  console.log('data-out', obj);

  if(site === 'officeibm'){
    ibmOffice = {ts: new Date(), co2:co2, cAlert:cAlert}; // set global for html view
    if(cAlert === 2){
      // turn on light
      switchLightIBM(1);
    } else {
      // turn off light
      switchLightIBM(0);
    }
  }

  if(site === 'siteaquarium'){
    siteAquarium = {ts: new Date(), co2:co2, cAlert:cAlert}; // set global for html view
    if(cAlert === 2){
      // turn on light
      switchLightAquarium(1);
    } else {
      // turn off light
      switchLightAquarium(0);
    }
  }
}

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);
module.exports = app ;
