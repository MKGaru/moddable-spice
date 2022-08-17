/** port from: https://github.com/adafruit/Adafruit-PWM-Servo-Driver-Library/blob/master/Adafruit_PWMServoDriver.cpp */

/** ============================================
Software License Agreement (BSD License)

Copyright (c) 2012, Adafruit Industries
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holders nor the
names of its contributors may be used to endorse or promote products
derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES
LOSS OF USE, DATA, OR PROFITS OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
===============================================
*/

import Timer from 'timer'
import type EmbeddedSMBus from 'embedded:io/smbus'
import SMBus, { type Byte, type Bit, type Bits } from 'spice/io/smbus'

type PartialOptions<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
type ValueOf<T extends object> = T[keyof T]
type Channel = Bits<4>

type SMBusOptions = ConstructorParameters<typeof EmbeddedSMBus>[0]

export interface PCA9685Options extends SMBusOptions {

}

const Register = Object.freeze({
	/** Mode Register 1 */
	MODE1: 0x00,
	/** Mode Register 2 */
	MODE2: 0x01,
	/** I2C-bus subaddress 1 */
	SUBADR1: 0x02,
	/** I2C-bus subaddress 2 */
	SUBADR2: 0x03,
	/** I2C-bus subaddress 3 */
	SUBADR3: 0x04,
	/** LED All Call I2C-bus address */
	ALLCALLADR: 0x05,
	/** LED0 on tick, low byte*/
	LED0_ON_L: 0x06,
	/** LED0 on tick, high byte*/
	LED0_ON_H: 0x07,
	/** LED0 off tick, low byte */
	LED0_OFF_L: 0x08,
	/** LED0 off tick, high byte */
	LED0_OFF_H: 0x09,
	// etc all 16:  LED15_OFF_H 0x45

	/** load all the LEDn_ON registers, low */
	ALLLED_ON_L: 0xFA,
	/** load all the LEDn_ON registers, high */
	ALLLED_ON_H: 0xFB,
	/** load all the LEDn_OFF registers, low */
	ALLLED_OFF_L: 0xFC,
	/** load all the LEDn_OFF registers,high */
	ALLLED_OFF_H: 0xFD,
	/** Prescaler for PWM output frequency */
	PRESCALE: 0xFE,
	/** defines the test mode to be entered */
	TESTMODE: 0xFF,
} as const)

const MODE1 = Object.freeze({
	/** respond to LED All Call I2C-bus address */
	ALLCAL: 0x01,
	/** respond to I2C-bus subaddress 3 */
	SUB3: 0x02,
	/** respond to I2C-bus subaddress 2 */
	SUB2: 0x04,
	/** respond to I2C-bus subaddress 1 */
	SUB1: 0x08,
	/** Low power mode. Oscillator off */
	SLEEP: 0x10,
	/** Auto-Increment enabled */
	AI: 0x20,
	/** Use EXTCLK pin clock */
	EXTCLK: 0x40,
	/** Restart enabled */
	RESTART: 0x80,
} as const)

const MODE2 = Object.freeze({
	/** Active LOW output enable input */
	OUTNE_0: 0x01,
	/** Active LOW output enable input - high impedience */
	OUTNE_1: 0x02,
	/** totem pole structure vs open-drain */
	OUTDRV: 0x04,
	/** Outputs change on ACK vs STOP */
	OCH: 0x08,
	/** Output logic state inverted */
	INVRT: 0x10,
} as const)

const PRESCALE_MIN = 3
const PRESCALE_MAX = 255
/**  osc. frequency in datasheet * */
const FREQUENCY_OSCILLATOR = 25_000_000

class PCA9685 {
	#io: SMBus<ValueOf<typeof Register>>

	#oscillatorFreq: number
	
	constructor(_options: PartialOptions<PCA9685Options, 'data'|'clock'|'hz'|'address'>) {
		const options: PCA9685Options = Object.assign({
			data: device.I2C.default.data,
			clock: device.I2C.default.clock,
			hz: 400_000,
			address: 0x40,
		}, _options)
		this.#io = new SMBus(options)
	}

