declare module "spice/system/sleep" {
	export enum WakeupCause {
		unknown = 0,
		WakeupExt0 = 2,
		WakeupExt1 = 3,
		WakeupTimer = 4,
		WakeupTouchpad = 5,
		WakeupULP = 6,
	}

	export class Sleep {
		/** sleep time */
		static deep(ms: number): never

		/** sleep time */
		static light(ms: number): void

		/**
		 * @see https://lastminuteengineers.com/esp32-pinout-reference/#esp32-rtc-gpio-pins for ESP32
		 * @param pin rtc-gpio pin
		 * @param level 
		 */
		static enableExt0Wakeup(pin: number, level: 0|1): void
		/**
		 * @see https://lastminuteengineers.com/esp32-pinout-reference/#esp32-rtc-gpio-pins for ESP32
		 * @param pin rtc-gpio pin
		 * @param level 
		 */
		static enableExt1Wakeup(pin: number, level: 0|1): void

		static getWakeupCause(): WakeupCause

		static status: number
	}
}
