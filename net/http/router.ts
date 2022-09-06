import { type Socket } from 'socket'
import { Server, Request, HTTPServerCallback } from 'http'
import Resource from 'Resource'

/* [Base OSS]
 * Copyright 2016-Today Juan M. Hernández.
 * Code licensed under the Apache License 2.0.
  * jmhdez/minimal-router
 */

const parametersPattern = /(:[^\/]+)/g

// Some utility functions. Exported just to be able to test them easily

export function getMatchedParams(route: Route, path: string) {
	const matches = path.match(route.matcher)

	if (!matches) {
		return false
	}

	return route.params.reduce((acc, param, idx) => {
		acc[param] = decodeURIComponent(matches[idx + 1])
		return acc
	}, {} as Record<string, string>)
}

export function getQueryParams(query: string) {
	return query.split('&')
		.filter(p => p.length)
		.reduce((acc, part) => {
			const [key, value] = part.split('=')
			acc[decodeURIComponent(key)] = decodeURIComponent(value)
			return acc
		}, {})
}

export function createRoute(name: string, path: string, handler: Handler) {
	const matcher = new RegExp(path.replace(parametersPattern, '([^\/]+)') + '$')
	const params = (path.match(parametersPattern) || []).map(x => x.substring(1))

	return {name, path, handler, matcher, params}
}

const findRouteParams = (routes: Route[], path: string) => {
	let params
	const route = routes.find(r => params = getMatchedParams(r, path))
	return {route, params}
}

const parseUrl = (url: string) => {
	const [path, queryString] = url.split('?')
	return {path, queryString}
}

const stripPrefix = (url: string ,prefix: string) => url.replace(new RegExp('^' + prefix), '')

type Method = 'get' | 'post' | 'put' | 'delete'
type Handler = Function
type Route = ReturnType<typeof createRoute>

// The actual Router as the default export of the module
export default class Router {
	server?: Server & {
		router?: HttpServer,
		callback?: HTTPServerCallback,
		detach?: (handler: unknown) => InstanceType<typeof Socket>,
	}
    routes: Record<
        Method,
        Route[]
    >
    prefix = ''

	constructor() {
		this.routes = {
			get: [],
			post: [],
			put: [],
			delete: [],
		}
		this.prefix = ''
	}

	// Adds a route with an _optional_ name, a path and a handler function
    add(method: Method, path: string, handler: Handler): Router
    add(name: string, method: Method, Handler: string, handler: Handler): Router
	add(...args: ([Method, string, Function] | [string, Method, string, Handler])) {
		if (args.length == 3) {
			this.add('', ...args)
		} else {
            const [name, method, path, handler] = args
			this.routes[method].push(createRoute(name, path, handler))
		}
		return this
	}
	
	get(path: string, handler: Handler) {
		this.add('get', path, handler)
		return this
	}
	
	post(path: string, handler: Handler) {
		this.add('post', path, handler)
		return this
	}
	
	put(path: string, handler: Handler) {
		this.add('put', path, handler)
		return this
	}
	
	delete(path: string, handler: Handler) {
		this.add('delete', path, handler)
		return this
	}

	setPrefix(prefix: string) {
		this.prefix = prefix
		return this
	}

	dispatch(method: Method, url: string) {
		const {path, queryString} = parseUrl(stripPrefix(url, this.prefix))
		const query = getQueryParams(queryString || '')
		const {route, params} = findRouteParams(this.routes[method], path)

		if (route) {
			return route.handler({params, query})
		}

		return false
	}

	getCurrentRoute(method: Method, url: string) {
		const {path, queryString} = parseUrl(stripPrefix(url, this.prefix))
		const rp = findRouteParams(this.routes[method], path)
		return rp && rp.route
	}

	formatUrl(method: Method, routeName: string, params = {}, query = {}) {
		const route = this.routes[method].find(r => r.name === routeName)

		if (!route) {
			return ''
		}

		const queryString = Object.keys(query)
				  .map(k => [k, query[k]])
				  .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
				  .join('&')

		const path = this.prefix + route.path.replace(parametersPattern, function(match) {
			return params[match.substring(1)]
		})

		return queryString.length ? path + '?' + queryString : path
	}
}

