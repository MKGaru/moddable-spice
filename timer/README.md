spice/timer
================

Partial [System](https://github.com/Moddable-OpenSource/moddable/blob/public/modules/io/system/system.js) timers function. (setTimeout, clearTimeout, setInterval, and clearInterval)


Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/timer/manifest.json"
```

```javascript
import Timer from 'spice/timer'

Timer.setInterval(() => {
    // do
}, 100)
```
