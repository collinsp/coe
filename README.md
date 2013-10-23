coe
===

Collaborative Online Editor

What is this?
=================================
This is an experiment to see if a collaboarative online editor can be created using technologies: node.js, express, socket.io, googlediff, and the CKEditor.

Does it work?
=================================
Yes as a proof of concept. It would take work and testing to put this to use in a production env.

How does it work?
=================================
A page is loaded with a ckeditor. A web socket is established to a node.js process using socket.io. Client side javascript then listens for changes made in the ckeditor. After 1 sec of no change in the editor, the client side javascript gets the current contents from the CKEditor and does a diff against the last server state of the doc. It then sends this diff to the server using a web socket. The server then checks to see if the version matches, and applies the diff. If the version does not match, the server simply asks the client to try again. After each diff is processed on the server, the server broadcasts the diff to all other clients. Clients first create a local patch between the last server state and the current doc state. It then applies the diff it got from the server, and increments its version. Lastly, the client applies the local patch.

I like this approach because it puts all the complexities of patching on the clients. The diffs tend to be very small, and are easily applied on the server.

What could be better
=================================
Currently, after a diff is applied from the server, the local CKEditor resets the value. This can lead to some weird scrolling issues if another user deletes a section of a document before the part you are editing.

Applying the diffs directly to the data inside the CKEditor may be more efficient.

Installation Instructions
=================================
#  Download and install node.js from http://nodejs.org/

# install deps
npm install

# run app
node.js app.js

# open some web browser
http://localhost:3000
