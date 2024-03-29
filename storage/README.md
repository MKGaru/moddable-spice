spice/storage
================

A drop-in substitute for the browser native localStorage API that runs on moddable.

inspired by [node-localstorage](https://github.com/lmaccherone/node-localstorage).

Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/storage/manifest.json"
```

### usage for default namespace.
```javascript
import localStorage from 'spice/storage'

localStorage.setItem('key', 'value')
localStorage.getItem('key')
localStorage.removeItem('key')
```
### usage for custom namespace.
```javascript
import { Storage } from 'spice/storage'
const userStorage = new Storage('user')

userStorage.setItem('key', 'value')
userStorage.getItem('key')
userStorage.removeItem('key')
```

Hint
--------------------
btw did you know [native preference class](https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/files/files.md#class-preference)?  

