/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const fs = jest.genMockFromModule('fs');
const noop = () => {};

function asyncCallback(cb) {
  return function() {
    setImmediate(() => cb.apply(this, arguments));
  };
}

const mtime = {
  getTime: () => Math.ceil(Math.random() * 10000000),
};

fs.realpath.mockImpl((filepath, callback) => {
  callback = asyncCallback(callback);
  let node;
  try {
    node = getToNode(filepath);
  } catch (e) {
    return callback(e);
  }
  if (node && typeof node === 'object' && node.SYMLINK != null) {
    return callback(null, node.SYMLINK);
  }
  callback(null, filepath);
});

fs.readdirSync.mockImpl((filepath) => Object.keys(getToNode(filepath)));

fs.readdir.mockImpl((filepath, callback) => {
  callback = asyncCallback(callback);
  let node;
  try {
    node = getToNode(filepath);
    if (node && typeof node === 'object' && node.SYMLINK != null) {
      node = getToNode(node.SYMLINK);
    }
  } catch (e) {
    return callback(e);
  }

  if (!(node && typeof node === 'object' && node.SYMLINK == null)) {
    return callback(new Error(filepath + ' is not a directory.'));
  }

  callback(null, Object.keys(node));
});

fs.readFile.mockImpl(function(filepath, encoding, callback) {
  callback = asyncCallback(callback);
  if (arguments.length === 2) {
    callback = encoding;
    encoding = null;
  }

  let node;
  try {
    node = getToNode(filepath);
    // dir check
    if (node && typeof node === 'object' && node.SYMLINK == null) {
      callback(new Error('Error readFile a dir: ' + filepath));
    }
    return callback(null, node);
  } catch (e) {
    return callback(e);
  }
});

fs.writeFile.mockImpl(function(filepath, data, encoding, callback) {
  callback = asyncCallback(callback);
  if (arguments.length === 2) {
    callback = encoding;
    encoding = null;
  }

  try {
    writeNode(filepath, data);
    return callback(null);
  } catch (e) {
    return callback(e);
  }
});

fs.mkdir.mockImpl(function(filepath, mode, callback) {
  callback = asyncCallback(callback);
  if (arguments.length === 2) {
    callback = mode;
    mode = null;
  }

  try {
    writeNode(filepath, null, true);
    return callback(null);
  } catch (e) {
    return callback(e);
  }
});

fs.mkdirSync.mockImpl((filepath, mode) => {
  writeNode(filepath, null, true);
});

fs.stat.mockImpl((filepath, callback) => {
  callback = asyncCallback(callback);
  let node;
  try {
    node = getToNode(filepath);
  } catch (e) {
    callback(e);
    return;
  }

  if (node.SYMLINK) {
    fs.stat(node.SYMLINK, callback);
    return;
  }

  if (node && typeof node === 'object') {
    callback(null, {
      isDirectory: () => true,
      isSymbolicLink: () => false,
      mtime,
    });
  } else {
    callback(null, {
      isDirectory: () => false,
      isSymbolicLink: () => false,
      mtime,
    });
  }
});

fs.statSync.mockImpl((filepath) => {
  const node = getToNode(filepath);

  if (node.SYMLINK) {
    return fs.statSync(node.SYMLINK);
  }

  return {
    isDirectory: () => node && typeof node === 'object',
    isSymbolicLink: () => false,
    mtime,
  };
});

fs.lstatSync.mockImpl((filepath) => {
  const node = getToNode(filepath);

  if (node.SYMLINK) {
    return {
      isDirectory: () => false,
      isSymbolicLink: () => true,
      mtime,
    };
  }

  return {
    isDirectory: () => node && typeof node === 'object',
    isSymbolicLink: () => false,
    mtime,
  };
});

fs.open.mockImpl(function(path) {
  const callback = arguments[arguments.length - 1] || noop;
  let data, error, fd;
  try {
    data = getToNode(path);
  } catch (e) {
    error = e;
  }

  if (error || data == null) {
    error = Error(`ENOENT: no such file or directory, open ${path}`);
  }
  if (data != null) {
    /* global Buffer: true */
    fd = {buffer: new Buffer(data, 'utf8'), position: 0};
  }

  callback(error, fd);
});

fs.read.mockImpl((fd, buffer, writeOffset, length, position, callback = noop) => {
  let bytesWritten;
  try {
    if (position == null || position < 0) {
      ({position} = fd);
    }
    bytesWritten = fd.buffer.copy(buffer, writeOffset, position, position + length);
    fd.position = position + bytesWritten;
  } catch (e) {
    callback(Error('invalid argument'));
    return;
  }
  callback(null, bytesWritten, buffer);
});

fs.close.mockImpl((fd, callback = noop) => {
  try {
    fd.buffer = fs.position = undefined;
  } catch (e) {
    callback(Error('invalid argument'));
    return;
  }
  callback(null);
});

let filesystem = {};

fs.__setMockFilesystem = (object) => filesystem = object;
fs.__getMockFilesystem = () => filesystem;

function getToNode(filepath) {
  // Ignore the drive for Windows paths.
  if (filepath.match(/^[a-zA-Z]:\\/)) {
    filepath = filepath.substring(2);
  }

  const parts = filepath.split(/[\/\\]/);
  if (parts[0] !== '') {
    throw new Error('Make sure all paths are absolute.');
  }
  let node = filesystem;
  parts.slice(1).forEach((part) => {
    if (node && node.SYMLINK) {
      node = getToNode(node.SYMLINK);
    }
    node = node[part];
  });

  if (!node) {
    throw new Error('No file exists at: ' + filepath);
  }

  return node;
}

function writeNode(filepath, data, mkdir) {
  // Ignore the drive for Windows paths.
  if (filepath.match(/^[a-zA-Z]:\\/)) {
    filepath = filepath.substring(2);
  }

  const parts = filepath.split(/[\/\\]/);
  if (parts[0] !== '') {
    throw new Error('Make sure all paths are absolute.');
  }
  let node = filesystem;
  parts.slice(1, parts.length - 1).forEach((part) => {
    if (node && node.SYMLINK) {
      node = getToNode(node.SYMLINK);
    }
    node = node[part];

    if (!node) {
      let err = new Error('Does not exist.');
      err.code = 'ENOENT';
      throw err;
    }
  });

  if (mkdir) {
    if (node[parts[parts.length - 1]]) {
      throw new Error('Node already exists at: ' + filepath);
    } else {
      node[parts[parts.length - 1]] = {};
    }
  } else {
    if (typeof node !== 'object' || node.SYMLINK) {
      throw new Error('Error not a dir: ' + filepath);
    }

    node[parts[parts.length - 1]] = data;
  }
}

module.exports = fs;
