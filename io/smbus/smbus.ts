import EmbeddedSMBus from 'embedded:io/smbus'

type BitPos = 0|1|2|3|4|5|6|7
type BitLength = 1|2|3|4|5|6|7|8

type ZeroTo<To extends number, Result extends unknown[]= []>
	= Result['length'] extends To
		? Result[number]
		: ZeroTo<To, [...Result, Result['length']]>
type Pow2<To extends number, Result extends unknown[] = [unknown], Counter extends unknown[] = []> =
	Counter['length'] extends To
		? Result["length"]
		: Pow2<To, [...Result, ...Result], [...Counter, unknown]>
export type Bits<Length extends BitLength> = ZeroTo<Pow2<Length>>

export type Bit = Bits<1>
export type Byte = Bits<8>

type AvailableLength<Position extends BitPos> =
	Position extends 0 ? 1 :
	Position extends 1 ? 1|2 :
	Position extends 2 ? 1|2|3 :
	Position extends 3 ? 1|2|3|4 :
	Position extends 4 ? 1|2|3|4|5 :
	Position extends 5 ? 1|2|3|4|5|6 :
	Position extends 6 ? 1|2|3|4|5|6|7 :
	Position extends 7 ? BitLength :
	never

class SMBus<Register extends number = number> extends EmbeddedSMBus {
	/** Read a single bit from an 8-bit device register.
	 * @param regAddr Register regAddr to read from
	 * @param bitNum Bit position to read (0-7)
	 * @returns Status bit value
	 */
	readBit(regAddr: Register, bitNum: BitPos): Bit {
		const b = this.readByte(regAddr)
		return  ((b & (1 << bitNum)) >> bitNum) as Bit
	}

	/** Read multiple bits from an 8-bit device register.
	 * @param regAddr Register regAddr to read from
	 * @param bitStart First bit position to read (0-7)
	 * @param length Number of bits to read (not more than 8)
	 * @returns The bits read
	 */
	readBits<Position extends BitPos, Length extends AvailableLength<Position>>(regAddr: Register, bitStart: Position, length: Length): Bits<Length> {
		let b = this.readByte(regAddr)
		const mask = ((1 << length) - 1) << (bitStart - length + 1)
		b &= mask
		b >>= (bitStart - length + 1)
		return b as Bits<Length>
	}

	/** 
	 * Write a single bit in an 8-bit device register.
	 * @param regAddr Register regAddr to write to
	 * @param bitNum Bit position to write (0-7)
	 * @param data New bit value to write
	 * @returns Status of operation (0 = success)
	 */
	writeBit(regAddr: Register, bitNum: BitPos, data: Bit|Boolean) {
		let b = this.readByte(regAddr)
		b = data ? (b | (1 << bitNum)) as Byte : (b & ~(1 << bitNum)) as Byte
		this.writeByte(regAddr, b)
	}

	/** Write multiple bits in an 8-bit device register.
	 * @param regAddr Register regAddr to write to
	 * @param bitStart First bit position to write (0-7)
	 * @param length Number of bits to write (not more than 8)
	 * @param bits Right-aligned value to write
	 * @returns Status of operation (0 = success)
	 */
	writeBits<Position extends BitPos, Length extends AvailableLength<Position>>(regAddr: Register, bitStart: Position, length: Length, bits: Bits<Length>) {
		//      010 value to write
		// 76543210 bit numbers
		//    xxx   args: bitStart=4, length=3
		// 00011100 mask byte
		// 10101111 original value (sample)
		// 10100011 original & ~mask
		// 10101011 masked | value
		let b = this.readByte(regAddr)
		const mask = ((1 << length) - 1) << (bitStart - length + 1)
		let data = bits << (bitStart - length + 1) // bits data into correct position
		data &= mask // zero all non-important bits in data
		b &= ~(mask) // zero all important bits in existing byte
		b |= data // combine data with existing byte
		this.writeByte(regAddr, b as Byte)
	}
}

Object.freeze(SMBus)
export default SMBus
