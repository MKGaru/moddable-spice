spice/io/servo
================
simple servo driver


Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/io/servo/manifest.json"
```

```javascript
import Servo from 'spice/io/servo'

const servo = new Servo(33)

servo.write(90)
```

Servo Options
----------------

```javascript
new Servo(33) // simple servo pwm gpio pin number

new Servo({
  pin: 33, // gpio pin numger
  min: 500, // min pulse width msec
  max: 2400, //max pluse width msec
})

new Servo({
  pin: 33, // gpio pin numger
  min: {
    pluse: 500, // min pulse width msec
    angle: 0,   // min angle degree
  },
  max: {
    pluse: 2400, // max pulse width msec
    angle: 180,   // max angle degree
  },
  offset: 0, // offset angle degree
})
```

