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

import { TarballRegistryBackend } from '../src/fs_registry';
import { PassThrough, Readable } from 'stream';
import { EventEmitter } from 'events';
import { nextTick } from 'process';
import * as child_process from 'child_process';
import * as fs from 'fs';
import { PkgJson } from '../src/registry';

describe("TarballRegistryBackend tests", function() {
	const registry_backend = new TarballRegistryBackend;
	const empty_package_data = new PassThrough;
	let data = new Object;
	let spawn_mock: jest.SpyInstance;
	let readStreamMock: jest.SpyInstance;

	function program_and_args_key(program: string, args: readonly string[]): string {
		return program + args.join("");
	}

	function __spawnDataRegister (program: string, args: string[], stdout_stream: Readable, spawn_event_emitter: EventEmitter) {
		const key = program_and_args_key(program, args);

		data[key] = spawn_event_emitter;
		data[key]['stdout'] = stdout_stream;
	};

	function registerSpawn(tarball_path: string, stdout_stream: PassThrough, spawn_event_emitter: EventEmitter) {
		__spawnDataRegister("/usr/bin/tar", ['zxfO', tarball_path, '--wildcards', '--no-wildcards-match-slash', '*/package.json'], stdout_stream, spawn_event_emitter);
	}

	beforeAll(function() {
		spawn_mock = jest.spyOn(child_process, "spawn").mockImplementation((program, args) => {
			const key = program_and_args_key(program, args);

			if (!data.hasOwnProperty(key))
				throw new Error("Unknown key: " + key);

			const emitter = data[key];
			nextTick(() => emitter.emit("now-opened"));
			return emitter;
		});

		readStreamMock = jest.spyOn(fs, "createReadStream").mockImplementation((path, options?) => {
			const s = new Readable
			s['path'] = path
			nextTick(() => {
				s.emit("data", "test123TEST");
				s.emit("end");
				s.emit("close");
			});
			return <fs.ReadStream>s;
		});
	});

	beforeEach(function() {
		spawn_mock.mockClear();
		readStreamMock.mockClear();
	});

	afterAll(function() {
		jest.resetAllMocks();
	});

	it("reject empty files", function () {
		expect.assertions(2);
		const no_op_spawn = new EventEmitter;

		registerSpawn("empty", new PassThrough, no_op_spawn);
		no_op_spawn.on('now-opened', () => no_op_spawn.emit('close', 0));

		return expect(registry_backend.extractPkgJson("empty")).rejects.toBe('Cannot find package.json in the tarball: empty')
		.finally(() => {
			expect(spawn_mock).toHaveBeenCalledTimes(1);
		});
	});

	it("empty package json", function () {
		expect.assertions(2);

		const no_op_spawn = new EventEmitter;
		const empty_package_array:PkgJson[] = <any>[
			{ dist:
				{ tarball: '-/empty package', integrity: "sha512-3MEm3dDeTUuM98PbN4o3UeybQvOBYqouqGe04PYF8EUiqY7iQbtdBrBA1c9OogOFMk5EwWpIF1HriNND3M2k+Q==" },
		}];

		registerSpawn("empty package", empty_package_data, no_op_spawn);
		no_op_spawn.on('now-opened', () => {
			empty_package_data.emit('data', '{}');
			nextTick(() => no_op_spawn.emit('close', 0));
		});

		return expect(registry_backend.extractPkgJson("empty package").then(values => {
			expect(spawn_mock).toHaveBeenCalledTimes(1);

			return values;
		})).resolves.toStrictEqual(empty_package_array);
	});

	it("spawn error", function () {
		const error = new Error("sparg here!");
		const error_spawn = new EventEmitter;

		registerSpawn("error condition", new PassThrough, error_spawn);
		error_spawn.on('now-opened', () => error_spawn.emit('error', error));

		return expect(<any>registry_backend.extractPkgJson("error condition")).rejects.toBe(error);
	});

	it("Real package return", function () {
		const no_op_spawn = new EventEmitter;
		const package_data = '{"name":"empty-npm-package","version":"1.0.0","description":"","main":"index.js","scripts":{"test":"echo \\"Error: no test specified\\" && exit 1"},"keywords":[],"author":"","license":"ISC"}';

		registerSpawn("assert", empty_package_data, no_op_spawn);
		no_op_spawn.on('now-opened', () => {
			empty_package_data.emit('data', package_data );
			nextTick(() => no_op_spawn.emit('close', 0));
		});

		return expect(<any>registry_backend.extractPkgJson("assert")).resolves.toStrictEqual([
			{
				name: 'empty-npm-package',
				version: '1.0.0',
				description: '',
				main: 'index.js',
				scripts: { test: 'echo "Error: no test specified" && exit 1' },
				keywords: [],
				author: '',
				license: 'ISC',
				dist: {
					integrity: "sha512-3MEm3dDeTUuM98PbN4o3UeybQvOBYqouqGe04PYF8EUiqY7iQbtdBrBA1c9OogOFMk5EwWpIF1HriNND3M2k+Q==",
					tarball: '-/assert'
				}
			}
		]);
	});
});
