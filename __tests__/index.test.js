const weak = require('weak');
const makeTrashable = require('../src/index');

if (global.gc) {
  test.requireGC = test;
} else {
  test.requireGC = (...args) => {
    console.error(
      'Make sure to run tests with garbage collection exposed (`node --expose-gc`)\n' +
        'or else important tests will be skipped. Running `npm test` includes\n' +
        'all the flags you need.'
    );

    test.skip(...args); // eslint-disable-line jest/no-disabled-tests
  };
}

describe('makeTrashable()', () => {
  test('still resolves promise', () => {
    const value = 'this is a value';
    return expect(makeTrashable(Promise.resolve(value))).resolves.toBe(value);
  });

  test('still rejects promise', () => {
    const error = new Error('this is an error');
    return expect(makeTrashable(Promise.reject(error))).rejects.toBe(error);
  });

  describe('.trash()', () => {
    test('cancels the promise', () => {
      const timeoutPromise = delay => {
        return new Promise(resolve => {
          setTimeout(resolve, delay);
        });
      };

      const handler = jest.fn();
      const trashablePromise = makeTrashable(timeoutPromise(50));
      trashablePromise.then(handler);
      trashablePromise.trash();

      return timeoutPromise(100).then(() => {
        expect(handler).not.toHaveBeenCalled();
      });
    });

    test.requireGC('makes handler garbage collectable', () => {
      class Foo {
        constructor(promise) {
          this.exists = true;
          promise
            .then(() => {
              // I am holding onto this reference...
              this.resolve = true;
            })
            .catch(() => {
              // I am holding onto this reference...
              this.reject = true;
            });
        }
      }

      var promise = new Promise(resolve => {
        // Holds onto reference of resolve callback
        setTimeout(resolve, 1000);
      });

      var trashablePromise = makeTrashable(promise);

      // Object we want garbaged collected
      var foo = new Foo(trashablePromise);

      // Cancel/trash promise before resolves
      trashablePromise.trash();

      // Dereference
      trashablePromise = null;
      promise = null;

      const mock = jest.fn();

      // Track foo
      var ref = weak(foo, mock);

      // Dereference foo
      foo = null;

      expect(ref.exists).toBeTruthy();
      global.gc();
      expect(ref.exists).toBeFalsy();
      expect(mock).toHaveBeenCalled();
    });
  });
});