Object.freeze(Router)

// -----------------------------------------------------------

export class HttpServer extends Router {
	websockets: Record<string, { attach?: (socket: InstanceType<typeof Socket>) => unknown }>
	static redirect(path) {
		return {
			status: 302,
			headers: {
				Location: path
			},
			body: ''
		}
	}

	constructor(opt = {port: 80}) {
		super()
		this.websockets = {}
		this.server = new Server(opt)
		this.server.router = this
		this.server.callback = this.handler
	}

	handler(
		this: Request & {
			server: Server & { router: HttpServer },
			method: Method,
			path: string,
			data?: any,
			position?: number,
		},
		message: number,
		...args: unknown[]
	) {
		const router = this.server.router
		switch(message) {
			case Server.status: {
				const [path, method] = args as [string, Method]
				const websockets = router.websockets[path]
				if (websockets) {
					const socket = router.server.detach(this);
					websockets.attach(socket);
					return
				}
				this.method = method
				this.path = path
				break
			}
			case Server.prepareResponse : {
				let result = {
					status: 200,
					headers: {
					},
					body: ''
				}
				result = router.dispatch(this.method.toLowerCase() as Method, this.path)
				const response = {
					status: 200,
					headers: [],
					body: false,
				}
				if (typeof result == 'string') {
					result = {
						status: 200,
						headers: {},
						body: result
					}
				}
				else if (typeof result == 'undefined') {
					result = {
						status: 204,
						headers: {},
						body: ''
					}
				}
				else if (result instanceof Resource) {
					this.data = result
					this.position = 0
					result = {
						status: 200,
						headers: {
							'Content-length': this.data.byteLength,
						},
						// @ts-ignore
						body: true
					}
					const [,ext] = this.path.match(/\.([^/?]*)\??/) || []
					let type = ''
					switch (ext) {
						case 'htm':
						case 'html':
							type = 'text/html'
							break
						case 'css':
							type = 'text/css'
							break
						case 'txt':
							type = 'text/plain'
							break
						case 'csv':
							type = 'text/csv'
							break
						case 'js':
							type = 'text/javascript'
							break
						case 'json':
							type = 'application/json'
							break
						case 'jpg':
						case 'jpeg':
							type = 'image/jpeg'
							break
						case 'png':
							type = 'image/png'
							break
						case 'gif':
							type = 'image/gif'
							break
						case 'bmp':
							type = 'image/bmp'
							break
						case 'svg':
							type = 'image/svg+xml'
							break
						case 'zip':
							type = 'application/zip'
							break
						case 'pdf':
							type = 'application/pdf'
							break
					}
					if (type) {
						result.headers['Content-type'] = type
					}
				}
				else if (typeof result == 'object') {
					result = {
						status: 200,
						headers: {},
						// @ts-ignore
						body: result
					}
				}
				else if (result === false) {
					result = {
						status: 404,
						// @ts-ignore
						body: {
							error: 'notfound',
						}
					}
				}
				if (result.status) {
					response.status = result.status
				}
				if (result.headers) {
					for(const [key, value] of Object.entries(result.headers)) {
						response.headers.push(key, value)
					}
				}
				const type = typeof result.body
				if (type == 'boolean') {
					// @ts-ignore
					response.body = result.body
				}
				else if (type == 'string') {
					// @ts-ignore
					response.body = result.body
				}
				else if((result.body as unknown) instanceof ArrayBuffer) {
					// @ts-ignore
					response.body = result.body
				}
				else if(type == 'object'){
					// @ts-ignore
					response.body = JSON.stringify(result.body)
					if (!result.headers || !result.headers['Content-Type']) {
						response.headers.push('Content-Type', 'application/json')
					}
				}
				
				return response
			}
			case Server.responseFragment: {
				const [sendableBytes] = args as [ number ]
				if (this.position >= this.data.byteLength) {
					return
				}
				const chunk = this.data.slice(this.position, this.position! + sendableBytes)
				if (chunk.byteLength == 0) return
				this.position += chunk.byteLength
				return chunk
				break
			}
		}
	}
}

Object.freeze(HttpServer)
