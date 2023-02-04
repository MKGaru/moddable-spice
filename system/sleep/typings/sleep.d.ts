declare module "spice/system/sleep" {
	enum WakeupCause {
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

		static enableExt0Wakeup(pin: number, level: 0|1): void
		static enableExt1Wakeup(pin: number, level: 0|1): void

		static getWakeupCause(): WakeupCause

		static status: number
	}
}
