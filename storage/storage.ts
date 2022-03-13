import config from 'mc/config'
import { File }  from 'file'

export class Storage {
	#path = `${config.file.root}/storage`
	constructor(name?: string) {
		if (name) {
			this.#path = `${config.file.root}/storage/${name}`
		}
	}
	#getPath(key: string) {
		return `${this.#path}/${key}`
	}
	getItem(key: string): string|null {
		const path = this.#getPath(key)
		if (!File.exists(path)) return null
		const file = new File(path, false)
		if (file.length == 0) {
			file.close()
			File.delete(path)
			return null
		}
		const item = file.read(String)
		file.close()
		return item
	}
	setItem(key: string, value: string) {
		const path = this.#getPath(key)
		if (File.exists(path)) File.delete(path)
		const file = new File(path, true)
		file.write(value)
		file.close()
	}
	removeItem(key: string) {
		const path = this.#getPath(key)
		if (!File.exists(path)) return
		File.delete(path)
	}
}
Object.freeze(Storage)
export default new Storage()
