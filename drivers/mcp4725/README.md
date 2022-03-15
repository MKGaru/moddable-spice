spice/drivers/mcp4725
================

12-bit dac driver.

Usage
----------------
add include to manifest.json

```json
"$(MODDABLE)/../spice/drivers/mcp4725/manifest.json",
```

### usage
```javascript
import MCP4725 from 'spice/drivers/mcp4725'

const dac = new MCP4725({
    address: 0x60,
	data: device.I2C.default.data,
	clock: device.I2C.default.clock,
	hz: 400_000,
})

dac.value = 0.5
```
