var port = 8888;
var io = require('socket.io').listen(port,  { log : true});

io.set('log level', 2);
console.log("I'm listening on " + port);

var MULTICOLOR = 0;

var colorsAvailable = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

// Socket IDs to sockets
var sockets = {};

// TODO Color to phone socket is not enough for multiple boards!!!
var colorToPhoneSocket = {};

var boardNameToBoardSocket = {};

var phoneToBoard = {};

function findBoardNameForSocket(boardSocket) {
    // console.log("Looking for board at " + boardSocket.id);
    var socketId = boardSocket.id;
    for (var boardName in boardNameToBoardSocket) {
	var candBoardSocketId = boardNameToBoardSocket[boardName].id;
	if (candBoardSocketId == socketId) {
	    return boardName;
	}
    }
    return null;
}

// TODO console.debug
function findPhonesForBoard(boardName) {
    var retval = [];
    console.log("Trying to find phones for " + boardName);
    var boardSocketId = boardNameToBoardSocket[boardName].id;
    console.log(boardName + " is at " + boardSocketId);

    for (var phoneSocketId in phoneToBoard) {
	console.log("Considering " + phoneSocketId);
	var phoneSocket = sockets[phoneSocketId];
	var boardSocket = phoneToBoard[phoneSocketId];
	var boardSocketId2 = boardSocket.id;
	console.log("Comparing " + boardSocketId + " to " + boardSocketId2);
	if (boardSocketId == boardSocketId2) {
	    console.log("Pushing " + 
			phoneSocket  + 
			" ID (" + 
			phoneSocket.id
		      + ")");
	    retval.push(phoneSocket);
	}
    }
    return retval;
}

function boardWentAway(boardName) {
    var boardSocket = boardNameToBoardSocket[boardName];
    console.log("[boardWentAway] " + boardName + " (" + boardSocket.id + ") disconnected, removing.");
    
    var phoneSockets = findPhonesForBoard(boardName);
    if (phoneSockets) {
	console.log("[boardWentAway] Found " + phoneSockets.length + " connected to " + boardName);
    }
    for (var i = 0; i < phoneSockets.length; i++) {
	var phoneSocket = phoneSockets[i];
	phoneSocket.emit('toPhoneOops', { msg : 'The board connection went away.' });
    }
    for (var phoneSocketId in phoneSockets) {
	console.log("[boardWentAway] Removing " + phoneSocketId + " connection to " +boardSocket.id);
	delete phoneToBoard[phoneSocketId];
    }
    delete boardNameToBoardSocket[boardName];
}

function logCurrentState() {
    console.log("-------------------------------------------");
    console.log("Status:");
    console.log("\tMULTICOLOR: " + MULTICOLOR);
    console.log('\tBoards:');
    for (var boardName in boardNameToBoardSocket) {
	var boardSocket = boardNameToBoardSocket[boardName];
	console.log("\t\t" + boardName + " at " + boardSocket.id);
	var phones = findPhonesForBoard(boardName);
	console.log("\t\t\tDevices:");
	for (var i = 0; i < phones.length; i++) {
	    var phone = phones[i];
	    console.log("\t\t\t\t" + phone.id);
	}
    }

    console.log("\tColors for devices:");
    for (var color in colorToPhoneSocket) {
	console.log("\t\t" + color + " for " + colorToPhoneSocket[color].id);
    }

    console.log("\tDevices to boards:");
    for (var phone in phoneToBoard) {
	var boardSocket = phoneToBoard[phone];
	var boardName = findBoardNameForSocket(boardSocket);
	console.log("\t\t" + phone + " connected to " + boardName + "(" + 
		    boardSocket.id + ")");
    }
    console.log("-------------------------------------------");
}

function onTimer(arg) {
//    logCurrentState();
    // Step 31.
    for (var boardName in boardNameToBoardSocket) {
	var boardSocket = boardNameToBoardSocket[boardName];
	if (boardSocket.disconnected) {
	  boardWentAway(boardName);
	}
    }

    // Step 32.
    for (var color in colorToPhoneSocket) {
	var phoneSocket = colorToPhoneSocket[color];
	if (phoneSocket.disconnected) {
	    console.log("Disconnected " + phoneSocket.id + " (" + color + 
			"); removing.");
	    delete colorToPhoneSocket.remove[color];
	    var boardSocket = phoneToBoard[phoneSocket.id];
	    if (boardSocket) {
		boardSocket.emit('toBoardRemoveArrow', { color : color });
		console.log("[onTimer] Removing " + phoneSocket.id + " connection to " +boardSocket.id);
		delete phoneToBoard[phoneSocket.id];
	    }
	}
    }
}

// Step 0.		  
setInterval(onTimer, 5000);

