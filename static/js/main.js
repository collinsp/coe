
// set up socket io
(function(){

  var syncTimeoutMS = 500;

  var socket = io.connect('http://localhost:3000');

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

    // bookmark
    var scrollTop = $('iframe').contents().scrollTop();
    //var bookmarks = ED.getSelection().createBookmarks2(true);

    // create patch of changes since last sync
    var localData = ED.getData();
    var diff = DMP.diff_main(SERVER_DOC.data,localData);
/*
    if (diff.length > 2) {
      DMP.diff_cleanupSemantic(diff);
    }
*/
    var patch_list = DMP.patch_make(SERVER_DOC.data, localData, diff);

    // apply diff to applied data
    var diffs = DMP.diff_fromDelta(SERVER_DOC.data, x.delta);
    SERVER_DOC.data = DMP.diff_text2(diffs);
    SERVER_DOC.deltas.push(x.delta);
    SERVER_DOC.i = x.i;

    // if nothing to merge
    if (patch_list.length==0) {
      ED.setData(SERVER_DOC.data);
    }

    // merge patch
    else {
      var rv = DMP.patch_apply(patch_list, SERVER_DOC.data);
      var mergeData = rv[0];
      var mergeResults = rv[1];
      console.log('merge results: %o', mergeResults);
      ED.setData(mergeData);
      scheduleSync();
    }

    // restore bookmark
    //ED.getSelection().selectBookmarks(bookmarks);
    $('iframe').contents().scrollTop(scrollTop);
  });

  socket.on('error', function (x) {
    console.log('error: %o', x);
  });
  socket.on('ok', function (x) {
    console.log('ok: %o', x);
    SERVER_DOC.i = x.i;
    SERVER_DOC.data = SERVER_DOC.unaccepted_data;
    SERVER_DOC.deltas.push(SERVER_DOC.unaccepted_delta);
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

  $('input[name=fn]').change(function(){
    if (SERVER_DOC) {
      socket.emit('unsubscribe', { fn: SERVER_DOC.fn });
      SERVER_DOC = null;
      ED.setData("");  
    }
    var fn = $(this).val(); 
    console.log('subscribing to: '+fn);
    socket.emit('subscribe', { fn: fn });
    return true;
  });

  

  var DMP = new diff_match_patch();

  var ED = CKEDITOR.appendTo('doceditor');
  ED.on('change', scheduleSync);

  var SERVER_DOC = null; // { deltas: [], data: "", i: 0, fn: "relative/path/to/file.ext", unaccepted_data: null, unaccepted_delta: null }
  
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
    var x = { fn: SERVER_DOC.fn, i: SERVER_DOC.i, delta: SERVER_DOC.unaccepted_delta };
    console.log('doSync: %o', x);
    socket.emit('diff', x);
  }
  
  window.test = function() {
    var i = 30;
    function typesomething() {
      --i;
      var dat = ED.getData();
      dat += '<p>The cat is up skdjl slkjdlsjdl The cat is down.</p>';
      ED.setData(dat);
      scheduleSync();
      if (i > 0) setTimeout(typesomething, 1000);
    }
    typesomething();
  };


  $('input[name=fn]').val('hello.html').change();


})();
