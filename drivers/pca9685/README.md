spice/drivers/pca9685
================
<img src="https://images-fe.ssl-images-amazon.com/images/I/61Bcirj7skL.__AC_SY445_SX342_QL70_ML2_.jpg" align="right">

PCA9685 / 12bit 16Ch PWM driver.

port from [Adafruit-PWM-Servo-Driver-Library](https://github.com/adafruit/Adafruit-PWM-Servo-Driver-Library)

Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/drivers/pca9685/manifest.json",
```

### usage
```javascript
import timer from 'timer'
import PCA9685 from 'spice/drivers/pca9685'

const pwm = new PCA9685({
	data: device.I2C.default.data,
	clock: device.I2C.default.clock,
	hz: 400_000,
})

pwm.begin()
pwm.setOscillatorFrequency(25_000_000)
pwm.setPWMFreq(50) // Analog servos run at ~50 Hz updates

System.setInterval(() => {
    // write 500us pulse to ch0 
    pwm.writeMicroseconds(0, 500)
    timer.delay(1000)
    // write 2400us pulse to ch0
    pwm.writeMicroseconds(0, 2500)
    timer.delay(1000)
}, 5000)
```
