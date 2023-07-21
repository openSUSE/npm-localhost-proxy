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

import { DirRegistryBackend } from '../src/dir_registry'
import { Registry, RequestHandler } from '../src/registry'
import { URL } from 'url';
import { TarballRegistryBackend } from '../src/fs_registry';

class MockRequestHandler implements RequestHandler
{
	get url() {
		return new URL("http://localhost:8888");
	}
}

describe("directory registry integration tests", function () {
	it("reads packages from registry", function () {
		expect.assertions(5);

		const request_handler = new MockRequestHandler;
		const registry = new Registry;
		registry.addBackend(new TarballRegistryBackend);
		registry.addBackend(new DirRegistryBackend);
		registry.serviceProvider = request_handler;
		const assert_1_4_1_result = {
			"dependencies": {
				"util": "0.10.3",
			},
			"description": "commonjs assert - node.js api compatible",
			"devDependencies": {
				"mocha": "~1.21.4",
				"zuul": "~3.10.0",
				"zuul-ngrok": "^4.0.0",
			},
			"dist": {
				"integrity": "sha512-N+aAxov+CKVS3JuhDIQFr24XvZvwE96Wlhk9dytTg/GmwWoghdOvR8dspx8MVz71O+Y0pA3UPqHF68D6iy8UvQ==",
				"tarball": "http://localhost:8888/-/assert-1.4.1.tgz",
			},
			"homepage": "https://github.com/defunctzombie/commonjs-assert",
			"keywords": [
				"assert",
			],
			"license": "MIT",
			"main": "./assert.js",
			"name": "assert",
			"repository": {
				"type": "git",
				"url": "git://github.com/defunctzombie/commonjs-assert.git",
			},
			"scripts": {
				"browser-local": "zuul --no-coverage --local 8000 -- test.js",
				"test": "npm run test-node && npm run test-browser",
				"test-browser": "zuul -- test.js",
				"test-native": "TEST_NATIVE=true mocha --ui qunit test.js",
				"test-node": "mocha --ui qunit test.js",
			},
			"version": "1.4.1",
		};

		return registry.register("tests/pkgs").then(registry_size => {
			expect(registry_size).toBe(3);

			expect(Object.keys(registry.fetchVersions('assert')['versions'])).toStrictEqual(["1.0.1", "1.4.1"]);
			expect(registry.fetchPkgVersion("assert", "1.4.1")).toStrictEqual(assert_1_4_1_result);

			expect(() => registry.fetchPkgVersion("assert", "1.5.0")).toThrowError("not found");
			expect(() => registry.fetchVersions("not found package")).toThrowError("not found");
		});
	});

	it("throws an error on invalid directory read", function () {
		const request_handler = new MockRequestHandler;
		const registry = new Registry;
		registry.addBackend(new TarballRegistryBackend);
		registry.addBackend(new DirRegistryBackend);
		registry.serviceProvider = request_handler;

		return expect(registry.register("tests/not-found")).resolves.toBe(0);
	});
});
