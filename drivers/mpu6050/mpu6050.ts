/** port from: https://github.com/ros2jsguy/mpu6050-motion-data/blob/main/src/mpu6050.ts */

/** ============================================
I2Cdev device library code is placed under the MIT license
Copyright (c) 2012 Jeff Rowberg
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
===============================================
*/

import Digital from 'embedded:io/digital'
import { SMBusOptions } from 'embedded:io/smbus'
import SMBus, { type Byte, type Bit, type Bits } from 'spice/io/smbus'
import Resource from 'Resource'
import Timer from 'timer'

type PartialOptions<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export interface GyroAccelerometerOptions extends SMBusOptions {

}

type Quaternion = {
	x: number,
	y: number,
	z: number,
	w: number,
}

type Vector3 = {
	x: number,
	y: number,
	z: number,
}

type Euler = {
	x: number,
	y: number,
	z: number,
}

const Register = Object.freeze({
	XA_OFFS: 0x06,
	XG_OFFS: 0x13,

	SMPLRT_DIV: 0x19,
	CONFIG: 0x1A,
	GYRO_CONFIG: 0x1B,
	ACCEL_CONFIG: 0x1C,
	FIFO_EN: 0x23,

	INT_PIN_CFG: 0x37,
	INT_ENABLE: 0x38,
	INT_STATUS: 0x3A,

	ACCEL_OUT: 0x3B,
	TEMP_OUT: 0x41,
	GYRO_OUT: 0x43,
	
	USER_CTRL: 0x6A,
	PWR_MGMT_1: 0x6B,
	
	BANK_SEL: 0x6D,
	MEM_START_ADDR: 0x6E,
	MEM_R_W: 0x6F,
	FIFO_COUNT: 0x72,
	FIFO_RW: 0x74,
	WHO_AM_I: 0x75
} as const)

const ClockSource = Object.freeze({
	INTERNAL    : 0x00,
	PLL_XGYRO   : 0x01,
	PLL_YGYRO   : 0x02,
	PLL_ZGYRO   : 0x03,
	PLL_EXT32K  : 0x04,
	PLL_EXT19M  : 0x05,
	KEEP_RESET  : 0x07,
} as const)

const AccelFsRange = Object.freeze({
	FS_2: 0x00,
	FS_4: 0x01,
	FS_8: 0x02,
	FS_16: 0x03,
} as const)

const GyroFsRange = Object.freeze({
	FS_250: 0x00,
	FS_500: 0x01,
	FS_1000: 0x02,
	FS_2000: 0x03,
} as const)

const GYRO_SCALER = (1 / 131) //Datasheet Section 6.1
const ACCEL_SCALER = (1 / 16384) //Datasheet Section 6.2
const TEMP_SCALER = (1 / 340)
const RAD_TO_DEG = (360 / (2 * Math.PI))

const DMP_MEMORY_CHUNK_SIZE = 16

type ValueOf<T extends object> = T[keyof T]

