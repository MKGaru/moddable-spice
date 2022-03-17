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
option: number     servo pwm gpio pin number
option.min: number servo min pulse width msec
option.min.angle: number servo min angle degree
