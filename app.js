
var SECRET = "fdg klfdgj lfdj gfdsl;gj  sge45higksjd dkjh klfgdjh -ifjldkfjgldkjflkgjdkl ";
var HOST = '';
var PORT = 3000;
var SOCKET_IO_CONNECT = HOST+':'+PORT;


var
  diff_match_patch=require('googlediff'),
  crypto = require('crypto'),
  fs = require('fs'),
  express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server);

server.listen(PORT, HOST);

app.get('/', function(req,res) {
  res.send("<!DOCTYPE html>\n<html><head><link rel=stylesheet type='text/css' href='static/main.css' /><script>SOCKET_IO_CONNECT='"+SOCKET_IO_CONNECT+"';</script><script src=static/jquery.js></script><script src=static/google-diff-match-patch/diff_match_patch.js></script><script src=/socket.io/socket.io.js></script><script src=static/ckeditor/ckeditor.js></script><script src=static/ckeditor/adapters/jquery.js></script></head><body><div id=doceditor></div><script src=static/main.js></script></body></html>");
});

app.use('/static', express.static(__dirname + '/static'));

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

console.log('http://'+((HOST)?HOST:'localhost')+((PORT==80)?'':':'+PORT));
