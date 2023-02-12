declare module "spice/system/sleep" {
	export enum WakeupCause {
		unknown = 0,
		WakeupExt0 = 2,
		WakeupExt1 = 3,
		WakeupTimer = 4,
		WakeupTouchpad = 5,
		WakeupULP = 6,
	}

	export enum SleepPdDomain {
		RTCPeriph = 0,
		RTCSlowMem =  1,
		RTCFastMem = 2,
	}

	export enum SleepPdOption {
		OFF = 0,
		ON = 1,
		AUTO = 2,
	}

	export class Sleep {
		/** sleep time */
		static deep(ms: number): never

		/** sleep time */
		static light(ms: number): void

		/**
		 * Enable wakeup using a pin
		 * @see https://lastminuteengineers.com/esp32-pinout-reference/#esp32-rtc-gpio-pins for ESP32
		 * @param pin rtc-gpio pin
		 * @param level 
		 */
		static enableExt0Wakeup(pin: number, level: 0|1): void
		/**
		 * Enable wakeup using multiple pins
		 * @see https://lastminuteengineers.com/esp32-deep-sleep-wakeup-sources/#ext1-external-wakeup-source for ESP32
		 * @param bitmask rtc-gpio pin
		 * @param mode {0|1} 0: All Low,  1: Any High
		 */
		static enableExt1Wakeup(bitmask: number, mode: 0|1): void

		/**
		 * Set power down mode for an RTC power domain in sleep mode
		 * @param domain power domain to configure
		 * @param option power down option
		 */
		static setSleepPdConfig(domain: SleepPdDomain, option: SleepPdOption): void

		static getWakeupCause(): WakeupCause

		static status: number
	}
}
