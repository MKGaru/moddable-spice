spice/system/sleep
================

power safe utility for esp32.

Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/system/sleep/manifest.json"
```

api
----------------

```typescript

// deep sleep infinity
Sleep.deep()

// deep sleep with wakeup timer (msec)
Sleep.deep(msec: number)

// light sleep inifnity
Sleep.light()

// light sleep with wakeup timer (msec)
Sleep.light(msec: number)

// wakeup on gpio (see: https://lastminuteengineers.com/esp32-pinout-reference/#esp32-rtc-gpio-pins)
Sleep.enableExt0Wakeup(pin: number, level: 0|1)

// wakeup on gpio
Sleep.enableExt1Wakeup(pin: number, level: 0|1)

// get wakeup reason [2: ext0, 3: ext1, 4: timer, 5: touchpad, 6: ulp]
Sleep.getWakeupCause()

// set slow memory (example)
Sleep.status = 123

// get slow memory (example)
trace(Sleep.status)
```


example
-----------------

```javascript
import { Sleep } from 'spice/system/sleep'

trace('reason:', Sleep.getWakeupCause(), ' count:', Sleep.status++, '\n')

// wakeup when GPIO0 low (boot button pushed)
Sleep.enableExt0Wakeup(0, 0)
// deep sleep 10seconds.
Sleep.deep(10 * 1000)

// deep sleep will restart after wakeup.
trace('never execute')
```


refs
------------------
* [moddable/modules/io/system](https://github.com/Moddable-OpenSource/moddable/blob/public/modules/io/system/) for esp8266
* [moddable/modules/base/sleep](https://github.com/Moddable-OpenSource/moddable/tree/public/modules/base/sleep/) for gecko
