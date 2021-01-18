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
import * as fs from 'fs';
import { promisify } from 'util';
import { TarballRegistryBackend } from './fs_registry'

const readdir = promisify(fs.readdir);
const concurrent_processes = 100;

export class DirRegistryBackend implements registry.RegistryBackend
{
	private tarball_registry = new TarballRegistryBackend;

	private static direntToPath(path: string, dirent: fs.Dirent) {
		if (path === '.')
			return dirent.name;
		return path + '/' + dirent.name;
	}

	private direntToPkgJson(path: string, dirent: fs.Dirent): Promise<registry.PkgJson[]> {
		const p = DirRegistryBackend.direntToPath(path, dirent);
		const pkg_json_promise = this.tarball_registry.extractPkgJson(p)

		return pkg_json_promise.catch(() => <registry.PkgJson[]>[])
	}

	public extractPkgJson(path: string): Promise<registry.PkgJson[]> {
		return new Promise((accept, reject) => {
			readdir(path, {withFileTypes: true})
			.then((files: fs.Dirent[]) => {
				files = files.filter(dirent => dirent.isFile())
				const promises:Promise<registry.PkgJson[]>[] = [];

				const max_pos = Math.min(concurrent_processes, files.length);
				for (let i=0; i<max_pos; ++i) {
					promises.push(this.direntToPkgJson(path, files.shift()))
				}
				let i = 0;
				while (files.length > 0) {
					i = (i + 1) % concurrent_processes;
					const filename = files.shift();
					promises[i] = promises[i].then(old_vals => {
						return this.direntToPkgJson(path, filename).then(new_vals => old_vals.concat(new_vals));
					});
				}

				Promise.all(promises)
				.then(jsons_array => {
					let ret_data: registry.PkgJson[] = [];

					jsons_array.forEach(data => {
						data.forEach(data => ret_data.push(data))
					})

					accept(ret_data);
				})
			})
			.catch(err => {
				reject(err);
			});
		});
	}
}
