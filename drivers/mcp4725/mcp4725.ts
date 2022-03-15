import I2C, { I2COptions } from 'embedded:io/i2c'

/**
 * 12-bit DAC MCP4725
 */
class MCP4725 {
	#io: I2C
	min = 0
	max = 1

	constructor(option: I2COptions) {
		this.#io = new I2C(option)
	}
	
	get value() {
		const register = this.#io.read(6)
		const data = new Uint8Array(register)
		const dacValue = (data[1] << 4) + (data[2] >> 4)
		return dacValue / 4095 * (this.max - this.min) + this.min
	}

	set value(value: number) {
		value = Math.min(this.max, Math.max(this.min, value))
		
		const output = (value - this.min) / (this.max - this.min) * 4095
		const command = [
			0x60,
			output >> 4,
			(output & 0b1111) << 4
		]
		this.#io.write(Uint8Array.from(command))
	}

	close() {
		this.#io.close()
	}
}
Object.freeze(MCP4725)

export default MCP4725