class GyroAccelerometer {
	#io: SMBus<ValueOf<typeof Register>>
	#interruptIo?: Digital
	#view: {
		accel: DataView,
		temp: DataView,
		gyro: DataView,
	}
	#memory: ArrayBuffer
	#dmpMemory: ArrayBuffer

	constructor(_options: PartialOptions<GyroAccelerometerOptions, 'address'>) {
		const options: GyroAccelerometerOptions = Object.assign({
			address: 0x68,
		}, _options)
		this.#io = new SMBus(options)

		const dmpMemory = new ArrayBuffer(
			16 + // DMP_FEATURE_6X_LP_QUAT
			6 +  // DMP_FEATURE_SEND_RAW_ACCEL
			6    // DMP_FEATURE_SEND_RAW_GYRO
		)
		this.#dmpMemory = dmpMemory
		
		const alloc = (() => {
			let pos = 0
			return (size = 0) => {
				const from = pos
				pos += size | 0
				return [from, size]
			}
		})()
	
		const [accelPos, accelSize] = alloc(2 * 3)
		const [tempPos, tempSize] = alloc(2)
		const [gyroPos, gyroSize] = alloc(2 * 3)
	
		const memory = new ArrayBuffer( alloc()[0] )
		this.#memory = memory
		
		const view = Object.freeze({
			accel: new DataView(memory, accelPos, accelSize),
			temp: new DataView(memory, tempPos, tempSize),
			gyro: new DataView(memory, gyroPos, gyroSize),
		})
		this.#view = view

		const dmpView = Object.freeze({
			accel: new DataView(dmpMemory, 16, 2 * 3),
			gyro:  new DataView(dmpMemory, 22, 2 * 3),
			quaternion: new DataView(dmpMemory, 0),
		})

		const accel = Object.freeze({
			get x() {
				return view.accel.getInt16(2 * 0, false) * ACCEL_SCALER
			},
			get y() {
				return view.accel.getInt16(2 * 1, false) * ACCEL_SCALER
			},
			get z() {
				return view.accel.getInt16(2 * 2, false) * ACCEL_SCALER
			}
		})
	
		const gyro = Object.freeze({
			get x() {
				return view.gyro.getInt16(2 * 0, false) * GYRO_SCALER
			},
			get y() {
				return view.gyro.getInt16(2 * 1, false) * GYRO_SCALER
			},
			get z() {
				return view.gyro.getInt16(2 * 2, false) * GYRO_SCALER
			}
		})

		const dmpAccel = Object.freeze({
			get x() {
				return dmpView.accel.getInt16(2 * 0, false) * ACCEL_SCALER
			},
			get y() {
				return dmpView.accel.getInt16(2 * 1, false) * ACCEL_SCALER
			},
			get z() {
				return dmpView.accel.getInt16(2 * 2, false) * ACCEL_SCALER
			}
		})
	
		const dmpGyro = Object.freeze({
			get x() {
				return dmpView.gyro.getInt16(2 * 0, false) * GYRO_SCALER
			},
			get y() {
				return dmpView.gyro.getInt16(2 * 1, false) * GYRO_SCALER
			},
			get z() {
				return dmpView.gyro.getInt16(2 * 2, false) * GYRO_SCALER
			}
		})

		const dmpQuaternion = Object.freeze({
			get x() {
				return dmpView.quaternion.getInt32(4, false)
			},
			get y() {
				return dmpView.quaternion.getInt32(8, false)
			},
			get z() {
				return dmpView.quaternion.getInt32(12, false)
			},
			get w() {
				return dmpView.quaternion.getInt32(0, false)
			}
		})

		Object.defineProperties(this, {
			accel: { value: accel, enumerable: true },
			gyro: { value: gyro, enumerable: true },
			dmpAccel: { value: dmpAccel, enumerable: true },
			dmpGyro: { value: dmpGyro, enumerable: true },
			dmpQuaternion: { value: dmpQuaternion, enumerable: true },
		})
	}

	/**
	 * Power on and prepare for general usage.
	 * This will activate the device and take it out of sleep mode (which must be done
	 * after start-up). This function also sets both the accelerometer and the gyroscope
	 * to their most sensitive settings, namely +/- 2g and +/- 250 degrees/sec, and sets
	 * the clock source to use the X Gyro for reference, which is slightly better than
	 * the default internal clock source.
	 */
	initialize() {
		this.clockSource = ClockSource.PLL_ZGYRO
		this.fullScaleGyroRange = GyroFsRange.FS_250
		this.fullScaleAccelRange = AccelFsRange.FS_2
		this.sleepEnabled = false

		Timer.delay(100)
	}

	/**
	 * Terminate communications with the MPU6050 chip.
	 * Includes disabling DMP, FSync interrupt and DataReady interrupt.
	 */
	close(): void {
		this.dmpEnabled = false
		this.fsyncInterruptEnabled = false
		this.interruptDataReadyEnabled = false

		this.#io.close()
		if (this.#interruptIo) this.#interruptIo.close()
	}

	/**
	 * Get Device ID.
	 * This register is used to verify the identity of the device (0b110100, 0x34).
	 * @returns Devices ID (6 bits only! should be 0x34)
	 */
	get deviceID() {
		return this.#io.readBits(Register.WHO_AM_I, 6, 6)
	}

	/**
	 * Verify the I2C connection.
	 * Make sure the device is connected and responds as expected.
	 * @returns True if connection is valid, false otherwise
	 */
	testConnection() {
		return this.deviceID === 0x34
	}

	/**
	 * Trigger a full device reset.
	 * A small delay of ~50ms may be desirable after triggering a reset.
	 */
	reset() {
		this.#io.writeBit(Register.PWR_MGMT_1, 7, 1)
		Timer.delay(100)
	}

	/**
	 * Get sleep mode status.
	 * Setting the SLEEP bit in the register puts the device into very low power
	 * sleep mode. In this mode, only the serial interface and internal registers
	 * remain active, allowing for a very low standby current. Clearing this bit
	 * puts the device back into normal mode. To save power, the individual standby
	 * selections for each of the gyros should be used if any gyro axis is not used
	 * by the application.
	 * @returns Current sleep mode enabled status
	 */
	get sleepEnabled() {
		return this.#io.readBit(Register.PWR_MGMT_1, 6) === 1
	}

	/**
	 * Set sleep mode status.
	 * @param enabled New sleep mode enabled status
	 */
	set sleepEnabled(enabled: boolean) {
		this.#io.writeBit(Register.PWR_MGMT_1, 6, enabled);
	}

	/**
	 * Get clock source setting.
	 * @returns Current clock source setting
	 */
	get clockSource(): ValueOf<typeof ClockSource> {
		const clockSource = this.#io.readBits(Register.PWR_MGMT_1, 2, 3)
		if (clockSource == 6) throw new Error('Unknown clock source value: 6')
		return clockSource
	}

	/**
	 * Set clock source setting.
	 * An internal 8MHz oscillator, gyroscope based clock, or external sources can
	 * be selected as the MPU-60X0 clock source. When the internal 8 MHz oscillator
	 * or an external source is chosen as the clock source, the MPU-60X0 can operate
	 * in low power modes with the gyroscopes disabled.
	 *
	 * Upon power up, the MPU-60X0 clock source defaults to the internal oscillator.
	 * However, it is highly recommended that the device be configured to use one of
	 * the gyroscopes (or an external clock source) as the clock reference for
	 * improved stability. The clock source can be selected according to the following table:
	 *
	 * <pre>
	 * CLK_SEL | Clock Source
	 * --------+--------------------------------------
	 * 0       | Internal oscillator
	 * 1       | PLL with X Gyro reference
	 * 2       | PLL with Y Gyro reference
	 * 3       | PLL with Z Gyro reference
	 * 4       | PLL with external 32.768kHz reference
	 * 5       | PLL with external 19.2MHz reference
	 * 6       | Reserved
	 * 7       | Stops the clock and keeps the timing generator in reset
	 * </pre>
	 *
	 * @param source New clock source setting
	 */
	set clockSource(source: ValueOf<typeof ClockSource>) {
		this.#io.writeBits(Register.PWR_MGMT_1, 2, 3,  source)
	}

	/** Get gyroscope output rate divider.
	 * The sensor register output, FIFO output, DMP sampling, Motion detection, Zero
	 * Motion detection, and Free Fall detection are all based on the Sample Rate.
	 * The Sample Rate is generated by dividing the gyroscope output rate by
	 * SMPLRT_DIV:
	 *
	 * Sample Rate = Gyroscope Output Rate / (1 + SMPLRT_DIV)
	 *
	 * where Gyroscope Output Rate = 8kHz when the DLPF is disabled (DLPF_CFG = 0 or
	 * 7), and 1kHz when the DLPF is enabled (see Register 26).
	 *
	 * Note: The accelerometer output rate is 1kHz. This means that for a Sample
	 * Rate greater than 1kHz, the same accelerometer sample may be output to the
	 * FIFO, DMP, and sensor registers more than once.
	 *
	 * For a diagram of the gyroscope and accelerometer signal paths, see Section 8
	 * of the MPU-6000/MPU-6050 Product Specification document.
	 *
	 * @returns Current sample rate
	 */
	get rate() {
		return this.#io.readByte(Register.SMPLRT_DIV)
	}

	/**
	 * Set gyroscope sample rate divider.
	 * @param rate New sample rate divider
	 */
	set rate(rate: number) {
		this.#io.writeByte(Register.SMPLRT_DIV, rate)
	}

	/**
	 * Get full-scale gyroscope range.
	 * The FS_SEL parameter allows setting the full-scale range of the gyro sensors,
	 * as described in the table below.
	 *
	 * <pre>
	 * 0 = +/- 250 degrees/sec
	 * 1 = +/- 500 degrees/sec
	 * 2 = +/- 1000 degrees/sec
	 * 3 = +/- 2000 degrees/sec
	 * </pre>
	 *
	 * @returns Current full-scale gyroscope range setting
	 */
	get fullScaleGyroRange(): ValueOf<typeof GyroFsRange> {
		return this.#io.readBits(Register.GYRO_CONFIG, 4, 2)
	}
	
	/**
	 * Set full-scale gyroscope range.
	 * @param range New full-scale gyroscope range value
	 * @see getFullScaleRange()
	 */
	set fullScaleGyroRange(range: ValueOf<typeof GyroFsRange>) {
		this.#io.writeBits(Register.GYRO_CONFIG, 4, 2, range)
	}

	/**
	 * Get full-scale accelerometer range.
	 * The FS_SEL parameter allows setting the full-scale range of the accelerometer
	 * sensors, as described in the table below.
	 *
	 * <pre>
	 * 0 = +/- 2g
	 * 1 = +/- 4g
	 * 2 = +/- 8g
	 * 3 = +/- 16g
	 * </pre>
	 *
	 * @returns Current full-scale accelerometer range setting
	 */
	get fullScaleAccelRange(): ValueOf<typeof AccelFsRange> {
		return this.#io.readBits(Register.ACCEL_CONFIG, 4, 2)
	}
	
	/**
	 * Set full-scale accelerometer range.
	 * @param range New full-scale accelerometer range setting
	 * @see getFullScaleAccelRange()
	 */
	set fullScaleAccelRange(range: ValueOf<typeof AccelFsRange>) {
		this.#io.writeBits(Register.ACCEL_CONFIG, 4, 2, range)
	}

	/**
	 * Get accelerometer FIFO enabled value.
	 * When set to 1, this bit enables ACCEL_XOUT_H, ACCEL_XOUT_L, ACCEL_YOUT_H,
	 * ACCEL_YOUT_L, ACCEL_ZOUT_H, and ACCEL_ZOUT_L (Register 59 to 64) to be
	 * written into the FIFO buffer.
	 * @returns Current accelerometer FIFO enabled value
	 */
	get accelFIFOEnabled() {
		return this.#io.readBit(Register.FIFO_EN, 3) === 1
	}
	
	/**
	 * Set accelerometer FIFO enabled value.
	 * @param enabled New accelerometer FIFO enabled value
	 */
	set accelFIFOEnabled(enabled: boolean) {
		this.#io.writeBit(Register.FIFO_EN, 3, enabled)
	}
	
	/**
	 * Get gyroscope X-axis FIFO enabled value.
	 * When set to 1, this bit enables GYRO_XOUT_H and GYRO_XOUT_L (Register 67 and
	 * 68) to be written into the FIFO buffer.
	 * @returns Current gyroscope X-axis FIFO enabled value
	 * @see MPU6050_RA_FIFO_EN
	 */
	get xGyroFIFOEnabled() {
		return this.#io.readBit(Register.FIFO_EN, 6) === 1
	}
	
	/**
	 * Set gyroscope X-axis FIFO enabled value.
	 * @param enabled New gyroscope X-axis FIFO enabled value
	 * @see getXGyroFIFOEnabled()
	 * @see MPU6050_RA_FIFO_EN
	 */
	set xGyroFIFOEnabled(enabled: boolean) {
		this.#io.writeBit(Register.FIFO_EN, 6, enabled)
	}
	
	/**
	 * Get gyroscope Y-axis FIFO enabled value.
	 * When set to 1, this bit enables GYRO_YOUT_H and GYRO_YOUT_L (Register 69 and
	 * 70) to be written into the FIFO buffer.
	 * @returns Current gyroscope Y-axis FIFO enabled value
	 * @see MPU6050_RA_FIFO_EN
	 */
	get yGyroFIFOEnabled() {
		return this.#io.readBit(Register.FIFO_EN, 5) === 1
	}
	
	/**
	 * Set gyroscope Y-axis FIFO enabled value.
	 * @param enabled New gyroscope Y-axis FIFO enabled value
	 */
	set yGyroFIFOEnabled(enabled: boolean) {
		this.#io.writeBit(Register.FIFO_EN, 5, enabled)
	}
	
	/**
	 * Get gyroscope Z-axis FIFO enabled value.
	 * When set to 1, this bit enables GYRO_ZOUT_H and GYRO_ZOUT_L (Register 71 and
	 * 72) to be written into the FIFO buffer.
	 * @returns Current gyroscope Z-axis FIFO enabled value
	 */
	get zGyroFIFOEnabled() {
		return this.#io.readBit(Register.FIFO_EN, 4) === 1
	}
	
	/**
	 * Set gyroscope Z-axis FIFO enabled value.
	 * @param enabled New gyroscope Z-axis FIFO enabled value
	 */
	set zGyroFIFOEnabled(enabled: boolean) {
		this.#io.writeBit(Register.FIFO_EN, 4, enabled)
	}
	
	/**
	 * Get interrupt logic level mode.
	 * Will be set 0 for active-high, 1 for active-low.
	 * @returns Current interrupt mode (0=active-high, 1=active-low)
	 */
	get interruptMode(): Bit {
		return this.#io.readBit(Register.INT_PIN_CFG, 7)
	}
	
	/** 
	 * Set interrupt logic level mode.
	 * @param mode New interrupt mode (0=active-high, 1=active-low)
	 */
	set interruptMode(mode: Bit) {
		this.#io.writeBit(Register.INT_PIN_CFG, 7, mode)
	}
	
	/**
	 * Get the latch mode of the interrupt pin.
	 * @returns true if interrupt pin remains active until cleared; otherwise interrupt pin emits 50 us pulse
	 */
	get interruptLatchEnabled() {
		return this.#io.readBit(Register.INT_PIN_CFG, 5) === 1
	}
	
	/**
	 * Enable or disable latch mode on the interrupt pin
	 * @param enabled - when true if interrupt pin remains active until cleared; otherwise interrupt pin emits 50 us pulse 
	 */
	set interruptLatchEnabled(enabled: boolean) {
		this.#io.writeBit(Register.INT_PIN_CFG, 5, enabled)
	}

	/**
	 * Get the interrupt pin clearing mode.
	 * @returns 1 if interrupt pin is cleared on any data read; 0 if interrput pin is clearer only by reading the interrupt status register
	 */
	get interruptClearMode(): Bit {
		return this.#io.readBit(Register.INT_PIN_CFG, 4) ? 1 : 0
	}
	
	/**
	 * Specify if interrupt pin is cleared
	 * @param mode - 1 clears interrupt pin on any data read; 0 clears interrupt pin only by reading the interrupt status register
	 */
	set interruptClearMode(mode: Bit) {
		this.#io.writeBit(Register.INT_PIN_CFG, 4, mode)
	}
	
	/** 
	 * Get interrupt register byte.
	 * Full register byte for all interrupts, for quick reading. Each bit will be
	 * set 0 for disabled, 1 for enabled.
	 * @returns Current interrupt register byte
	 */
	get interruptRegister() {
		return this.#io.readByte(Register.INT_ENABLE) as Byte
	}
	
	/**
	 * Set full interrupt enabled status.
	 * Full register byte for all interrupts, for quick reading. Each bit should be
	 * set 0 for disabled, 1 for enabled.
	 * @param byte - New interrupts byte
	 */
	set interruptRegister(byte: Byte) {
		this.#io.writeByte(Register.INT_ENABLE, byte)
	}
	
	/** 
	 * Get FSYNC pin interrupt enabled setting.
	 * Will be set 0 for disabled, 1 for enabled.
	 * @returns Current interrupt enabled setting
	 */
	get fsyncInterruptEnabled(): boolean {
		return this.#io.readBit(Register.INT_PIN_CFG, 2) !== 0
	}
	
	/**
	 * Set FSYNC pin interrupt enabled setting.
	 * @param enabled New FSYNC pin interrupt enabled setting
	 */
	set fsyncInterruptEnabled(enabled: boolean) {
		this.#io.writeBit(Register.INT_PIN_CFG, 2, enabled)
	}
	
	/**
	 * Get Data Ready interrupt enabled setting.
	 * This event occurs each time a write operation to all of the sensor registers
	 * has been completed. Will be set 0 for disabled, 1 for enabled.
	 * @returns Current interrupt enabled status
	 */
	get interruptDataReadyEnabled() {
		return this.#io.readBit(Register.INT_ENABLE, 0) === 1
	}
	
	/**
	 * Set Data Ready interrupt enabled status.
	 * @param enabled New interrupt enabled status
	 */
	set interruptDataReadyEnabled(enabled: boolean) {
		this.#io.writeBit(Register.INT_ENABLE, 0, enabled)
	}
	
	
	/**
	 * Get Data Ready interrupt enabled setting.
	 * This event occurs each time a write operation to all of the sensor registers
	 * has been completed. Will be set 0 for disabled, 1 for enabled.
	 * @returns Current interrupt enabled status
	 */
	get interruptDMPEnabled() {
		return this.#io.readBit(Register.INT_ENABLE, 1) === 1
	}
	
	/**
	 * Set DMP interrupt enabled status.
	 * @param enabled New interrupt enabled status
	 */
	set interruptDMPEnabled(enabled: boolean) {
		this.#io.writeBit(Register.INT_ENABLE, 1, enabled)
	}
	
	
	/**
	 * Get FIFO Buffer Overflow interrupt enabled status.
	 * Will be set 0 for disabled, 1 for enabled.
	 * @returns Current interrupt enabled status
	 */
	get gnterruptFIFOBufferOverflowEnabled() {
		return this.#io.readBit(Register.INT_ENABLE, 4) === 1
	}
	
	/**
	 * Set FIFO Buffer Overflow interrupt enabled status.
	 * @param enabled New interrupt enabled status
	 * @see getIntFIFOBufferOverflowEnabled()
	 * @see MPU6050.RA_INT_ENABLE
	 * @see MPU6050.INTERRUPT_FIFO_OFLOW_BIT
	 */
	set interruptFIFOBufferOverflowEnabled(enabled: boolean) {
		this.#io.writeBit(Register.INT_ENABLE, 4, enabled)
	}
	
	/**
	 * Get full set of interrupt status bits.
	 * These bits clear to 0 after the register has been read. Very useful
	 * for getting multiple INT statuses, since each single bit read clears
	 * all of them because it has to read the whole byte.
	 * @returns Current interrupt status
	 */
	get interruptStatus() {
		return this.#io.readByte(Register.INT_STATUS) as Byte
	}
	
	/**
	 * Get Data Ready interrupt status.
	 * This bit automatically sets to 1 when a Data Ready interrupt has been
	 * generated. The bit clears to 0 after the register has been read.
	 * @returns Current interrupt status
	 */
	get interruptDataReadyStatus(): boolean {
		return this.#io.readBit(Register.INT_STATUS, 0) === 1
	}
	
	/**
	 * Get FIFO enabled status.
	 * When this bit is set to 0, the FIFO buffer is disabled. The FIFO buffer
	 * cannot be written to or read from while disabled. The FIFO buffer's state
	 * does not change unless the MPU-60X0 is power cycled.
	 * @returns Current FIFO enabled status
	 */
	get fifoEnabled(): boolean {
		return this.#io.readBit(Register.USER_CTRL, 6) !== 0; 
	}
	
	/**
	 * Set FIFO enabled status.
	 * @param enabled New FIFO enabled status
	 */
	set fifoEnabled(enabled: boolean) {
		this.#io.writeBit(Register.USER_CTRL, 6, enabled)
	}
	
	/**
	 * Reset the FIFO.
	 * This bit resets the FIFO buffer when set to 1 while FIFO_EN equals 0. This
	 * bit automatically clears to 0 after the reset has been triggered.
	 */
	resetFIFO() {
		this.#io.writeBit(Register.USER_CTRL, 2, 1)
	}
	
	/**
	 * Get current FIFO buffer size.
	 * This value indicates the number of bytes stored in the FIFO buffer. This
	 * number is in turn the number of bytes that can be read from the FIFO buffer
	 * and it is directly proportional to the number of samples available given the
	 * set of sensor data bound to be stored in the FIFO (register 35 and 36).
	 * @returns Current FIFO buffer size
	 */
	get fifoCount(): number {
		const buf = this.#io.readBlock(Register.FIFO_COUNT, 2);
		return new DataView(buf).getUint16(0, false)
	}
	
	/**
	 * Returns bytes read from the FIFO buffer in a volitale buffer.
	 * 
	 * Bytes read from the FIFO buffer are returned in a volitale buffer, i.e.,
	 * the buffer is overwritten upon each FIFO read. Therefore you should copy
	 * any bytes for which you need to reference beyond the current FIFO read.
	 * 
	 * Data is written to the FIFO in order of register number (from lowest to highest).
	 * If all the FIFO enable flags (see below) are enabled and all External Sensor
	 * Data registers (Register 73 to 96) are associated with a Slave device, the
	 * contents of registers 59 through 96 will be written in order at the Sample
	 * Rate.
	 *
	 * The contents of the sensor data registers (Register 59 to 96) are written
	 * into the FIFO buffer when their corresponding FIFO enable flags are set to 1
	 * in FIFO_EN (Register 35). An additional flag for the sensor data registers
	 * associated with I2C Slave 3 can be found in I2C_MST_CTRL (Register 36).
	 *
	 * If the FIFO buffer has overflowed, the status bit FIFO_OFLOW_INT is
	 * automatically set to 1. This bit is located in INT_STATUS (Register 58).
	 * When the FIFO buffer has overflowed, the oldest data will be lost and new
	 * data will be written to the FIFO.
	 *
	 * If the FIFO buffer is empty, reading this register will return the last byte
	 * that was previously read from the FIFO until new data is available. The user
	 * should check FIFO_COUNT to ensure that the FIFO buffer is not read when
	 * empty.
	 *
	 * @returns volitale bytes from the FIFO buffer
	 */
	getFIFOBytes(length: number) {
		if (length != this.#dmpMemory.byteLength) {
			return this.#io.readBlock(Register.FIFO_RW, length) // trash bytes.
		}
		return this.#io.readBlock(Register.FIFO_RW, this.#dmpMemory/*.slice(0, length) #ArrayBuffer.slice is copy memory, not shared memory. */)
	}
	
	/**
	 * Read the 1st byte from the FIFO buffer.
	 * @returns A byte
	 */
	getFIFOByte(): number {
		return this.#io.readByte(Register.FIFO_RW)
	}
	
	/**
	 * 
	 * @returns The dlpf configuration setting
	 */
	get dlfp() {
		return this.#io.readBits(Register.CONFIG, 2, 3)
	}
	
	set dlfp(filterConfig: number) {
		this.#io.writeBits(Register.CONFIG, 2, 3, Math.max(0, Math.min(7, filterConfig)) as Bits<3>)
	}

	set offsets(
		[xAccelOffset, yAccelOffset, zAccelOffset, 
		xGyroOffset, yGyroOffset, zGyroOffset]: [
			number, number, number,
			number, number, number,
		]
	) {
		const buffer = new ArrayBuffer(2 * 3)
		const data = new DataView(buffer)
		
		data.setInt16(0, xAccelOffset, false)
		data.setInt16(2, yAccelOffset, false)
		data.setInt16(4, zAccelOffset, false)
		this.#io.writeBlock(Register.XA_OFFS, buffer)

		data.setInt16(0, xGyroOffset, false)
		data.setInt16(2, yGyroOffset, false)
		data.setInt16(4, zGyroOffset, false)
		this.#io.writeBlock(Register.XG_OFFS, buffer)
	}

	get offsets() {
		const offsetRegister = this.deviceID < 0x38 ? Register.XA_OFFS : 0x77
		const data = [0,0,0,0,0,0] as [number, number, number, number, number, number]
	
		if (offsetRegister === Register.XA_OFFS)	{
			const buf = this.#io.readBlock(offsetRegister, 6)
			const view = new DataView(buf)
			data[0] = view.getInt16(0, false)
			data[1] = view.getInt16(2, false)
			data[2] = view.getInt16(4, false)
		} else {
			data[0] = this.#io.readWord(offsetRegister, true)
			data[1] = this.#io.readWord(offsetRegister + 3, true)
			data[2] = this.#io.readWord(offsetRegister + 6, true)
		}
		
		const buf = this.#io.readBlock(Register.XG_OFFS, 6)
		const view = new DataView(buf)
		data[3] = view.getInt16(0, false)
		data[4] = view.getInt16(2, false)
		data[5] = view.getInt16(4, false)
		return data
	}
	
	/**
	 * Access the DMP enable/disable status.
	 * @returns true when enabled; false otherwise.
	 */
	get dmpEnabled() {
		return this.#io.readBit(Register.USER_CTRL, 7) === 1
	}
	
	/**
	 * Enable or disabled the DMP.
	 * @param enabled
	 */
	set dmpEnabled(enabled: boolean) {
		this.#io.writeBit(Register.USER_CTRL, 7, enabled)
	}
	
	/**
	 * Asynchronously reset DMP module. This bit auto clears after one clock cycle.
	 */
	resetDMP() {
		this.#io.writeBit(Register.USER_CTRL, 3, 1);
	}

	/**
	 * Initialize digital motion processing (DMP).
	 * 
	 * Upon completion the MPU6050 state is:
	 *   Full reset, All interrupts cleared.
	 *   Clock source = X-Gyro
	 *   Accelerometer Fullscale Range = 2g
	 *   Gyrometer Fullscale Range = +-2000 deg/sec
	 *   DMP Raw Data Interrupt enabled
	 *   Rate divider = 4
	 *   Load DMP program image
	 *   FIFO enabled & reset
	 *   Set clear interrupt on any read
	 *   DMP is disabled; To enable DMP call setDMPEnabled(true)
	 * 
	 * For detailed descriptins of all registers and there purpose google "MPU-6000/MPU-6050 Register Map and Descriptions"
	 */
	dmpInitialize() {
		this.reset()
		Timer.delay(100)

		this.#io.writeBits(Register.USER_CTRL, 2, 3, 0b111) // full SIGNAL_PATH_RESET: with another 100ms delay
		Timer.delay(100)
		
		this.sleepEnabled = false
		this.clockSource = ClockSource.PLL_XGYRO
		this.interruptRegister = 0x00 // 0000 0000 INT_ENABLE: no Interrupt
		this.#io.writeByte(0x23, 0x00); // 0000 0000 MPU FIFO_EN: (all off) Using DMP's FIFO instead
		
		this.fullScaleAccelRange = AccelFsRange.FS_2 // 0000 0000 ACCEL_CONFIG: 0 =  Accel Full Scale Select: 2g
		this.interruptClearMode = 1 // interrupt status bits are cleared on any read
	
		this.rate = 0x04 // 0000 0100 SMPLRT_DIV: Divides the internal sample rate 400Hz ( Sample Rate = Gyroscope Output Rate / (1 + SMPLRT_DIV))
		this.dlfp = 0x01 // 0000 0001 CONFIG: Digital Low Pass Filter (DLPF) Configuration 188HZ  //Im betting this will be the best

		// load dmp image
		this.#writeMemoryBlock(new Uint8Array(new Resource('DMP.bin'))) // Loads the DMP image into the MPU6050 Memory // Should Never Fail
		this.#io.writeWord(0x70, 0x0400, true) // DMP Program Start Address
		this.fullScaleGyroRange = GyroFsRange.FS_2000
		
		this.fifoEnabled = true
		this.resetFIFO()

		this.interruptDMPEnabled = true // 0000 0010 INT_ENABLE: RAW_DMP_INT_EN on
		this.resetFIFO();  // Reset FIFO one last time just for kicks. (MPUi2cWrite reads 0x6A first and only alters 1 bit and then saves the byte)
		this.dmpEnabled = false // disable DMP for compatibility with the MPU6050 library
	}

	#setMemoryStartAddress(address: number) {
		this.#io.writeByte(Register.MEM_START_ADDR, address)
	}

	#setMemoryBank(bank: number, prefetchEnabled = true, userBank = false) {
		let bnk = bank & 0x1F
		if (userBank) bnk |= 0x20
		if (prefetchEnabled) bnk |= 0x40
		this.#io.writeByte(Register.BANK_SEL, bnk)
	}

	#writeMemoryBlock(data: Uint8Array, bank = 0, address = 0, verify = true) {
		this.#setMemoryBank(bank)
		this.#setMemoryStartAddress(address)
		const dataSize = data.length
		let chunkSize = 0
		for (let i = 0; i < dataSize;) {
			chunkSize = DMP_MEMORY_CHUNK_SIZE
			if (i + chunkSize > dataSize) chunkSize = dataSize - i
			if (chunkSize > 256 - address) chunkSize = 256 - address
			this.#io.writeBlock(Register.MEM_R_W, data.slice(i, i + chunkSize))

			if (verify) {
				this.#setMemoryBank(bank)
				this.#setMemoryStartAddress(address)
				const buf = new ArrayBuffer(chunkSize)
				this.#io.readBlock(Register.MEM_R_W, buf)
				const view = new Uint8Array(buf)
				for (let k = 0; k < chunkSize; k++) {
					if (data[i + k] !== view[k]) {
						trace('Block write verification error, bank: ', bank, '#', k, '(', data[i + k], 'vs', view[k] ,')')
						return
					}
				}
			}

			i += chunkSize
			address += chunkSize
			if (address > 0xFF) address = 0
			if (i < dataSize) {
				if (address === 0) bank++
				this.#setMemoryBank(bank)
				this.#setMemoryStartAddress(address)
			}
		}
	}	

	/**
	 * Determine if a DMP packet of data is available in the FIFO buffer.
	 * @returns True when a package is ready to be read; false otherwise.
	 */
	dmpPacketAvailable() {
		return this.fifoCount >= this.dmpFIFOPacketSize
	}
	
	/**
	 * Get the size of a DMP FIFO packet
	 * @returns The packet size in bytes.
	 */
	get dmpFIFOPacketSize() {
		return this.#dmpMemory.byteLength
	}
	
	 /** Get latest byte from FIFO buffer no matter how much time has passed.
	 * ===                  GetCurrentFIFOPacket                    ===
	 * ================================================================
	 * Returns 1) when nothing special was done
	 *         2) when recovering from overflow
	 *         0) when no valid data is available
	 * ================================================================ */

	// I don't actually know how large this buffer is supposed to be, but
	// this seems like a good guess. This constant should properly be
	// defined elsewhere.
	// const FIFO_BUFFER_LENGTH = 32;

	async dmpGetCurrentFIFOPacket(): Promise<ArrayBuffer | undefined> { // overflow proof
		const FIFO_BUFFER_LENGTH = 32
		const length = this.dmpFIFOPacketSize
		let fifoC: number
		// This section of code is for when we allowed more than 1 packet to be acquired
		const breakTimer = Date.now()

		do {
			fifoC = this.fifoCount
			if (fifoC  > length) {

				if (fifoC > 200) { // if you waited to get the FIFO buffer to > 200 bytes it will take longer to get the last packet in the FIFO Buffer than it will take to  reset the buffer and wait for the next to arrive
					this.resetFIFO() // Fixes any overflow corruption
					fifoC = 0
					// eslint-disable-next-line no-cond-assign
					while (!(fifoC = this.fifoCount) && ((Date.now() - breakTimer) <= 11000)) {
						await new Promise(res => System.setTimeout(res, 0))
					} // Get Next New Packet

				} else { // We have more than 1 packet but less than 200 bytes of data in the FIFO Buffer
					// eslint-disable-next-line no-cond-assign
					while ((fifoC = this.fifoCount) > length) {  // Test each time just in case the MPU is writing to the FIFO Buffer
						fifoC -= length // Save the last packet
						let removeBytes = 0
						while (fifoC) { // fifo count will reach zero so this is safe
							removeBytes = Math.min(fifoC, FIFO_BUFFER_LENGTH) // Buffer Length is different than the packet length this will efficiently clear the buffer
							this.getFIFOBytes(removeBytes) // trash bytes
							fifoC -= removeBytes
						}
					}
				}
			}
			
			if (!fifoC) return undefined // Called too early no data or we timed out after FIFO Reset
			// We have 1 packet
			if ((Date.now() - breakTimer) > (11000)) return undefined
			
		} while (fifoC !== length)
		return this.getFIFOBytes(length) // Get 1 packet
	}

	/** get raw temp, accel, gyro data to device memory. */
	fetch() {
		this.#io.readBlock(Register.ACCEL_OUT, this.#memory)
	}

	get temp() {
		return this.#view.temp.getInt16(0, false) * TEMP_SCALER + 36.53
	}

	readonly accel: Readonly<Vector3>

	readonly gyro: Readonly<Vector3>

	get roll() {
		return Math.atan2(this.accel.y, this.accel.z) * RAD_TO_DEG
	}

	get pitch() {
		return Math.atan(-this.accel.x / Math.sqrt(this.accel.y ** 2 + this.accel.z ** 2)) * RAD_TO_DEG
	}

	/** 3-axis accelerometer reading from the DMP packet. */
	readonly dmpAccel: Readonly<Vector3>

	/**  3-axis gyroscope reading from the DMP packet. */
	readonly dmpGyro: Readonly<Vector3>

	/** DMP computed quaternion */
	readonly dmpQuaternion: Readonly<Quaternion>

	/**
	 * Get the gravity vector in 
	 * @returns 
	 */
	get dmpGravity(): Readonly<Vector3> {
		/* +1g corresponds to +8192, sensitivity is 2g. */
		const qI = this.dmpQuaternion
		return Object.freeze({
			x: (Math.trunc(qI.x) * qI.z - Math.trunc(qI.w) * qI.y) * ACCEL_SCALER,
			y: (Math.trunc(qI.w) * qI.x + Math.trunc(qI.y) * qI.z) * ACCEL_SCALER,
			z: (Math.trunc(qI.w) * qI.w - Math.trunc(qI.x) * qI.x
				- Math.trunc(qI.y) * qI.y + Math.trunc(qI.z) * qI.z) * ACCEL_SCALER / 2
		})
	}
	
	/**
	 * Compute the Euler angle from a DMP quaternion.
	 * @returns The Euler angle.
	 */
	get dmpEuler(): Readonly<Euler> {
		const q = this.dmpQuaternion
		return Object.freeze({
			x: Math.atan2(2 * q.x * q.y - 2 * q.w * q.z, 2 * q.w * q.w + 2 * q.x * q.x - 1)   // psi or x
			-Math.asin(2 * q.x * q.z + 2 * q.w * q.y),                                     // theta or y
			y: Math.atan2(2 * q.y * q.z - 2 * q.w * q.x, 2 * q.w * q.w + 2 * q.z * q.z - 1),   // phi or z
			z: 0
		});
	}
	
	/**
	 * Compute the yaw, roll and pitch from the DMP quaternion and gravity vector.
	 * @param gravity - The gravity vector
	 * @param [degree] - convert radian to degree
	 * @returns The roll, yaw and pitch
	 */
	dmpYawPitchRoll(gravity: Vector3, degree = false) {
		const q = this.dmpQuaternion
		// yaw: (about Z axis)
		let yaw = Math.atan2(2 * q.x * q.y - 2 * q.w * q.z,  2 * q.w * q.w + 2 * q.x * q.x - 1);
	
		// pitch: (nose up/down, about Y axis)
		let pitch = Math.atan2(gravity.x , Math.sqrt(gravity.y * gravity.y + gravity.z * gravity.z));
	
		// roll: (tilt left/right, about X axis)
		let roll = Math.atan2(gravity.y , gravity.z);
	
		if (gravity.z < 0) {
			// reverse pitch angle when upside down
			if(pitch > 0) {
				pitch = Math.PI - pitch; 
			} else { 
				pitch = -Math.PI - pitch;
			}
		}

		if (degree) {
			yaw *= RAD_TO_DEG
			pitch *= RAD_TO_DEG
			roll *= RAD_TO_DEG
		}
	
		return {
			roll,
			pitch,
			yaw
		}
	}
	
	/**
	 * Compute the 3-axis linear acceleration vector from the dmp acceleration and gravity vector.
	 * @param accel - 3-axis acceleration
	 * @param gravity - gravity vector
	 * @returns The linear acceleration vector
	 */
	dmpGetLinearAccel(accel: Vector3, gravity: Vector3): Readonly<Vector3> {
		// get rid of the gravity component (+1g = +8192 in standard DMP FIFO packet, sensitivity is 2g)
		return Object.freeze({
			x: accel.x - gravity.x * 8192,
			y: accel.y - gravity.y * 8192,
			z: accel.z - gravity.z * 8192
		})
	}

	/**
	 * Watch interrupt and auto fetch.
	 * @param pin (int)errupt pin number
	 * @param [callback] onDMPSensorUpdated
	 */
	interruptWatch(pin: number, callback?: () => void) {
		const imu = this
		if (this.#interruptIo) this.#interruptIo.close()
		this.#interruptIo = new Digital({
			pin,
			mode: Digital.Input,
			edge: Digital.Rising,
			async onReadable() {
				try {
					await imu.dmpGetCurrentFIFOPacket()
					if (typeof callback == 'function') callback()
				} catch(e) {
					trace(e)
				}
			}
		})

		this.interruptLatchEnabled = true
		this.interruptDMPEnabled = true
		this.dmpEnabled = true
	}

	// Calibration Routines
	
	async #pid(readAddress: number, kP: number, kI: number, loops: number, enableOutput = true) {
		const dmpEnabled = this.dmpEnabled
		if (dmpEnabled) this.dmpEnabled = false
		// eslint-disable-next-line no-nested-ternary
		const saveAddress = readAddress === 0x3B ? (this.deviceID < 0x38  ? 0x06 : 0x77) : 0x13
		let data: number // 
		let reading: number // float
		const bitZero = Int16Array.from([0,0,0]) // int16
		const shift = (saveAddress === 0x77) ? 3 : 2  // eslint-disable-line no-nested-ternary
		let error = 0
		let pTerm = 0
		const iTerm = Float32Array.from([0,0,0]) // float
		let eSample // int16_t
		let eSum // uint32_t  
		if (enableOutput) trace('>', '\n');
		for (let i = 0; i < 3; i++) {
			data = this.#io.readWord(saveAddress + (i * shift), true) // reads 1 or more 16 bit integers (Word)
			reading = data
			if(saveAddress !== 0x13) {
				bitZero[i] = data & 1 // Capture Bit Zero to properly handle Accelerometer calibration
				iTerm[i] = reading * 8
			} else {
				iTerm[i] = reading * 4
			}
		}
		for (let l = 0; l < loops; l++) {
			eSample = 0
			for (let c = 0; c < 100; c++) { // 100 PI Calculations
				eSum = 0
				for (let i = 0; i < 3; i++) {
					data = this.#io.readWord(readAddress + (i * 2), true) // reads 1 or more 16 bit integers (Word)
					reading = data
					if ((readAddress === 0x3B) && (i === 2)) reading -= 16384	// remove Gravity
					error = -reading
					eSum += Math.abs(reading)
					pTerm = kP * error
					iTerm[i] += (error * 0.001) * kI  // Integral term 1000 Calculations a second = 0.001
					if(saveAddress !== 0x13) {
						data = Math.round((pTerm + iTerm[i] ) / 8)  // Compute PID Output
						data = (data & 0xFFFE) | bitZero[i]  // Insert Bit0 Saved at beginning
					} else data = Math.round((pTerm + iTerm[i] ) / 4) // Compute PID Output
					this.#io.writeWord(saveAddress + (i * shift), data, true)
				}
				if((c === 99) && eSum > 1000) {  // Error is still too great to continue 
					c = 0
					if (enableOutput) trace('*')
				}
				if((eSum * ((readAddress === 0x3B) ? 0.05 : 1)) < 5) eSample++  // Successfully found offsets prepare to advance
				if((eSum < 100) && (c > 10) && (eSample >= 10)) break  // Advance to next Loop
				await new Promise(res => System.setTimeout(res, 1))
			}
			if (enableOutput) trace('.', '\n')
			kP *= .75
			kI *= .75
			for (let i = 0; i < 3; i++) {
				if(saveAddress !== 0x13) {
					data = Math.round((iTerm[i] ) / 8);		// Compute PID Output
					data = (data & 0xFFFE) | bitZero[i];	// Insert Bit0 Saved at beginning
				} else data = Math.round((iTerm[i]) / 4);
				this.#io.writeWord(saveAddress + (i * shift), data, true);
			}
		}
		this.resetFIFO()
		this.resetDMP()
		if (dmpEnabled) this.dmpEnabled = true
		if (enableOutput) trace('\n')
	}

	printActiveOffsets() {
		const data = this.offsets
		
		trace('           X Accel  Y Accel  Z Accel   X Gyro   Y Gyro   Z Gyro', '\n')
		trace('OFFSETS  ')
		for(const item of data) {
			trace('  ', item.toString().padStart(7).slice(0, 7))
		}
		trace('\n')
	}

	/**
	 * Calibrate the gyroscope, (i.e., compute X, Y and Z offsets),
	 * in 6-7 iterations (600-700 readings). The X, Y and Z offsets are printed to stdout
	 * for future use with the setXGyroOffset(), setYGyroOffset() and setZGyroOffset()
	 * respectively.
	 * 
	 * @param [enableOutput=true] - enables output of info msgs
	 * @param [loops=6] - number of calibration iterations to run
	 */
	async calibrateGyro(enableOutput = true, loops = 6) {
		let kP = 0.3
		let kI = 90
		const map = (x: number, in_min: number, in_max: number, out_min: number, out_max: number) => (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
		const x = (100 - map(loops, 1, 5, 20, 0)) * .01
		kP *= x
		kI *= x
		
		await this.#pid( 0x43,  kP, kI,  loops, enableOutput)
	}
	
	/**
	 * Calibrate the accelerometer, (i.e., compute X, Y and Z offsets),
	 * in 6-7 iterations (600-700 readings). The X, Y and Z offsets are printed to stdout
	 * for future use with the setXAccelOffset(), setYAccelOffset() and setZAccelOffset()
	 * respectively.
	 * 
	 * @param [enableOutput=true] - enables output of info msgs
	 * @param [loops=6] - number of calibration iterations to run
	 */
	async calibrateAccel(enableOutput = true, loops = 6) {
		let kP = 0.3
		let kI = 20
		const map = (x: number, in_min: number, in_max: number, out_min: number, out_max: number) => (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
		const x = (100 - map(loops, 1, 5, 20, 0)) * .01
		kP *= x
		kI *= x
		await this.#pid( 0x3B, kP, kI,  loops, enableOutput)
	}
	
}

Object.freeze(GyroAccelerometer)

export default GyroAccelerometer
