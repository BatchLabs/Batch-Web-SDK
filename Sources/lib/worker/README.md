Files that go here are expected to be imported in a worker context.

They can use "webworker" APIs. Note that most files that work here will work in a DOM context, so this is an appropriate place to put stuff that's used in both places but requires specific browser APIs.
