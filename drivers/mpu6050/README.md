spice/drivers/mpu6050
================

6-axis IMU driver.

port from [ros2jsguy/mpu6050-motion-data](https://github.com/ros2jsguy/mpu6050-motion-data)

Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/drivers/mpu6050/manifest.json",
```

### usage
```javascript
import MPU6050 from 'spice/drivers/mpu6050'

const imu = new MPU6050({
	data: device.I2C.default.data,
	clock: device.I2C.default.clock,
	hz: 400_000,
})

imu.reset()
imu.initialize()
imu.fetch()
trace('MPU6050 Device\n')
trace('     connected: ', imu.testConnection(), '\n')
trace('            id: 0x', imu.deviceID.toString(16), '\n')
trace('    clock rate: ', imu.rate, '\n')
trace(' templature(C): ', imu.temp, '\n')
trace(' sleep: ', imu.sleepEnabled, '\n')

// if use raw pitch/roll
System.setInterval(() => {
    imu.fetch()
    trace(imu.pitch | 0, ' ' , imu.roll | 0, '\n')
}, 100)
```

### usage with dmp
```javascript
trace('\n', 'DMP initialize...', '\n')
imu.dmpInitialize()
imu.interruptWatch(23/* interrupt gpio pin number */, () => {
    const {pitch, yaw, roll} = imu.dmpYawPitchRoll(gravity, true)
    const format = (v: number) => (v|0).toString().padStart(5)
    trace(
        ' pitch: ', format(pitch), 
        ' yaw: ',   format(yaw), 
        ' roll: ',  format(roll),
        '\n'
    )
})


```