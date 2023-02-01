import Resource from 'Resource'
import { SSD1680 } from 'spice/drivers/display/epd/ssd1680'
import { PixelFormat } from 'spice/drivers/display'

const display = new SSD1680({
	width: 122,
	height: 250,
	busy: 25,
	reset: 26,
	dc: 12,
	out: 13,
	select: 15,
})
display.configure({
	rotation: 90,
	format: PixelFormat.Monochrome
})
display.begin()

const image = new Resource('image.dat')
const imageLength = image.byteLength / 2
display.send(
	image.slice(0, imageLength),
	image.slice(imageLength)
)

display.end()
