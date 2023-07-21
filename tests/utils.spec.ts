import * as utils from '../src/utils'

describe("utility tests", function() {
	it("returns basename of path", function() {

		expect(utils.baseTarballName("test")).toBe("test");
		expect(utils.baseTarballName("test1/test2")).toBe("test2");
		expect(utils.baseTarballName("t1/t2/t3//")).toBe("");
		expect(utils.baseTarballName("///test/3")).toBe('3');
		expect(utils.baseTarballName('11/22/3/')).toBe('');
		expect(utils.baseTarballName('')).toBe('');
		expect(utils.baseTarballName('-//home/adamm/work/cockpit/systemsmanagement🚀cockpit/cockpit/cockpit/../t/read-pkg-semver-5.7.2.tgz')).toBe('read-pkg-semver-5.7.2.tgz')
	})
})
