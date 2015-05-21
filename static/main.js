
(function(){
  var syncTimeoutMS = 200;

  if (! SOCKET_IO_CONNECT) {
    alert('undefined: SOCKET_IO_CONNECT');
    return;
  }


  // set up socket io
  var socket = io.connect(SOCKET_IO_CONNECT);

  socket.on('diff', function (x) {
    console.log('got server diff: %o', x);
    if (! SERVER_DOC) {
      console.log('no server doc!');
      return;
    }
    if (SERVER_DOC.fn != x.fn) {
      console.log('invalid filename: %o %o', f, x);
      return;
    }
    if ((SERVER_DOC.i + 1) != (x.i + 0)) {
      console.log('i mismatch: %s != %s', SERVER_DOC.i, x.i);
      return;
    }
    SERVER_DOC.unaccepeted_data = null;
    SERVER_DOC.unaccepeted_delta = null;

    // bookmark our current cursor position
    var bookmarks = ED.getSelection().createBookmarks2();
    function restoreCursorPos() {
      ED.getSelection().selectBookmarks(bookmarks);
    }

    // create patch of changes since last sync
    var localData = ED.getData();
    var diff = DMP.diff_main(SERVER_DOC.data,localData);
    var patch_list = DMP.patch_make(SERVER_DOC.data, localData, diff);

    // apply new diff from server to data
    var diffs = DMP.diff_fromDelta(SERVER_DOC.data, x.delta);
    SERVER_DOC.data = DMP.diff_text2(diffs);
    SERVER_DOC.i = x.i;

    // if nothing to merge
    // this probably never happens since we have the bookmark in the patch
    if (patch_list.length==0) {
      ED.setData(SERVER_DOC.data, restoreCursorPos);
    }

    // merge patch
    else {
      var rv = DMP.patch_apply(patch_list, SERVER_DOC.data);
      var mergeData = rv[0];
      var mergeResults = rv[1];
      ED.setData(SERVER_DOC.data, function() {
        restoreCursorPos();
        scheduleSync();
      });
    }

  });

  socket.on('error', function (x) {
    console.log('error: %o', x);
  });
  socket.on('ok', function (x) {
    console.log('ok: %o', x);
    SERVER_DOC.i = x.i;
    SERVER_DOC.data = SERVER_DOC.unaccepted_data;
    SERVER_DOC.unaccepted_data = null;
    SERVER_DOC.unaccepted_delta = null;
  });
  socket.on('doc', function (x) {
    console.log('doc: %o', x);
    SERVER_DOC = x; 
    ED.setData(SERVER_DOC.data);
  });
  socket.on('tryagain', function (x) {
    console.log('tryagain: %o', x);
    SERVER_DOC.unaccepted_data = null;
    SERVER_DOC.unaccepted_delta = null;
    scheduleSync();
  });

  var DMP = new diff_match_patch();

  var ED = CKEDITOR.appendTo('doceditor');
  ED.on('instanceReady', function() { ED.execCommand('maximize'); });
  ED.on('change', scheduleSync);

  var SERVER_DOC = null; // { data: "", i: 0, fn: "relative/path/to/file.ext", unaccepted_data: null, unaccepted_delta: null }
  
  var syncTimeout = null;
  function scheduleSync() {
    console.log('schedulesync');
    if (! SERVER_DOC || SERVER_DOC.unaccepted_data) return;
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(doSync, syncTimeoutMS);
    return true;
  }
  function doSync() {
    if (! SERVER_DOC || SERVER_DOC.unaccepted_data) return;
    SERVER_DOC.unaccepted_data = ED.getData(); 
    var compare = DMP.diff_main(SERVER_DOC.data, SERVER_DOC.unaccepted_data);
    SERVER_DOC.unaccepted_delta = DMP.diff_toDelta(compare);
console.log('delta %o', SERVER_DOC.unaccepted_delta);
    var x = { fn: SERVER_DOC.fn, i: SERVER_DOC.i, delta: SERVER_DOC.unaccepted_delta };
    console.log('doSync: %o', x);
    socket.emit('diff', x);
  }

  // on hash change subscribe to defined path
  $(window).on('hashchange', function() {
    console.log('hashchange: %s', location.hash);
    if (/\#(\S+)/.test(location.hash)) {
      var path = RegExp.$1;
      console.log('path is: %s', path);
      if (SERVER_DOC) {
        if (path == SERVER_DOC.fn) return true;
        console.log('unsubscribing to: %s', SERVER_DOC.fn);
        socket.emit('unsubscribe', { fn: SERVER_DOC.fn });
        SERVER_DOC = null;
        ED.setData("");  
      }
      console.log('subscribing to: '+path);
      socket.emit('subscribe', { fn: path });
      document.title = path;
      return true;
    }
    return true;
  });
  
  // if no path defined change to hello.html (temp for testing)
  if (! /\#(\S+)/.test(location.hash)) {
    location.hash = 'hello.html';
  }
  $(window).trigger('hashchange');
})();
