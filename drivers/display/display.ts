export enum PixelFormat {
	Monochrome = 3,
    Gray16 = 4,
    Gray256 = 5,
    RGB332 = 6,
    RGB565LE = 7,
    RGB565BE = 8,
    RGB24 = 9,
    RGBA32 = 10,
    CLUT16 = 11,
    ARGB4444 = 12,
}

export interface DisplayOption {
	/** A number indicating the format of pixel data passed to the instance (for example, to the **send** method). 
	 * This property is optional. If the format provided is not supported by the Display Class, a **RangeError** is thrown. */
	format?: PixelFormat,
	/** The clockwise rotation of the display as a number. This property is optional.
	 * If the value provided is not 0, 90, 180, or 270, or is unsupported by the Display Class, a **RangeError** is thrown. */
	rotation?: 0 | 90 | 180 | 270,
	/** The relative brightness of the display from 0 (off) to 1.0 (full brightness). This property is optional. */
	brightness?: number,
	/**
	 * A string indicating whether the pixels should be flipped horizontally and/or vertically. Allowed values are "", "h", "v", and "hv". 
	 * The empty string indicates that neither horizontal nor vertical flip is applied. This property is optional.
	 */
	flip?: ''|'h'|'v'|'hv'
}
/**
 * Display Class Pattern
 * @ref https://419.ecma-international.org/#-15-display-class-pattern
 */
export abstract class Display {
	/**
	 * The **begin** method starts the process of updating the display’s pixels.
	 */
	abstract begin(options?: {
		x?: number,
		y?: number,
		width?: number,
		height?: number,
		continue?: boolean,
	}): void

	/**
	 * The **send** method delivers one or more horizontal scan lines of pixel data to the display. 
	 * The sole argument to **send** is a buffer of pixels stored either in an **ArrayBuffer** or an ArrayBuffer view. 
	 * The pixels are stored in a packed array with no padding between scan lines. 
	 * The format of the pixels matches the **format** property of the options object of the **configure** method.
	 */
	abstract send(...pixels: ArrayBufferLike[]): void

	/**
	 * The **end** method finishes the process of updating the display’s pixels, by making all pixels visible on the display. 
	 * If the display instance buffers pixels, all pixels musts be flushed. 
	 * If the display uses page flipping, the page must be flipped to the most recently updated buffer.
	 */
	abstract end(): void

	/**
	 * The adaptInvalid method accepts a single options object argument that includes x, y, width, and height properties that describe an area of the display to be updated. 
	 * It adjusts these properties as necessary so that the result is valid for the display and encloses the original update area.
	 * @param area 
	 */
	abstract adaptInvalid(area: {
		x: number,
		y: number,
		width: number,
		height: number,
	}): void

	/**
	 * Execute all steps of the Peripheral Class Pattern close method
	 */
	abstract close(): void
	
	abstract configure(options: DisplayOption): void

	/** 
	 * The width of the display in pixels as a number. 
	 * This property is read-only. 
	 * This value may change based on the configuration, for example, when changing the rotation causes the orientation to change from portrait to landscape.
	 */
	abstract get width(): number
	/**
	 * The height of the display in pixels as a number. 
	 * This property is read-only. 
	 * This value may change based on the configuration, for example, when changing the rotation causes the orientation to change from portrait to landscape.
	 */
	abstract get height(): number
}
