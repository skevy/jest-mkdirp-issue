import path from 'path';
import mkdirp from 'mkdirp';

export default function makeMeADir() {
   console.log(path.join(__dirname));
   mkdirp.sync(path.join(__dirname, 'some-other-test-dir', 'some-test-dir'));
}
