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

import { Registry, RegistryBackend, PkgJson } from "../src/registry";
import { URL } from 'url';

let registry: Registry;

class MockRegistry implements RegistryBackend {
	private empty_pkg_json = {
		"name": "empty-npm-package",
		"version": "1.0.0",
		"description": "",
		"main": "index.js",
		"scripts": {
			"test": "echo \"Error: no test specified\" && exit 1"
		},
		"keywords": [],
		"author": "",
		"license": "ISC",
		"dist": {
			"tarball": "-/empty-npm-package-1.0.0.tgz"
		}
	};

	private jsons = {
		'empty-npm-package-1.0.0.tgz': [this.empty_pkg_json],

		'tests/pkgs': [
			this.empty_pkg_json,
			{
				"name": "assert",
				"version": "1.0.1",
				"dist": {
					"tarball": "-/assert-1.0.1.tgz"
				},
			},
			{
				"name": "assert",
				"version": "1.4.1",
				"dist": {
					"tarball": "-/assert-1.4.1.tgz"
				},
			}

		],
	};

	extractPkgJson(module_tarball: string): Promise<PkgJson[]> {
		return Promise.resolve(this.jsons.hasOwnProperty(module_tarball) ? this.jsons[module_tarball] : []);
	};
}

beforeEach(() => {
	registry = new Registry();
	registry.addBackend(new MockRegistry);
});

function testsForBogusNames() {
	expect(() => registry.fetchVersions('not-found-package')).toThrowError('not found');
	expect(() => registry.fetchPkgVersion('not-exist-package', 'not-exist-version')).toThrowError('not found');
	expect(registry.register("tests/pkgs/not-exist")).resolves.toBe(0);
	expect(() => registry.fetchVersions('not-found-package')).toThrowError('not found');
	expect(() => registry.fetchPkgVersion('not-exist-package', 'not-exist-version')).toThrowError('not found');
}

it("should return empty package list from from empty registry", function () {
	expect(registry.fetchPackages()).toStrictEqual([]);
	testsForBogusNames();
});

it("should not register any packages if registry backend doesn't return valid package JSON", function () {
	registry = new Registry;
	registry.addBackend({
		extractPkgJson: jest.fn(() => Promise.resolve([null, <PkgJson>{}, <PkgJson><unknown>{name: [333]}]))
	});
	return registry.register("empty-npm-package-1.0.0.tgz").then(pkg_count => {
		expect(pkg_count).toBe(0);

		testsForBogusNames();
	});
});

it("should not register an invalid tarball with registry", function () {
	return registry.register("broken.tgz").then(pkg_count => {
		expect(pkg_count).toBe(0);
		expect(registry.fetchPackages()).toStrictEqual([]);

		testsForBogusNames();
	});
});


it("should register an empty package and return it as a valid JSON", function () {
	return registry.register("empty-npm-package-1.0.0.tgz").then(pkg_count => {
		expect(pkg_count).toBe(1);
		testsForBogusNames();

		expect(registry.fetchPackages()).toStrictEqual([{
			'name': 'empty-npm-package',
			'versions': {
				'1.0.0': 'file:///empty-npm-package/1.0.0',
			}
		}]);

		expect(registry.fetchVersions('empty-npm-package')).toStrictEqual({
			'name': 'empty-npm-package',
			'versions': {
				'1.0.0':
					{
						"author": "",
						"description": "",
						"dist": {
							"tarball": "file:///-/empty-npm-package-1.0.0.tgz",
						},
						"keywords": [],
						"license": "ISC",
						"main": "index.js",
						"name": "empty-npm-package",
						"scripts": {
							"test": "echo \"Error: no test specified\" && exit 1",
						},
						"version": "1.0.0",
					},
			}
		});

		expect(registry.fetchPkgVersion('empty-npm-package', '1.0.0')).toStrictEqual({
			"author": "",
			"description": "",
			"dist": {
				"tarball": "file:///-/empty-npm-package-1.0.0.tgz",
			},
			"keywords": [],
			"license": "ISC",
			"main": "index.js",
			"name": "empty-npm-package",
			"scripts": {
				"test": "echo \"Error: no test specified\" && exit 1",
			},
			"version": "1.0.0",
		});

		testsForBogusNames();
	});
});

it("should allow registration and return of multiple versions of packages", function () {
	return registry.register("tests/pkgs").then(pkg_count => {
		expect(pkg_count).toBe(3);

		let assert_pkg = registry.fetchPackages().filter(pkg => pkg.name === 'assert');
		expect(assert_pkg.length).toBe(1);
		expect(Object.keys(assert_pkg[0].versions).sort()).toStrictEqual(['1.0.1', '1.4.1']);

		testsForBogusNames();
	});
});

it("should update URLs served when the listening URL is updated in the service", function() {
	return registry.register("tests/pkgs").then(pkg_count => {
		expect(pkg_count).toBe(3);

		registry.serviceProvider = {url: new URL("http://localhost:1234") };

		let assert_pkg = registry.fetchPackages().filter(pkg => pkg.name === 'assert');
		expect(assert_pkg.length).toBe(1);
		expect(Object.keys(assert_pkg[0].versions).sort()).toStrictEqual(['1.0.1', '1.4.1']);
		expect(assert_pkg[0].versions['1.0.1']).toBe("http://localhost:1234/assert/1.0.1");
		expect(assert_pkg[0].versions['1.4.1']).toBe("http://localhost:1234/assert/1.4.1");

		let assert_pkg_version = registry.fetchPkgVersion('assert', '1.4.1');
		expect(assert_pkg_version['dist']['tarball']).toBe("http://localhost:1234/-/assert-1.4.1.tgz");

		registry.serviceProvider = { url: new URL("http://localhost:1235") };

		assert_pkg = registry.fetchPackages().filter(pkg => pkg.name === 'assert');
		expect(assert_pkg.length).toBe(1);
		expect(Object.keys(assert_pkg[0].versions).sort()).toStrictEqual(['1.0.1', '1.4.1']);
		expect(assert_pkg[0].versions['1.0.1']).toBe("http://localhost:1235/assert/1.0.1");
		expect(assert_pkg[0].versions['1.4.1']).toBe("http://localhost:1235/assert/1.4.1");

		assert_pkg_version = registry.fetchPkgVersion('assert', '1.4.1');
		expect(assert_pkg_version['dist']['tarball']).toBe("http://localhost:1235/-/assert-1.4.1.tgz");
	});
});
