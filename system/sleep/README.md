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

// wakeup on rtc-pins
Sleep.enableExt0Wakeup(pin: number, level: 0|1)

// Enable wakeup using multiple rtc-pins 0: All Low,  1: Any High
Sleep.enableExt1Wakeup(bitmask: number, mode: 0|1)

// Set power down mode for an RTC power domain in sleep mode
Sleep.setSleepPdConfig(domain, option)

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
import { Sleep, SleepPdDomain, SleepPdOption } from 'spice/system/sleep'

trace('reason:', Sleep.getWakeupCause(), ' count:', Sleep.status++, '\n')

// wakeup when GPIO0 low (boot button pushed)
Sleep.enableExt0Wakeup(0, 0)
// power off rtc-fast-memory in sleep mode.
Sleep.setSleepPdConfig(SleepPdDomain.RTCFastMem, SleepPdOption.OFF)
// deep sleep 10seconds.
Sleep.deep(10 * 1000)

// deep sleep will restart after wakeup.
trace('never execute')
```


refs
------------------
* [moddable/modules/io/system](https://github.com/Moddable-OpenSource/moddable/blob/public/modules/io/system/) for esp8266
* [moddable/modules/base/sleep](https://github.com/Moddable-OpenSource/moddable/tree/public/modules/base/sleep/) for gecko
