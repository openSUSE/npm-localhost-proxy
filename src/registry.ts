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

import { URL } from 'url';
import { baseTarballName } from './utils';

export type PkgJsonRW = {
	name: string,
	version: string;
	dist: {
		tarball: string;
		integrity: string;
	}
};
export type PkgJson = Readonly<PkgJsonRW>;

export interface RegistryBackend {
	extractPkgJson(path: string): Promise<PkgJson[]>;
};

export interface RequestHandler {
	readonly url: URL;
}

export class Registry {
	private pkgs: PkgJson[] = [];
	private backends: RegistryBackend[] = [];
	private requestHandler: RequestHandler;

	constructor() {
		this.requestHandler = {url: new URL('file://')};
	}

	public addBackend(backend: RegistryBackend) {
		this.backends.push(backend);
	}

	set serviceProvider(service: RequestHandler) {
		this.requestHandler = service;
	}

	public fetchPackages(): any[] {
		let package_summary = [];
		for (let i = 0; i < this.pkgs.length; i = i + 1) {
			let p = this.pkgs[i];

			let current_pkg:any[] = package_summary.filter((f => f.name === p.name));
			if (current_pkg.length === 0) {
				current_pkg = [{ 'name': p.name, 'versions': {} }];
				current_pkg[0].versions[p.version] = this.requestHandler.url + [p.name, p.version].join('/');
				package_summary.push(current_pkg[0]);
			}
			else {
				let versions = current_pkg[0].versions;
				versions[p.version] = this.requestHandler.url + [p.name, p.version].join('/');
			}
		}
		return package_summary;
	}

	public fetchVersions(pkg_name: string): Object {
		let obj = {
			name: pkg_name,
			versions:{}
		};

		for (let i = 0; i < this.pkgs.length; i = i + 1) {
			if (this.pkgs[i].name === pkg_name) {
				const pkg = JSON.parse(JSON.stringify(this.pkgs[i]));
				pkg['dist']['tarball'] = this.requestHandler.url + '-/' + baseTarballName(pkg.dist.tarball);

				obj.versions[pkg.version] = pkg;
			}
		}

		if (Object.keys(obj.versions).length === 0)
			throw new Error("not found");

		return obj;
	}

	public fetchPkgVersion(pkg_name: string, version: string): Object {
		let obj = this.fetchVersions(pkg_name);
		if (!Object.keys(obj['versions']).includes(version))
			throw new Error("not found");

		return obj['versions'][version];
	}

	private static verifyPkgJsonType(pkg_json: PkgJson): boolean {
		if (!(pkg_json instanceof Object))
			return false;

		const keys = Object.keys(pkg_json);
		return keys.includes('name') &&
			keys.includes('version') &&
			keys.includes('dist');
	}

	private commitPkgJson(pkg_json: PkgJson): number {
		if (!Registry.verifyPkgJsonType(pkg_json))
			return 0;

		this.pkgs.push(pkg_json);
		return 1;
	}

	private processPathWithBackend(backend:RegistryBackend, path:string): Promise<number> {
		return backend.extractPkgJson(path).then(jsons => {
			let processed_packages = 0;
			jsons.forEach(pkg_json => processed_packages += this.commitPkgJson(pkg_json));
			return processed_packages;
		}).catch(err => 0)
	}

	public register(path: string): Promise<number> {
		let backend_processors = Promise.resolve(0);
		for (let i=0; i<this.backends.length; ++i) {
			backend_processors = backend_processors.then(imported => {
				if (imported > 0)
					return imported;
				return this.processPathWithBackend(this.backends[i], path)
			});
		}

		if (this.backends.length === 0)
			console.log("No backends");

		return backend_processors;
	}

	public archiveFile(file: string): (string|null) {
		const files = this.pkgs.filter(json => (baseTarballName(json.dist.tarball) === file))
		if (files.length !== 1)
			return null;
		return files[0].dist.tarball.substring(2);
	}
};
