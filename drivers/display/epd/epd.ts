import Timer from 'timer'
import { PinSpecifier } from 'embedded:io/_common'

import { Display, DisplayOption } from 'spice/drivers/display'

const { Digital, SPI } = device.io

export abstract class EPD extends Display {
	readonly #width: number
	readonly #height: number

	#dc: InstanceType<typeof Digital>
	#reset?: InstanceType<typeof Digital>

	protected _busy?: InstanceType<typeof Digital>
	protected _spi: InstanceType<typeof SPI>

	protected _format: DisplayOption['format']
	protected _rotation: DisplayOption['rotation'] = 0
	protected _flip: DisplayOption['flip'] = ''
	protected _brightness: DisplayOption['brightness']

	constructor (option: {
		width: number,
		height: number,
		/** SDI/MOSI/SDA */
		out: PinSpecifier,
		/** SCK/SCL/SCKL */
		clock?: PinSpecifier,
		/** DC/DataCommand/MISO/SDO */
		dc: PinSpecifier,
		/** CS/SS/ChipSelect */
		select: PinSpecifier,
		/** RESET */
		reset?: PinSpecifier,
		/** BUSY */
		busy?: PinSpecifier
	}) {
		super()
		this.#width = option.width
		this.#height = option.height

		this.#dc = new Digital({
			pin: option.dc,
			mode: Digital.Output,
		})

		if (typeof option.reset != 'undefined') {
			this.#reset = new Digital({
				pin: option.reset,
				mode: Digital.Output,
			})
		}

		if (typeof option.busy != 'undefined') {
			this._busy = new Digital({
				pin: option.busy,
				mode: Digital.Input,
			})
		}

		this._spi = new SPI({
			select: option.select,
			clock: typeof option.clock != 'undefined' ? option.clock : device.SPI.default.clock,
			out: typeof option.out != 'undefined' ? option.out : device.SPI.default.out,
			port: device.SPI.default.port,
			hz: 40_000_000,
			mode: 0,
			active: 0,
		})
	}

	begin(...[options]: Parameters<Display['begin']>) {
		if (!options?.continue) {
			if (this.#reset) {
				this.#reset.write(1)
				Timer.delay(1)
				this.#reset.write(0)
				Timer.delay(10)
				this.#reset.write(1)
			}
		}
	}

	close() {
		if (this.#dc) this.#dc.close()
		if (this.#reset) this.#reset.close()
	}

	configure(options: DisplayOption) {
		if (options.format !== void 0) this._format = options.format
		if (options.flip !== void 0) this._flip = options.flip
		if (options.rotation !== void 0) this._rotation = options.rotation
		if (options.brightness !== void 0) this._brightness = options.brightness
	}
	
	get width(): number {
		return (this._rotation == 0 || this._rotation == 180) ? this.#width : this.#height
	}
	get height(): number {
		return (this._rotation == 0 || this._rotation == 180) ? this.#height : this.#width 
	}

	#buffer8 = new Uint8Array(1)
	#write8(value: number) {
		this.#buffer8[0] = value
		this._spi.write(this.#buffer8)
	}

	protected _writeCommand(command: number, ...data: number[]) {
		this.#dc.write(0)
		this.#write8(command)
		this.#dc.write(1)

		for (const byte of data) {
			this._writeData(byte | 0)
		}

		// trace([command, ...data].map(n => n.toString(16).padStart(2, '0')).join(' ') + '\n')
	}

	protected _writeData(data: number) {
		this.#write8(data)
	}
}

Object.freeze(EPD.prototype)

export default EPD

