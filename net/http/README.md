spice/net/http
================

A simple http router.

fork from [jmhdez/minimal-router](https://github.com/jmhdez/minimal-router).

Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/net/http/manifest.json"
```

### usage for serve static files.
```javascript
import { HttpServer } from 'http-server'
import Resource from 'Resource'

const server = new HttpServer()

server.get('/', () => {
	return new Resource('index.html')
})


const staticFiles = [
	'style.css'
]
for (const path of staticFiles) {
	server.get('/' + path, () => new Resource(path))
}
```

and manifest.json (** !exclude file extension! **)

```json
"data": {
	"*": [
		"./index",
		"./style"
	]
}
```

see original document: https://github.com/jmhdez/minimal-router#usage


### usage with websockets

```typescript
import { HttpServer } from 'http-server'
import Resource from 'Resource'
import {Server as WebsocketsServer} from 'websocket'

const server = new HttpServer()

server.get('/', () => {
	return new Resource('index.html')
})

const websockets = new WebsocketsServer({port: null}) as WebsocketsServer & { attach: (socket: unknown) => unknown }
websockets.callback = function (message, value) {
	switch (message) {
		case WebsocketsServer.connect:
			trace("ws connect\n")
			break

		case WebsocketsServer.handshake:
			trace("ws handshake\n")
			break

		case WebsocketsServer.receive: {
			trace(`ws message received: ${value}\n`)
			break
		}

		case WebsocketsServer.disconnect: {
			trace("ws close\n")
			break
		}
	}
};

// attach websocket endpoint
server.websockets['/ws'] = websockets

```
