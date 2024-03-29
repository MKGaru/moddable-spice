/*
 * Copyright (c) 2016-2018  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK Runtime.
 *
 *   The Moddable SDK Runtime is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   The Moddable SDK Runtime is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with the Moddable SDK Runtime.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

export const WakeupCause = /** @type {const} */({
	unknown: 0,
	WakeupExt0: 2,
	WakeupExt1: 3,
	WakeupTimer: 4,
	WakeupTouchpad: 5,
	WakeupULP: 6,
})
Object.freeze(WakeupCause)

export const SleepPdDomain = /** @type {const} */({
	RTCPeriph: 0,
	RTCSlowMem: 1,
	RTCFastMem: 2,
	max: 3,
})
Object.freeze(SleepPdDomain)

export const SleepPdOption = /** @type {const} */({
	OFF: 0,
	ON: 1,
	AUTO: 2,
})
Object.freeze(SleepPdOption)

export class Sleep {
	// static getPersistentValue(index) @ "xs_get_persistent_value"
	// static setPersistentValue(index, value) @ "xs_set_persistent_value"

	/** @param {Number} ms sleep time */
	static deep(ms) {
		this.doDeepSleep(ms)
	}

	static light(ms) {
		this.doLightSleep(ms)
	}

	
	/** @param {Number} ms sleep time */
	static doDeepSleep(ms) @ "xs_deep_sleep_enter"

	/** @param {Number} ms sleep time */
	static doLightSleep(ms) @ "xs_light_sleep_enter"

	/** @return {Number} */
	static getWakeupCause() @ "xs_sleep_get_reset_cause"

	/** @param {Number} status */
	static set status(status) @ "xs_set_status"
	
	/** @return {Number} */
	static get status() @ "xs_get_status"

	/** 
	 * @param {Number} pin
	 * @param {Number} level
	 */
	static enableExt0Wakeup(pin, level) @ "xs_enable_ext0_wakeup"

	/** 
	 * @param {Number} pin
	 * @param {Number} level
	 */
	static enableExt1Wakeup(pin, level) @ "xs_enable_ext1_wakeup"
	
	/**
	 * @param {Number} domain
	 * @param {Number} option
	 */
	static setSleepPdConfig(domain, option) @ "xs_set_pd_config"
	
	// static getWakeupPin() @ "xs_sleep_get_wakeup_pin"

	// static getIdleSleepLevel() @ "xs_sleep_get_idle_sleep_level"
	// static setIdleSleepLevel(level) @ "xs_sleep_set_idle_sleep_level"
}

Object.freeze(Sleep)
Object.freeze(Sleep.prototype)
export default Sleep
