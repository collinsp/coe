
var SECRET = "fdg klfdgj lfdj gfdsl;gj  sge45higksjd dkjh klfgdjh -ifjldkfjgldkjflkgjdkl ";


var
  diff_match_patch=require('googlediff'),
  crypto = require('crypto'),
  fs = require('fs'),
  express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server);

server.listen(3000);

app.use('/static', express.static(__dirname + '/static'));

app.get('/', function(req, res){
  res.redirect('/static/coe.html');
});

var clientSeq = 0;
var files = {}; // fn: { deltas: [], data: "", i: 0, fn: "relative/path/to/file.ext" };

var DMP = new diff_match_patch();

io.sockets.on('connection', function (socket) {

  // data: { fn: "path/to/fn" }
  socket.on('subscribe', function(data) {
    var fn = data.fn;
    console.log('request to subscribe to: %o', data);

    // join this channel
    socket.join(fn);

    var f = files[fn];

    // if open
    if (f) socket.emit('doc', f);

    // else open file
    else {
      f = files[fn] = { deltas: [], data: null, i: 0, fn: fn };
      fs.readFile(__dirname+'/data/'+fn, { encoding: 'utf8' }, function(err,data) {
        if (err) {
          console.log(err);
          io.sockets.in(fn).emit('error', { msg: 'could not open file: ' + fn + '; ' + err });
          // todo unsubscribe all in this channel
        } else {
          f.data = data;
          io.sockets.in(fn).emit('doc', f);
        }
      });
    }
  });

  socket.on('unsubscribe', function(data) {
    socket.leave(data.fn);
  });
  
  // data: { fn: "path/to/fn", delta: "diff str", i: versionNum }
  socket.on('diff', function(data){
    var f = files[data.fn];
    if (! f) {
      socket.emit('error', { msg: 'file does not exist!' });
    } else if (data.i != f.i) {
      socket.emit('tryagain', { i: f.i });
    } else {
      var diffs = DMP.diff_fromDelta(f.data, data.delta);
      f.data = DMP.diff_text2(diffs);
      f.deltas.push(data.delta);
      data.i++;
      f.i++;
      socket.emit('ok', { i: f.i });
      socket.broadcast.emit('diff', data);
    }
  });
});

console.log('Listening on port 3000');
