
var SECRET = "fdg klfdgj lfdj gfdsl;gj  sge45higksjd dkjh klfgdjh -ifjldkfjgldkjflkgjdkl ";
var HOST = '';
var PORT = 3000;
var SOCKET_IO_CONNECT = HOST+':'+PORT;


var
  program = require('commander'),
  diff_match_patch=require('googlediff'),
  crypto = require('crypto'),
  fs = require('fs'),
  express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server);

program
  .version('0.0.1')
  .option('-p, --port [8000]', 'listen on port', parseInt)
  .option('-h, --host [localhost]', 'bind address')
  .parse(process.argv);

var HOST = program.host || 'localhost';
var PORT = program.port || 8000;
var SOCKET_IO_CONNECT = ((HOST=='localhost')?'':HOST)+':'+PORT;

server.listen(PORT, HOST);

app.get('/', function(req,res) {
  res.send("<!DOCTYPE html>\n<html><head><link rel=stylesheet type='text/css' href='static/main.css' /><script>SOCKET_IO_CONNECT='"+SOCKET_IO_CONNECT+"';</script><script src=static/jquery.js></script><script src=static/google-diff-match-patch/diff_match_patch.js></script><script src=/socket.io/socket.io.js></script><script src=static/ckeditor/ckeditor.js></script><script src=static/ckeditor/adapters/jquery.js></script></head><body><div id=doceditor></div><script src=static/main.js></script></body></html>");
});

app.use('/static', express.static(__dirname + '/static'));

var clientSeq = 0;
var files = {}; // fn: { data: "", i: 0, fn: "relative/path/to/file.ext" };

var DMP = new diff_match_patch();

var DIRTY_WRITE_MS = 5000;

function write_dirty_files() {
  for (var fn in files) {
    var f = files[fn];
    if (f.dirty) {
      console.log('writing to file %s', f.datapath);
      fs.writeFile(f.datapath, f.data, function(err) { 
        if (err) {
          console.log('failed to write to %s', f.datapath);
        } else {
          console.log('wrote to %s', f.datapath);
          f.dirty = false;
        }
      });
    }
  }
  setTimeout(write_dirty_files, DIRTY_WRITE_MS);
}
setTimeout(write_dirty_files, DIRTY_WRITE_MS);

io.sockets.on('connection', function (socket) {

  // data: { fn: "path/to/fn" }
  socket.on('subscribe', function(data) {
    var fn = data.fn;
    console.log('request to subscribe to: %o', data);

    // join this channel
    socket.join(fn);

    // if open
    if (files[fn]) {
      var f = files[fn];
      socket.emit('doc', { data: f.data, i: f.i, fn: f.fn });
    }

    // else open file
    else {

      var safefn = fn.replace(/[\\\/\:\"\*\?\<\>\|]/g,'-');
      var datapath = __dirname+'/data/' + safefn;

      var f = { data: "", i: 0, fn: fn, datapath: datapath, dirty: false };

      // fetch data for file
      fs.readFile(datapath, { encoding: 'utf8' }, function(err, data) {
        if (err) {
          // noop - just means file does not yet exist
          console.log(err);
        } else {
          f.data = data;
          files[fn] = f;

          // send everyone in this channel the doc
          io.sockets.in(fn).emit('doc', { data: f.data, i: f.i, fn: f.fn });
        }
      });
    }
  });

  socket.on('unsubscribe', function(data) {
    console.log('request to unsubscribe: %s', data.fn);
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
      data.i++;
      f.i++;
      f.dirty = true;
      socket.emit('ok', { i: f.i });
      socket.broadcast.emit('diff', data);
    }
  });
});

console.log('http://'+((HOST)?HOST:'localhost')+((PORT==80)?'':':'+PORT));
