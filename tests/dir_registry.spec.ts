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

import { DirRegistryBackend } from '../src/dir_registry';
import { readdir } from 'fs';
import { TarballRegistryBackend } from '../src/fs_registry';
import { mocked } from 'ts-jest/utils';

const { Dirent } = jest.requireActual('fs');

jest.mock('fs');

describe("DirRegistry tests", function() {
	const registry = new DirRegistryBackend;
	let extractPkgJson_mock: jest.SpyInstance;

	beforeAll(() => {
		extractPkgJson_mock = jest.spyOn(TarballRegistryBackend.prototype, "extractPkgJson").mockImplementation((filename) => {
			switch (filename) {
				case 'good/path/file1.tgz':
					return Promise.resolve([{ name: 'nothing1', version: '1.0.0', dist: { tarball: filename, integrity: '123' } }]);
				case 'good/path/file2.tgz':
					return Promise.resolve([{ name: 'nothing2', version: '1.5.0', dist: { tarball: filename, integrity: '123' } }]);
			}
			return Promise.reject('baddiness');
		});

		mocked(readdir).mockImplementation((filename, options, cb) => {
			if (!options['withFileTypes']) {
				cb(new Error("NOT CALLED WITH OPTION withFileTypes"), []);
				return;
			}

			switch (filename) {
				default:
					cb(new Error('Directory not found: ' + filename), []);
					break;
				case 'good/path':
					cb(null, [
						new Dirent('file1.tgz', 1),
						new Dirent('file2.tgz', 1),
						new Dirent('not file', 2),
						new Dirent('also not file', 3),
						new Dirent('someting', 4)
					])
					break;
			}
		});

	});

	afterAll(() => {
		jest.restoreAllMocks();
	});

	beforeEach(function () {
		extractPkgJson_mock.mockClear();
	});

	it("assert file only for Dirent type 1", function () {
		for (let i = 0; i < 10; i++)
			expect(new Dirent('something', i).isFile()).toBe(i == 1);
	});

	it("should reject on non-directory path", function () {
		expect.assertions(1);
		return expect(registry.extractPkgJson("not/found/dir")).rejects.toStrictEqual(new Error('Directory not found: not/found/dir'));
	});

	it("should accept a directory that exists and return correct array of files", function () {
		expect.assertions(3);

		return registry.extractPkgJson("good/path")
			.then(data => {
				expect(data).toHaveLength(2);
				expect(extractPkgJson_mock).toHaveBeenCalledTimes(2);
				expect(data).toStrictEqual([
					{
						"dist": {
							"tarball": "good/path/file1.tgz",
							"integrity": "123",
						},
						"name": "nothing1",
						"version": "1.0.0",
					},
					{
						"dist": {
							"tarball": "good/path/file2.tgz",
							"integrity": "123",
						},
						"name": "nothing2",
						"version": "1.5.0",
					},
				]);
			});
	});
});