	begin(prescale: Byte = 0) {
		this.reset()
		if (prescale) {
			this.setExtClk(prescale);
		} else {
			// set a default frequency
			this.setPWMFreq(1000);
		}
		// set the default internal frequency
		this.setOscillatorFrequency(FREQUENCY_OSCILLATOR);
	}

	/**
	 * Sends a reset command to the PCA9685 chip over I2C
	 */
	reset() {
		this.#io.writeByte(Register.MODE1, MODE1.RESTART)
		Timer.delay(10)
	}

	/**
	 * Puts board into sleep mode
	 */
	sleep() {
		const awake = this.#io.readByte(Register.MODE1)
		const sleep = (awake | MODE1.SLEEP) as Byte // set sleep bit high
		this.#io.writeByte(Register.MODE1, sleep)
		Timer.delay(5) // wait until cycle ends for sleep to be active
	}

	/**
	 * Wakes board from sleep
	 */
	wakeup() {
		const sleep = this.#io.readByte(Register.MODE1)
		const wakeup = (sleep & ~MODE1.SLEEP) as Byte // set sleep bit low
		this.#io.writeByte(Register.MODE1, sleep)
		Timer.delay(5) // wait until cycle ends for sleep to be active
	}

	/**
	 * Sets EXTCLK pin to use the external clock
	 * @param prescale Configures the prescale value to be used by the external clock
	 */
	setExtClk(prescale: Byte) {
		const oldmode = this.#io.readByte(Register.MODE1)
		let newmode = ((oldmode & ~MODE1.RESTART) | MODE1.SLEEP) as Byte // sleep
		this.#io.writeByte(Register.MODE1, newmode) // go to sleep, turn off internal oscillator

		// This sets both the SLEEP and EXTCLK bits of the MODE1 register to switch to
		// use the external clock.
		newmode = (newmode | MODE1.EXTCLK) as Byte
		this.#io.writeByte(Register.MODE1, newmode)

		this.#io.writeByte(Register.PRESCALE, prescale) // set the prescaler

		Timer.delay(5)
		// clear the SLEEP bit to start
		this.#io.writeByte(Register.MODE1, ((newmode & ~MODE1.SLEEP) | MODE1.RESTART | MODE1.AI) as Byte)
	}

