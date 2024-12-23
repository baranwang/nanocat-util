import { $app } from "../lib/app.mjs";
import { Console } from "./Console.mjs";
import { Lodash as _ } from "./Lodash.mjs";

/**
 * fetch
 *
 * @link https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API
 * @export
 * @async
 * @param {object|string} resource
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function fetch(resource, options = {}) {
	// 初始化参数
	switch (typeof resource) {
		case "object":
			resource = { ...options, ...resource };
			break;
		case "string":
			resource = { ...options, url: resource };
			break;
		case "undefined":
		default:
			throw new TypeError(`${Function.name}: 参数类型错误, resource 必须为对象或字符串`);
	}
	// 自动判断请求方法
	if (!resource.method) {
		resource.method = "GET";
		if (resource.body ?? resource.bodyBytes) resource.method = "POST";
	}
	// 移除请求头中的部分参数, 让其自动生成
	delete resource.headers?.Host;
	delete resource.headers?.[":authority"];
	delete resource.headers?.["Content-Length"];
	delete resource.headers?.["content-length"];
	// 定义请求方法（小写）
	const method = resource.method.toLocaleLowerCase();
	// 转换请求超时时间参数
	if (!resource.timeout) resource.timeout = 5;
	if (resource.timeout) {
		resource.timeout = Number.parseInt(resource.timeout, 10);
		// 转换为秒，大于500视为毫秒，小于等于500视为秒
		if (resource.timeout > 500) resource.timeout = Math.round(resource.timeout / 1000);
	}
	// 判断平台
	switch ($app) {
		case "Loon":
		case "Surge":
		case "Stash":
		case "Egern":
		case "Shadowrocket":
		default:
			// 转换请求参数
			if (resource.timeout) {
				switch ($app) {
					case "Loon":
						resource.timeout = resource.timeout * 1000;
						break;
					case "Shadowrocket":
					case "Stash":
					case "Egern":
					case "Surge":
					default:
						break;
				}
			}
			if (resource.policy) {
				switch ($app) {
					case "Loon":
						resource.node = resource.policy;
						break;
					case "Stash":
						_.set(resource, "headers.X-Stash-Selected-Proxy", encodeURI(resource.policy));
						break;
					case "Shadowrocket":
						_.set(resource, "headers.X-Surge-Proxy", resource.policy);
						break;
				}
			}
			if (typeof resource.redirection === "boolean") resource["auto-redirect"] = resource.redirection;
			// 转换请求体
			if (resource.bodyBytes && !resource.body) {
				resource.body = resource.bodyBytes;
				resource.bodyBytes = undefined;
			}
			// 判断是否请求二进制响应体
			switch ((resource.headers?.Accept || resource.headers?.accept)?.split(";")?.[0]) {
				case "application/protobuf":
				case "application/x-protobuf":
				case "application/vnd.google.protobuf":
				case "application/vnd.apple.flatbuffer":
				case "application/grpc":
				case "application/grpc+proto":
				case "application/octet-stream":
					resource["binary-mode"] = true;
					break;
			}
			// 发送请求
			return await new Promise((resolve, reject) => {
				$httpClient[method](resource, (error, response, body) => {
					if (error) reject(error);
					else {
						response.ok = /^2\d\d$/.test(response.status);
						response.statusCode = response.status;
						if (body) {
							response.body = body;
							if (resource["binary-mode"] == true) response.bodyBytes = body;
						}
						resolve(response);
					}
				});
			});
		case "Quantumult X":
			// 转换请求参数
			if (resource.policy) _.set(resource, "opts.policy", resource.policy);
			if (typeof resource["auto-redirect"] === "boolean") _.set(resource, "opts.redirection", resource["auto-redirect"]);
			// 转换请求体
			if (resource.body instanceof ArrayBuffer) {
				resource.bodyBytes = resource.body;
				resource.body = undefined;
			} else if (ArrayBuffer.isView(resource.body)) {
				resource.bodyBytes = resource.body.buffer.slice(resource.body.byteOffset, resource.body.byteLength + resource.body.byteOffset);
				resource.body = undefined;
			} else if (resource.body) resource.bodyBytes = undefined;
			// 发送请求
			return Promise.race([
				await $task.fetch(resource).then(
					response => {
						response.ok = /^2\d\d$/.test(response.statusCode);
						response.status = response.statusCode;
						switch ((response.headers?.["Content-Type"] ?? response.headers?.["content-type"])?.split(";")?.[0]) {
							case "application/protobuf":
							case "application/x-protobuf":
							case "application/vnd.google.protobuf":
							case "application/vnd.apple.flatbuffer":
							case "application/grpc":
							case "application/grpc+proto":
							case "application/octet-stream":
								response.body = response.bodyBytes;
								break;
							case undefined:
							default:
								break;
						}
						response.bodyBytes = undefined;
						return response;
					},
					reason => Promise.reject(reason.error),
				),
				new Promise((resolve, reject) => {
					setTimeout(() => {
						reject(new Error(`${Function.name}: 请求超时, 请检查网络后重试`));
					}, resource.timeout);
				}),
			]);
		case "Node.js": {
			const iconv = require("iconv-lite");
			const got = globalThis.got ? globalThis.got : require("got");
			const cktough = globalThis.cktough ? globalThis.cktough : require("tough-cookie");
			const ckjar = globalThis.ckjar ? globalThis.ckjar : new cktough.CookieJar();
			if (resource) {
				resource.headers = resource.headers ? resource.headers : {};
				if (undefined === resource.headers.Cookie && undefined === resource.cookieJar) resource.cookieJar = ckjar;
			}
			const { url, ...options } = resource;
			return await got[method](url, options)
				.on("redirect", (response, nextOpts) => {
					try {
						if (response.headers["set-cookie"]) {
							const ck = response.headers["set-cookie"].map(cktough.Cookie.parse).toString();
							if (ck) ckjar.setCookieSync(ck, null);
							nextOpts.cookieJar = ckjar;
						}
					} catch (e) {
						Console.error(e);
					}
					// ckjar.setCookieSync(response.headers["set-cookie"].map(Cookie.parse).toString())
				})
				.then(
					response => {
						response.statusCode = response.status;
						response.body = iconv.decode(response.rawBody, "utf-8");
						response.bodyBytes = response.rawBody;
						return response;
					},
					error => Promise.reject(error.message),
				);
		}
	}
}
