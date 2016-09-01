import path from 'path';
import mkdirp from 'mkdirp';

export default function makeMeADir() {
   mkdirp.sync(path.join(__dirname, 'some-other-test-dir', 'some-test-dir'));
}
