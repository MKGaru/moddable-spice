import Timer, { type TimerCallback } from 'timer'

class SystemTimer {
	static setTimeout(callback: TimerCallback, delay: number) {
		return Timer.set(callback, delay)
	}
	static clearTimeout(id: Timer) {
		Timer.clear(id)
	}
	static setInterval(callback: TimerCallback, delay: number) {
		return Timer.repeat(callback, delay)
	}
	static clearInterval(id: Timer) {
		Timer.clear(id)
	}
}
Object.freeze(SystemTimer)
Object.freeze(SystemTimer.prototype)
export default SystemTimer
