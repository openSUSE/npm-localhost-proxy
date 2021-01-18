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

import * as registry from './registry'
import { spawn } from 'child_process'
import { fromStream as IntegrityFromStream } from 'ssri'
import * as fs from 'fs'

export class TarballRegistryBackend implements registry.RegistryBackend
{
	protected tar_cmd: string = '/usr/bin/tar';
	protected tar_cmd_opts: string = 'zxfO';

	public extractPkgJson(filename: string): Promise<registry.PkgJson[]> {
		return IntegrityFromStream(fs.createReadStream(filename))
		.then(integrity_hash => {
			return integrity_hash.toString();
		})

		.then(digest_string => new Promise((accepted, rejected) => {
			let serialized_json = '';
			let package_json = spawn(this.tar_cmd,
				[this.tar_cmd_opts, filename, "--wildcards", "--no-wildcards-match-slash", "*/package.json"],
				{stdio: ['ignore', 'pipe', 'ignore']});

				package_json.stdout.on('data', data => serialized_json += data);
				package_json.on('error', function (err) {
					rejected(err);
				});
				package_json.on('close', (code) => {
					if (code == 0 && serialized_json.length > 0) {
						let pkg: registry.PkgJsonRW = JSON.parse(serialized_json);
						pkg["dist"] = {
							"tarball": '-/' + filename,
							"integrity": digest_string
						};
						accepted([pkg]);
					}
					else
						rejected('Cannot find package.json in the tarball: ' + filename);
				});
			}));
	}
}