	/**
	 * Sets the PWM frequency for the entire chip, up to ~1.6 KHz
	 * @param freq Floating point frequency that we will attempt to match
	 */
	setPWMFreq(freq: number) {
		// Range output modulation frequency is dependant on oscillator
		if (freq < 1) freq = 1
		if (freq > 3500) freq = 3500 // Datasheet limit is 3052=50MHz/(4*4096)
		const prescaleval = Math.max(PRESCALE_MIN, Math.min( PRESCALE_MAX,
			((this.#oscillatorFreq / (freq * 4096.0)) + 0.5) - 1,
		)) as Byte
		
		const prescale = prescaleval

		const oldmode = this.#io.readByte(Register.MODE1)
		const newmode = ((oldmode & ~MODE1.RESTART) | MODE1.SLEEP) as Byte // sleep
		this.#io.writeByte(Register.MODE1, newmode)                             // go to sleep
		this.#io.writeByte(Register.PRESCALE, prescale) // set the prescaler
		this.#io.writeByte(Register.MODE1, oldmode)
		Timer.delay(5)
		// This sets the MODE1 register to turn on auto increment.
		this.#io.writeByte(Register.MODE1, (oldmode | MODE1.RESTART | MODE1.AI) as Byte)
	}

	/**
	 * Sets the output mode of the PCA9685 to either
	 * open drain or push pull / totempole.
	 * Warning: LEDs with integrated zener diodes should
	 * only be driven in open drain mode.
	 * @param totempole Totempole if true, open drain if false.
	 */
	setOutputMode(totempole: boolean){
		const oldmode = this.#io.readByte(Register.MODE2)
		const newmode = (totempole
			? oldmode | MODE2.OUTDRV
			: oldmode & ~MODE2.OUTDRV
		) as Byte
		this.#io.writeByte(Register.MODE2, newmode)
	}

	/**
	 * Gets the PWM output of one of the PCA9685 pins
	 * @param num  One of the PWM output pins, from 0 to 15
	 * @return requested PWM output value
	 */
	getPWM(num: Channel) {
		const buffer = this.#io.readBlock(Register.LED0_ON_L + 4 * num, 4)
		const view = new DataView(buffer, 0, 4)
		return view.getUint16(2, true)
	}

	/**
	 * Sets the PWM output of one of the PCA9685 pins
	 * @param num One of the PWM output pins, from 0 to 15
	 * @param on At what point in the 4096-part cycle to turn the PWM output ON
	 * @param off At what point in the 4096-part cycle to turn the PWM output OFF
	 */
	setPWM(num: Channel, on: number, off: number) {
		const buffer = new ArrayBuffer(4)
		const view = new DataView(buffer, 0, 4)
		view.setUint16(0, on, true)
		view.setUint16(2, off, true)
		this.#io.writeBlock(
			Register.LED0_ON_L + 4 * num,
			buffer
		)
	}
	
	/**
	 * Helper to set pin PWM output. Sets pin without having to deal with
	 * on/off tick placement and properly handles a zero value as completely off and
	 * 4095 as completely on.  Optional invert parameter supports inverting the
	 * pulse for sinking to ground.
	 * @param num  One of the PWM output pins, from 0 to 15
	 * @param val The number of ticks out of 4096 to be active, should be a value from 0 to 4095 inclusive.
	 * @param invert invert If true, inverts the output, defaults to 'false'
	 */
	setPin(num: Channel, val: number, invert = false) {
		// Clamp value between 0 and 4095 inclusive.
		val = Math.min(4095, val)
		if (invert) {
			if (val == 0) {
				// Special value for signal fully on.
				this.setPWM(num, 4096, 0)
			} else if (val == 4095) {
				// Special value for signal fully off.
				this.setPWM(num, 0, 4096)
			} else {
				this.setPWM(num, 0, 4095 - val)
			}
		} else {
			if (val == 4095) {
				// Special value for signal fully on.
				this.setPWM(num, 4096, 0)
			} else if (val == 0) {
				// Special value for signal fully off.
				this.setPWM(num, 0, 4096)
			} else {
				this.setPWM(num, 0, val)
			}
		}
	}

	/**
	 * Reads set Prescale from PCA9685
	 */
	readPrescale() {
		return this.#io.readByte(Register.PRESCALE)
	}

	/**
	 * Sets the PWM output of one of the PCA9685 pins based on the input microseconds, output is not precise
	 * @param num One of the PWM output pins, from 0 to 15
	 * @param microseconds The number of Microseconds to turn the PWM output ON
	 */
	writeMicroseconds(num: Channel, microseconds: number) {
		let pulse = microseconds
		let pulselength = 1_000_000 // 1,000,000 us per second

		// Read prescale
		let prescale = this.readPrescale()

		// Calculate the pulse for PWM based on Equation 1 from the datasheet section
		// 7.3.5
		prescale += 1
		pulselength *= prescale
		pulselength /= this.#oscillatorFreq

		pulse /= pulselength
		this.setPWM(num, 0, pulse)
	}

	/**
	 *  Setter for the internally tracked oscillator used for freq calculations
	 * @param freq The frequency the PCA9685 should use for frequency calculations
	 */
	setOscillatorFrequency(freq: number) {
		this.#oscillatorFreq = freq
	}

	/**
	*  Getter for the internally tracked oscillator used for freq
	* calculations
	*  @returns The frequency the PCA9685 thinks it is running at (it cannot
	* introspect)
	*/
	getOscillatorFrequency() {
		return this.#oscillatorFreq
	}
}

Object.freeze(PCA9685)
Object.freeze(PCA9685.prototype)

export default PCA9685
