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

import * as process from 'process'
import { mainEntryFunction } from '../src/index'

function setArgsAndReturnOldArgs(args:string[]) {
	const old_args = new Array(...process.argv);
	while (process.argv.length > 0)
		process.argv.pop();
	while(args.length > 0)
		process.argv.push(args.shift());
	return old_args;
}

describe("commandline interface tests", function() {
	it.skip("displays usage information when called with --help", function() {
		let msg = '';

		const old_opts = setArgsAndReturnOldArgs(["index.js", "--help"]);
		const console_log = jest.spyOn(console, "log").mockImplementation((message) => {
			msg += message;
		});

		mainEntryFunction();

		setArgsAndReturnOldArgs(old_opts);
		console_log.mockRestore();

		expect(msg).toContain("--help");
		expect(msg).toContain("help message");
	})
})
