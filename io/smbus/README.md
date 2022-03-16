spice/io/smbus
================

bitWriter / bitReader extends io/smbus

port from [ros2jsguy's i2c-helper](https://github.com/ros2jsguy/mpu6050-motion-data/blob/main/src/i2c-helper.ts)

Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/io/smbus/manifest.json"
```

```javascript
import SMBus from 'spice/io/smbus'

class CustomDeviceDriver {
    #io: SMBus

    constructor(options) {
        this.#io = new SMBus(options)
    }

    get deviceID() {
        return this.#io.readBits(Register.WHO_AM_I, 6, 6)
    }
}
```
