jest.mock('fs');

import path from 'path';

describe('makeMeADir', () => {
  it('makes me a dir', () => {
    const fs = require('fs');
    const makeMeADir = require('../makeMeADir').default;

    let expectedFileSystem = _fileSystemForDir(path.join(
      path.dirname(require.resolve('../makeMeADir')),
      'some-other-test-dir',
      'some-test-dir',
    ));

    makeMeADir();

    expect(fs.__getMockFilesystem()).toEqual(expectedFileSystem);
  });
});

function _fileSystemForDir(p) {
  let filesystem = {};
  const parts = p.split(path.sep);

  let node = filesystem;
  parts.slice(1).forEach(part => {
    node[part] = {};
    node = node[part];
  });
  return filesystem;
}
