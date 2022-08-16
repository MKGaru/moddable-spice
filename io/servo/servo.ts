import PWM from 'embedded:io/pwm'

interface ServoOptions {
	pin: number,
	default?: number,
	min?: {
		angle?: number,
		pulse?: number,
	} | number,
	max?: {
		angle?: number,
		pulse?: number,
	} | number,
	offset?: number,
}

class Servo {
	#io: PWM
	#value = 0

	#minAngle: number
	#offsetAngle: number
	/** angle to pulse widh (msec) scale */
	#scale: number
	/** pulse width to range scale */
	#range: number

	#minPulse: number

	constructor(descriptor: number|ServoOptions) {
		if (typeof descriptor == 'number') descriptor = { pin: descriptor }
		this.#value = descriptor.default || 0
		const option = {
			pin: descriptor.pin,
			min: descriptor.min,
			max: descriptor.max
		}
		let minAngle = 0
		let maxAngle = 180
		let offsetAngle = 0
		if (typeof option.min == 'undefined')
			option.min = 500
		if (typeof option.min == 'object') {
			if (typeof option.min.angle == 'number')
				minAngle = option.min.angle
			option.min = option.min.pulse
		}
		if (typeof option.max == 'undefined')
			option.max = 2400
		if (typeof option.max == 'object') {
			if (typeof option.max.angle == 'number')
				maxAngle = option.max.angle
			option.max = option.max.pulse
		}
		if (typeof descriptor.offset == 'number') {
			offsetAngle = descriptor.offset
		}
		const scale = (option.max - option.min) / (maxAngle - minAngle)
		let minPulse = option.min
		if (option.min === undefined)
			delete option.min
		if (option.max === undefined)
			delete option.max
		
		this.#io = new PWM({
			pin: option.pin,
			hz: 50,
		})

		this.#minAngle = minAngle
		this.#offsetAngle = offsetAngle
		this.#scale = scale
		this.#minPulse = minPulse
		this.#range =  (this.#io.hz / 1_000_000 ) * (2 ** this.#io.resolution - 1)
	}

	read() {
		return this.#value
	}

	write(val: number) {
		this.#value = val
		this.#io.write((((val - this.#minAngle + this.#offsetAngle) * this.#scale) + this.#minPulse) * this.#range)
	}

	close() {
		// @ts-expect-error :  close method does not define in typings
		this.#io.close()
	}
}
Object.freeze(Servo)
Object.freeze(Servo.prototype)
export default Servo
