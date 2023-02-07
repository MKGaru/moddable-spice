import Timer from 'timer'
import EPD from 'spice/drivers/display/epd'
import { PixelFormat } from 'spice/drivers/display'

export class SSD1680 extends EPD {
	#invertedColor1 = true
	#invertedColor2 = false
	#bufferColor1: Uint8Array
	#bufferColor2: Uint8Array

	constructor(...[option]: ConstructorParameters<typeof EPD>) {
		super(option)
		const bitsPerPixel = 1
		const height8Bit = Math.ceil(option.height / 8) * bitsPerPixel

		this.#bufferColor1 = new Uint8Array(0/*option.width * height8Bit*/)
		this.#bufferColor2 = new Uint8Array(0/*option.width * height8Bit*/)
	}

	begin(...[options = {}]: Parameters<EPD['begin']>) {
		super.begin(options)

		this.#waitBusy(10)
		this._writeCommand(0x12) // SWRESET
		this.#waitBusy(10)

		this._writeCommand(0x01, 0xF9, 0x00, 0x00) // Driver output control

		// todo support flip, rotate
		let direction = 0b011
		// _______________^----- AM 0: x-mode  1: y-mode
		// ________________^^--- ID 00:y-x+  01:y-x+  10:y+x-  11:y+x+
		if (this._flip == 'v') {
			direction &= 0b101
		}
		if (this._flip == 'h') {
			direction &= 0b110
		}
		if (this._flip == 'hv') {
			direction &= 0b100
		}
		this._writeCommand(0x11, direction) // data entry mode (see 8.3 Data Entry Mode Settings (11h) )
		
		this._writeCommand(0x3C, 0x05) // BorderWavefrom
		this._writeCommand(0x18, 0x80) // Read built-in temprature sensor
		this._writeCommand(0x21, 0x00, 0x80) // Display update control

		this.adaptInvalid({
			x: options.x || 0,
			y: options.y || 0,
			width: options.width || this.width,
			height: options.height || this.height,
		})
	}
	
	send(pixels1: ArrayBufferLike, pixels2: ArrayBufferLike) {
		if (this._format == PixelFormat.Monochrome) {
			// not test yet.
			this.#bufferColor1 = new Uint8Array(pixels1)
			this.#bufferColor2 = new Uint8Array(pixels2)
		} else {
			// todo: support other format
			// @ref https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/commodetto/commodetto.md#convert-class
		}

		this._writeCommand(0x24)
		this._spi.write(this.#bufferColor1)

		this._writeCommand(0x26);
		this._spi.write(this.#bufferColor2)

		this.update()
	}
	end() {
		this.deepSleep()
	}

	adaptInvalid(area: { x: number; y: number; width: number; height: number }) {
		const {x, y, w, h} = (() => {
			return (
				(this._rotation == 0 || this._rotation == 180)
				? {
					x: this._rotation == 180 ? this.width - area.x - area.width : area.x,
					y: this._rotation == 180 ? this.height - area.y - area.height : area.y,
					w: area.width,
					h: area.height
				}
				: {
					x: this._rotation == 270 ? this.height - area.x - area.width : area.y,
					y: this._rotation == 270 ? this.width - area.y - area.height : area.x,
					w: area.height,
					h: area.width
				}
			)
		})()

		// trace(`x:${x} y:${y} w:${w} h:${h}\n`)

		// set ram-x address start/end position
		this._writeCommand(
			0x44,
			...(this._flip == '' || this._flip == 'v')
			? [
				x >> 3,
				(x + w - 1) >> 3
			] : [
				(x + w - 1) >> 3,
				x >> 3,
			]
		);
		// set ram-y address
		this._writeCommand(
			0x45,
			...(this._flip == '' || this._flip == 'h')
				? [
					// from top
					y & 0xFF,
					y >> 8,
					// to bottom
					(y + h - 1) & 0xFF,
					(y + h - 1) >> 8,
				]: [
					// from bottom
					(y + h - 1) & 0xFF,
					(y + h - 1) >> 8,
					// to top
					y & 0xFF,
					y >> 8,
				]
		)
		// set ram x address count
		this._writeCommand(
			0x4e,
			x / 8
		)
		// set ram y address count
		this._writeCommand(
			0x4f,
			y & 0xFF, // y % 256,
			y >> 8,   // y / 256
		)
	}
	close() {
		this.end()
		super.close()
	}
	
	update() {
		let inverseOption = 0
		if (this.#invertedColor1) inverseOption |= 0b0000_1000
		if (this.#invertedColor2) inverseOption |= 0b1000_0000
		this._writeCommand(0x21, inverseOption, 0b0_000_0000) // Display update Control
		// -------------------------------------^source output mode s0-175
		this._writeCommand(0x22, 0xF7) // Dispaly update control 2
		this._writeCommand(0x20) // Activate dislay update sequence
		this.#waitBusy(100)
	}

	clearBuffer() {
		this.#bufferColor1.fill(0x00)
		this.#bufferColor2.fill(0x00)
	}

	clearDisplay() {
		this.clearBuffer()
		this.send(this.#bufferColor1.buffer, this.#bufferColor2.buffer)
		Timer.delay(100)
		this.send(this.#bufferColor1.buffer, this.#bufferColor2.buffer)
	}

	deepSleep() {
		this._writeCommand(0x10, 0x01) 
	}

	#waitBusy(timeout: number) {
		if (!this._busy) timeout = 500
		timeout += Date.now()
		do {
			if (!this.#isBusy()) return
		} while(timeout > Date.now())
	}
	#isBusy() {
		if (!this._busy) return 1
		return !this._busy.read()
	}
}

Object.freeze(SSD1680.prototype)

export default SSD1680
