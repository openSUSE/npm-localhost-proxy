/**
 * npm_install_proxy -- localhost NPM registry to `npm install` without network
 *
 * Copyright (C) 2020  SUSE LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Service } from '../src/service'
import { Registry, RegistryBackend, RequestHandler, PkgJson } from '../src/registry'
import * as http from 'http'
import { ListenOptions } from 'net';
import { URL } from 'url';

class TestService extends Service
{
	public get HttpServer(): http.Server { return this.server; }
}

class MockRegistryBackend implements RegistryBackend
{
	public extractPkgJson(path: string): Promise<PkgJson[]> {
		return Promise.resolve(<PkgJson[]>[
			{
				dist: { tarball: "test" },
				name: "nothing",
				version: "ver"
			},
			{
				dist: { tarball: "test2" },
				name: "nothing",
				version: "ver-2.0"
			},
			{
				dist: { tarball: "bad" },
				name: "bad and nothing",
				version: "ver"
			},
			{
				dist: { tarball: "bad2" },
				name: "@scope/badthings",
				version: "ver"
			}
		])
	}
}

describe("Service setup tests", function() {

	it("parses valid and invalid listen URLs", function() {
		expect(() => new Service({url: new URL("http://localhost")})).not.toThrowError("invalid port");
		expect(() => new Service({url: new URL("http://localhost:34")})).toThrowError("invalid port");
		expect(() => new Service({url: new URL("ftp://local:1234")})).toThrow("invalid protocol");
		expect(() => new Service({url: new URL("")})).toThrowError("Invalid URL");
		expect(() => new Service({url: null})).toThrowError("Invalid URL");
		expect(() => new Service({url: new URL("fofofofo")})).toThrowError("Invalid URL");

		expect(() => new Service({url: new URL("http://badhostname:5443")})).not.toThrowError();
		expect(() => new Service({url: new URL("http://goodhostname:3423")})).not.toThrowError();
	});

	it("starting server should call listen with correct parameters", function() {
		expect.assertions(3);

		const requestHandler:RequestHandler = {url: new URL("http://test:5443")};
		const service = new TestService(requestHandler);

		const listen = jest.spyOn(service.HttpServer, "listen").mockImplementationOnce((options:ListenOptions) => {
			expect(options.port).toBe(5443),
			expect(options.host).toBe("test");
			return null;
		});

		const registry = new Registry;
		registry.addBackend(new MockRegistryBackend);
		service.run(registry);
		expect(listen).toBeCalled();

	});

	it("stops server with error results in rejected close Promise", function() {
		expect.assertions(1);
		const service = new TestService({url: new URL("http://test:3444" )});
		const error_string = "error string here";

		jest.spyOn(service.HttpServer, "close").mockImplementationOnce((cb) => {
			if (cb)
				process.nextTick(() => cb(new Error(error_string)));
			return this;
		});

		return expect(() => service.stop()).rejects.toStrictEqual(Error(error_string));
	});

	it("stops server without error results in accepted Promise", function() {
		expect.assertions(1);
		const service = new TestService({url: new URL("http://test:3444" )});

		jest.spyOn(service.HttpServer, "close").mockImplementationOnce(function(cb) {
			if (cb)
				process.nextTick(() => cb());
			return this;
		});

		return service.stop().then(() => expect(service.HttpServer.close).toBeCalledTimes(1));
	})
});


describe("server request processing", function() {
	let service: TestService;

	let makeRequestOptions = function(default_options: http.RequestOptions, override_options: http.RequestOptions): http.RequestOptions {
		if (override_options)
			Object.keys(override_options).forEach(opt => default_options[opt] = override_options[opt]);
		return default_options;
	}

	let makeRequest = function(path:string, cb?:((url:string)=>void), override_options?:http.RequestOptions): Promise<Object> {
		const registry = new Registry;
		registry.addBackend(new MockRegistryBackend);
		registry.serviceProvider = service;
		registry.register('/');

		return new Promise((resolve, reject) => {
			service.run(registry).on("listening", () => {
				// should have a port in the service requests now
				const port = Number(service.url.port);
				expect(port).toBeGreaterThan(1024);

				if (cb)
					cb(service.url.toString());

				if (!override_options)
					override_options = {}

				const options = makeRequestOptions({
					hostname: 'localhost',
					port: port,
					protocol: 'http:',
					path: path,
					agent: false
				}, override_options);

				const req = http.request(options, res => {
					expect(res.headers['content-type']).toBe('application/json');

					if (res.statusCode === 200) {
						let data = '';
						res.on("data", chunk => {
							data += chunk;
						});
						res.on("end", () => {
							service.stop().then(() => resolve(JSON.parse(data)));
						});
						res.on("error", () => {
							reject("Data transfer error. Should not happen");
						});
					}
					else {
						let code = res.statusCode ? res.statusCode : 0;
						let msg = res.statusMessage ? res.statusMessage : ""
						reject(code + msg);
						service.stop();
					}
				});
				req.end();
			})
		});
	}

	beforeEach(function() {
		service = new TestService({url: new URL("http://localhost")});
	});

	it("responds with error on invalid path request", function() {
		return expect(makeRequest('/weirdness/is/here/or/not')).rejects.toBe(400 + "Invalid path");
	});

	it("responds with invalid method for non-GET requests", function() {
		return expect(makeRequest('/', undefined, {method: 'OPTIONS'})).rejects.toBe(500 + "Invalid method");
	});

	it("requests list of all available packages via GET / request", function() {
		let base_url;
		return makeRequest('/', b => base_url = b).then(res => {
			expect(res).toStrictEqual([
				{
					"name": "nothing",
					"versions": {
						"ver": base_url + "nothing/ver",
						"ver-2.0": base_url + "nothing/ver-2.0",
					},
				},
				{
					"name": "bad and nothing",
					"versions": {
						"ver": base_url + "bad and nothing/ver",
					},
				},
				{
					name: "@scope/badthings",
					versions: {
						"ver": base_url + "@scope/badthings/ver"
					}
				},
			]);
		});
	});

	it("returns list of available versions of a package", function() {
		let base_url: string;
		return makeRequest('/nothing', b => base_url=b).then(res => {
			expect(Object.keys(res['versions'])).toStrictEqual(["ver", "ver-2.0"]);
		});
	});

	it ("request for versions of a scoped package", function() {
		let base_url;
		return makeRequest('/@scope%2fbadthings', b => base_url = b).then(res => {
			expect(Object.keys(res['versions'])).toStrictEqual(['ver']);
		})
	});

	it("returns specific version of a package", function() {
		let base_url: string = "foo";
		return makeRequest("/nothing/ver", b => base_url=b).then(res => {
			expect(res).toStrictEqual({
				"dist": {
					"tarball": base_url + "test",
				},
				"name": "nothing",
				"version": "ver",
			})
		});
	});

	it("returns specific version of a scoped package", function() {
		let base_url = '';

		return makeRequest("/@scope%2fbadthings/ver", b => base_url=b).then(res => {
			expect(res).toStrictEqual({
					"dist": { "tarball": base_url + "bad2" },
					"name": "@scope/badthings",
					"version": "ver"
			});
		});
	});

});
