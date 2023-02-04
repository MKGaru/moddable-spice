#include "xs.h"
#include "esp_sleep.h"

RTC_DATA_ATTR int status;

void xs_deep_sleep_enter(xsMachine * the)
{
	if (xsToInteger(xsArgc) > 0) esp_sleep_enable_timer_wakeup(xsToInteger(xsArg(0)) * 1000);
	esp_deep_sleep_start();
}

void xs_light_sleep_enter(xsMachine * the)
{
	if (xsToInteger(xsArgc) > 0) esp_sleep_enable_timer_wakeup(xsToInteger(xsArg(0)) * 1000);
	esp_light_sleep_start();
}

void xs_enable_ext0_wakeup(xsMachine * the)
{
	if (xsToInteger(xsArgc) == 2) {
		esp_sleep_enable_ext0_wakeup(xsToInteger(xsArg(0)), xsToInteger(xsArg(1)));
	}
}

void xs_enable_ext1_wakeup(xsMachine * the)
{
	if (xsToInteger(xsArgc) == 2) {
		esp_sleep_enable_ext1_wakeup(xsToInteger(xsArg(0)), xsToInteger(xsArg(1)));
	}
}

void xs_sleep_get_reset_cause(xsMachine * the)
{
	esp_sleep_wakeup_cause_t wakeup_reason;
	wakeup_reason = esp_sleep_get_wakeup_cause();

	xsResult = xsInteger(wakeup_reason);
}

void xs_get_status(xsMachine * the)
{
	xsResult = xsInteger(status);
}

void xs_set_status(xsMachine * the)
{
	status = xsToInteger(xsArg(0));
}