io.sockets.on('connection', 
	      function (socket) {
		  console.log("Received connection from " + socket.id);
		  sockets[socket.id] = socket;

		  // Step 4.
		  function onBoardHi(data) {
		      console.log('onBoardHi');
		      var boardName = data.boardName;
		      console.log("Board " + boardName + " checked in on " + socket.id);
		      boardNameToBoardSocket[boardName] = socket;
		      logCurrentState();
		  }

		  // Step 10.
		  function onPhoneHi(data) {
		      console.log('onPhoneHi');

		      var lat = data.latitude;
		      var lng = data.longitude;
		      console.log("New device: " + data.deviceId + " at " +
				 socket.id + "; coordinates: " + lat + "x" +
				 lng);	
		      var boardsAvailable = [];
		      for (var boardName in boardNameToBoardSocket) {
			  boardsAvailable.push(boardName);
		      }
		      if (boardsAvailable.length > 0) {
			  // Step 11.
			  socket.emit('toPhoneWelcome', boardsAvailable);
		      } else {
			  // Step 12. 
			  socket.emit('toPhoneOops', 
				      { msg : 'No boards available'});
			  
		      }
		      logCurrentState();
		  }

		  // Step 15. 
		  function onPhoneConnectTo(data) {
		      console.log('onPhoneConnectTo');
		      var boardName = data.boardName;
		      console.log("Phone " + socket.id + " wishes to connect to " + boardName);
		      if (socket.id in phoneToBoard) {
			  var boardSocket = phoneToBoard[socket.id];
			  console.log("Phone " + socket.id + "  already conected to " + boardSocket.id);

			  var color = null;
			  for (var color in colorToPhoneSocket) {
			      if (colorToPhoneSocket[color].id ==
				  socket.id) {
				  break;
			      }
			  }
			  delete colorToPhoneSocket[color];
			  console.log(socket.id + " has color " + color);
			  boardSocket.emit('toBoardRemoveArrow', 
					   { color : color });
			  console.log("[onPhoneConnectTo] Removing " + socket.id + " connection to " + boardSocket.id);
			  delete phoneToBoard[socket.id];
		      }

			      // Step 15.
		      var boardSocket = boardNameToBoardSocket[boardName];
		      
		      if (!boardSocket) {
			  // Step 16.
			  socket.emit('toPhoneOops', { msg : "Board not available" });
			  socket.disconnect();
			  return;
		      }
		      console.log("For " + boardName + " found " + 
				  boardSocket.id);

		      // Step 17.
		      var chosenColor = null;
		      for (var i = 0; i < colorsAvailable.length; i++) {
			  var curColor = colorsAvailable[i];
			  if (curColor in colorToPhoneSocket) {
			      continue;
			  }
			  chosenColor = curColor;
			  break;
		      } 
		      
		      if (chosenColor) {
			  var userReadyMsg = { 
			      color : chosenColor
			  }
			  // Step 19.
			  socket.emit('toPhoneYourColorIs', userReadyMsg);
			  boardSocket.emit('toBoardHeadsUp', userReadyMsg);
			  colorToPhoneSocket[curColor] = socket;
			  phoneToBoard[socket.id] = boardSocket;
		      } else {
			  // Step 18.
			  socket.emit('toPhoneOops', 
				      { msg : 'Too many users' });
		      }
		      logCurrentState();
		  }

		  function onBoardFlyerDragged(data) {
		      // 
		      var boardName = findBoardNameForSocket(socket);
		      console.log('onBoardFlyerDragged from ' + boardName);
		      var flyerId = data.flyerId;
		      var flyerHtml = data.flyerHtml;
		      var flyerJsonObj = data.flyerJsonObj;
		      var flyerJsonStr = data.flyerJsonStr;
		      var color = data.color;
		      console.log("flyerJsonStr: " + flyerJsonStr);
		      console.log("flyerJsonObj: " + flyerJsonObj);
		      var msg = { flyerId : flyerId,
				  flyerHtml : flyerHtml,
				  flyerJsonStr : flyerJsonStr,
				  flyerJsonObj : flyerJsonObj
				};
		      
		      // Step 23.
		      var phoneSocket = null;
		      console.log("MULTICOLOR: " + MULTICOLOR);
		      if (MULTICOLOR) {
			  phoneSocket = colorToPhoneSocket[color];
			  // Step 24.
			  console.log("For " + color + " found " + phoneSocket.id);
			  if (!phoneSocket) {
			      console.log("No device found for color " + color);
			      return;
			  } 
			  phoneSocket.emit('toPhoneGetAd', msg);
			  socket.emit('toBoardRemoveArrow', { color : color});
		      } else {
			  var phoneSockets = findPhonesForBoard(boardName);
			  console.log("Found " + phoneSockets.length + " devices for " + boardName);
			  for (var i = 0; i < phoneSockets.length; i++) {
			      var phoneSocket = phoneSockets[i];
			      console.log("Sending to " + phoneSocket.id);
			      phoneSocket.emit('toPhoneGetAd', msg);
			  }
		      }
		      logCurrentState();
		  }

		  function onDisconnect() {
		      console.log("Disconnect received from " + socket.id);

		      // Step 29.
		      for (var boardName in boardNameToBoardSocket) {
			  var boardSocket = boardNameToBoardSocket[boardName];
			  if (socket == boardSocket) {
			      boardWentAway(boardName);
			  }
		      }

		      // Step 30.
		      for (var color in colorToPhoneSocket) {
			  var phoneSocket = colorToPhoneSocket[color];
			  if (socket == phoneSocket) {
			      console.log("Disconnecting " + socket.id);
			      var boardSocket = phoneToBoard[phoneSocket.id];
			      console.log("Sending message to remove  " + 
					  color + " from board " + boardSocket.id);
			      boardSocket.emit('toBoardRemoveArrow', { color : color});
			      console.log("[onDisconnect] Removing " + 
					  phoneSocket.id + 
					  " from phoneToBoard");
			      delete phoneToBoard[phoneSocket.id];
			      console.log("Deleting " + 
					  color + 
					  " from colorToPhonesocket");
			      delete colorToPhoneSocket[color];
			      break;
			  }
		      }
		      delete sockets[socket.id];
		      logCurrentState();
		  }
		  
		  socket.on('phoneHi', onPhoneHi);
		  socket.on('phoneConnectTo', onPhoneConnectTo);

		  socket.on('boardHi', onBoardHi);
		  socket.on('boardFlyerDragged', onBoardFlyerDragged);

		  socket.on('disconnect', onDisconnect);

	      });

